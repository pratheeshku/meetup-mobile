/**
 * Performance diagnostics module (perf-diagnostics task).
 *
 * LEAF MODULE — imports nothing from src/api, src/storage, src/notifications,
 * or src/screens. Only React Native built-ins, @react-native-async-storage,
 * React Native Share, and config/env.ts.
 *
 * TWO-LEVEL SWITCH
 *   Build flag  : PERF_LOG=true in .env (react-native-config)
 *   Runtime flag: AsyncStorage key "diagnostics.perf_enabled" (boolean not a
 *                 token; AsyncStorage is acceptable here per task brief)
 *   Effective ON = build flag OR runtime flag.
 *
 * When OFF: zero allocations, zero timers, no buffer growth; each call costs
 * one boolean guard check.
 *
 * When ON:
 *   - Events are logged as single-line JSON prefixed with "[PERF]" via
 *     console.log (visible in logcat).
 *   - Events are also pushed into an in-memory ring buffer (cap 3000).
 *   - A startup buffer (cap 200) captures events before the runtime flag is
 *     resolved; kept on ON, discarded on OFF.
 *
 * SENSITIVE FIELD RULES (hard constraints, never relaxed):
 *   - Never log tokens, Authorization/Cookie/Set-Cookie headers, request or
 *     response bodies, query strings, emails, names, or user IDs.
 *   - HTTP paths: log only the template (numeric/UUID segments → :id; query
 *     stripped).
 *   - Image URLs: log only host + first 16 chars of the storage key.
 */

import { Share, Platform, AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from 'react-native-config';

// ─── Build flag ────────────────────────────────────────────────────────────
// Explicit boolean parse: env strings like "false" are truthy under naive
// coercion (boolEnv discipline per implementation guidelines).
const BUILD_FLAG_ON = Config.PERF_LOG === 'true' || Config.PERF_LOG === '1';

// ─── Runtime flag storage key ──────────────────────────────────────────────
const ASYNC_KEY = 'diagnostics.perf_enabled';

// ─── State ─────────────────────────────────────────────────────────────────
/** Three-state to distinguish "not yet resolved" from true/false. */
type FlagState = boolean | 'pending';

let runtimeFlag: FlagState = 'pending';
let effectiveOn = BUILD_FLAG_ON; // best guess until async flag resolves

/** Startup buffer — captures events before the runtime flag is known. */
const STARTUP_BUFFER_CAP = 200;
const startupBuffer: string[] = [];

/** Ring buffer for all events after startup. */
const RING_CAP = 3000;
const ring: string[] = [];
let ringHead = 0; // next write index

/** Whether we have already committed the startup buffer to the ring. */
let startupFlushed = false;

// ─── Timing ────────────────────────────────────────────────────────────────
/**
 * Milliseconds since JS bundle start (performance.now() origin).
 * `performance` is available on Hermes and JSC in React Native ≥ 0.63.
 */
export function now(): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof (globalThis as any).performance?.now === 'function') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Math.round((globalThis as any).performance.now() * 10) / 10;
  }
  return Date.now(); // fallback (should not be needed on Hermes)
}

// ─── Flag resolution ────────────────────────────────────────────────────────
/**
 * Called once at app start. Reads the persisted runtime flag and — if it
 * changes the effective state — either keeps or discards the startup buffer.
 *
 * Must be called early (before or alongside AuthContext bootstrap) so the
 * startup buffer captures the boot timeline.
 */
export async function resolveRuntimeFlag(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(ASYNC_KEY);
    runtimeFlag = stored === 'true';
  } catch {
    runtimeFlag = false;
  }

  const wasOn = effectiveOn;
  effectiveOn = BUILD_FLAG_ON || (runtimeFlag as boolean);

  if (!startupFlushed) {
    startupFlushed = true;
    if (effectiveOn) {
      // Commit startup buffer into the ring.
      for (const entry of startupBuffer) {
        _pushToRing(entry);
      }
      startupBuffer.length = 0;
    } else {
      // Discard startup buffer.
      startupBuffer.length = 0;
    }
  }

  if (effectiveOn && !wasOn) {
    // Turned on mid-session: log a marker so the timeline shows the gap.
    _write({ ev: 'diag_enabled', flag_source: 'runtime' });
  }
}

/** Returns the current effective state. */
export function isPerfEnabled(): boolean {
  return effectiveOn;
}

/**
 * Persists a new runtime flag value and updates effective state.
 * Exposed for the 7-tap toggle.
 */
export async function setRuntimeFlag(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(ASYNC_KEY, value ? 'true' : 'false');
  } catch {
    // Storage failure: still update the in-memory flag for this session.
  }
  runtimeFlag = value;
  const wasOn = effectiveOn;
  effectiveOn = BUILD_FLAG_ON || value;
  if (effectiveOn && !wasOn) {
    _write({ ev: 'diag_enabled', flag_source: 'runtime' });
  }
}

// ─── Internal write helpers ─────────────────────────────────────────────────
function _pushToRing(line: string): void {
  if (ring.length < RING_CAP) {
    ring.push(line);
  } else {
    ring[ringHead] = line;
    ringHead = (ringHead + 1) % RING_CAP;
  }
}

function _write(fields: Record<string, unknown>): void {
  const t = now();
  const line = JSON.stringify({ t, ...fields });
  const tagged = '[PERF] ' + line;
  console.log(tagged);

  if (startupFlushed) {
    _pushToRing(tagged);
  } else {
    // Runtime flag not yet resolved: put into startup buffer.
    if (startupBuffer.length < STARTUP_BUFFER_CAP) {
      startupBuffer.push(tagged);
    }
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────
/**
 * Log a single named event with optional extra fields.
 * No-op when diagnostics is OFF.
 */
export function perfLog(ev: string, fields?: Record<string, unknown>): void {
  if (!effectiveOn) {
    return;
  }
  _write({ ev, ...(fields ?? {}) });
}

/**
 * Path template helper: strips query string and replaces numeric and UUID
 * segments with :id.  Never touches headers, bodies, or tokens.
 *
 * Example: "/events/42/checkin?foo=bar" → "/events/:id/checkin"
 */
export function toPathTemplate(rawPath: string): string {
  const withoutQuery = rawPath.split('?')[0];
  return withoutQuery.replace(
    /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\/|$)/gi,
    '/:id$1',
  ).replace(/\/\d+(\/|$)/g, '/:id$1');
}

/**
 * Image URL anonymiser: returns "host/first16charsOfKey" only.
 * Never logs signed URLs or query strings.
 */
export function imageUrlKey(url: string | undefined | null): string {
  if (!url) {
    return '';
  }
  try {
    const u = new URL(url);
    const key = u.pathname.replace(/^\//, '');
    return u.host + '/' + key.slice(0, 16);
  } catch {
    return url.slice(0, 16);
  }
}

// ─── Span helpers ───────────────────────────────────────────────────────────
export interface SpanEnd {
  (fields?: Record<string, unknown>): void;
}

/**
 * Starts a named span. Returns an `end` function that logs the span with its
 * duration in ms. No-op (zero allocations) when OFF.
 */
export function startSpan(name: string, fields?: Record<string, unknown>): SpanEnd {
  if (!effectiveOn) {
    return _noop;
  }
  const t0 = now();
  return (endFields?: Record<string, unknown>) => {
    const duration_ms = Math.round((now() - t0) * 10) / 10;
    _write({ ev: name, duration_ms, ...(fields ?? {}), ...(endFields ?? {}) });
  };
}

function _noop(_fields?: Record<string, unknown>): void {
  /* no-op when OFF */
}

// ─── Session header (Item A) ─────────────────────────────────────────────────
/**
 * Logs the one-time session header: platform, OS, device, app version, API
 * host, Hermes flag, build type, and which switch activated diagnostics.
 *
 * Call once, after resolveRuntimeFlag() resolves.
 */
export function logSessionHeader(apiBaseUrl: string): void {
  if (!effectiveOn) {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const DeviceInfo = require('react-native-device-info');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hermesEnabled = typeof (globalThis as any).HermesInternal !== 'undefined';

  _write({
    ev: 'session_header',
    platform: Platform.OS,
    os_version: Platform.Version,
    device_model: DeviceInfo.getModel(),
    device_brand: DeviceInfo.getBrand(),
    app_version: DeviceInfo.getVersion(),
    app_build: DeviceInfo.getBuildNumber(),
    api_host: (() => {
      try {
        return new URL(apiBaseUrl).host;
      } catch {
        return apiBaseUrl;
      }
    })(),
    hermes: hermesEnabled,
    dev: __DEV__,
    flag_source: BUILD_FLAG_ON ? 'build' : 'runtime',
  });
}

// ─── AppState listener (Item H) ─────────────────────────────────────────────
let _appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

/** Start listening to AppState changes. Idempotent. */
export function startAppStateLogging(): void {
  if (_appStateSubscription) {
    return;
  }
  let _previous: AppStateStatus = AppState.currentState;
  _appStateSubscription = AppState.addEventListener('change', (next: AppStateStatus) => {
    if (!effectiveOn) {
      return;
    }
    _write({ ev: 'app_state', prev: _previous, next });
    _previous = next;
  });
}

/** Stop AppState logging (e.g. when diagnostics turns off). */
export function stopAppStateLogging(): void {
  _appStateSubscription?.remove();
  _appStateSubscription = null;
}

// ─── JS thread stall detector (Item G) ─────────────────────────────────────
const JS_STALL_INTERVAL_MS = 50;
const JS_STALL_THRESHOLD_MS = 80;

let _stallTimer: ReturnType<typeof setInterval> | null = null;
let _lastTick = 0;

/** Start the 50 ms heartbeat stall detector. Only runs when ON. */
export function startStallDetector(): void {
  if (_stallTimer !== null || !effectiveOn) {
    return;
  }
  _lastTick = now();
  _stallTimer = setInterval(() => {
    if (!effectiveOn) {
      return;
    }
    const t = now();
    const drift = t - _lastTick - JS_STALL_INTERVAL_MS;
    _lastTick = t;
    if (drift >= JS_STALL_THRESHOLD_MS) {
      _write({ ev: 'js_stall', drift_ms: Math.round(drift) });
    }
  }, JS_STALL_INTERVAL_MS);
}

/** Stop the stall detector. */
export function stopStallDetector(): void {
  if (_stallTimer !== null) {
    clearInterval(_stallTimer);
    _stallTimer = null;
  }
}

// ─── Ring accessor ──────────────────────────────────────────────────────────
/**
 * Returns the ring buffer contents in chronological order.
 * (The ring buffer is a fixed-size circular buffer written with `ringHead`.)
 */
function getRingContents(): string[] {
  if (ring.length < RING_CAP) {
    // Not yet wrapped — items are in insertion order.
    return ring.slice();
  }
  // Wrapped: items from ringHead onward, then 0..ringHead-1.
  return [...ring.slice(ringHead), ...ring.slice(0, ringHead)];
}

// ─── Summary report (Item REPORT FORMAT) ─────────────────────────────────────

interface RequestEntry {
  path: string;
  method: string;
  token_wait_ms: number;
  network_ms: number;
  total_ms: number;
  status: number;
}

interface ScreenVisit {
  name: string;
  tap_to_focus_ms?: number;
  first_content_ms?: number;
  request_count: number;
  sum_total_ms: number;
  max_total_ms: number;
  sum_token_wait_ms: number;
  max_token_wait_ms: number;
  render_count: number;
  slowest_image_ms?: number;
}

interface KeychainStat {
  total_calls: number;
  durations: number[];
  max_concurrent: number;
}

interface StallEntry {
  t: number;
  drift_ms: number;
}

interface ImageEntry {
  key: string;
  load_ms: number;
  width?: number;
  height?: number;
}

/** Build a human-readable plain-text summary for Share. */
export function buildSummary(): string {
  const events = getRingContents();
  const lines: string[] = [];

  // Parse events
  const parsed: Array<{ t: number; ev: string } & Record<string, unknown>> = [];
  for (const raw of events) {
    try {
      const stripped = raw.startsWith('[PERF] ') ? raw.slice(7) : raw;
      const obj = JSON.parse(stripped) as { t: number; ev: string } & Record<string, unknown>;
      parsed.push(obj);
    } catch {
      // Skip malformed
    }
  }

  // ── 1. Session header ────────────────────────────────────────────────────
  lines.push('=== PERF DIAGNOSTICS REPORT ===\n');
  const header = parsed.find(e => e.ev === 'session_header');
  if (header) {
    lines.push('── Session ─────────────────────────────────');
    lines.push(`Platform       : ${header.platform}`);
    lines.push(`OS version     : ${header.os_version}`);
    lines.push(`Device         : ${header.device_brand} ${header.device_model}`);
    lines.push(`App version    : ${header.app_version} (build ${header.app_build})`);
    lines.push(`API host       : ${header.api_host}`);
    lines.push(`Hermes         : ${header.hermes}`);
    lines.push(`Dev mode       : ${header.dev}`);
    lines.push(`Flag source    : ${header.flag_source}`);
    lines.push('');
  }

  // ── 2. Boot timeline ─────────────────────────────────────────────────────
  const bootEvents = parsed.filter(e => String(e.ev).startsWith('boot_'));
  if (bootEvents.length > 0) {
    lines.push('── Boot Timeline ───────────────────────────');
    lines.push('Step                            Start(ms)  Duration(ms)');
    for (const be of bootEvents) {
      const step = String(be.ev).replace('boot_', '');
      const start = String(be.t ?? '');
      const dur = be.duration_ms != null ? String(be.duration_ms) : '-';
      lines.push(`${step.padEnd(32)} ${start.padStart(9)}  ${dur.padStart(12)}`);
    }
    lines.push('');
  }

  // ── 3. Per-screen visits ─────────────────────────────────────────────────
  const screenVisits: Map<string, ScreenVisit> = new Map();
  const requestsByScreen: Map<string, RequestEntry[]> = new Map();
  let currentScreen = 'unknown';

  for (const e of parsed) {
    if (e.ev === 'nav_state_change' && typeof e.route === 'string') {
      currentScreen = e.route as string;
      if (!screenVisits.has(currentScreen)) {
        screenVisits.set(currentScreen, {
          name: currentScreen,
          request_count: 0,
          sum_total_ms: 0,
          max_total_ms: 0,
          sum_token_wait_ms: 0,
          max_token_wait_ms: 0,
          render_count: 0,
        });
        requestsByScreen.set(currentScreen, []);
      }
      const sv = screenVisits.get(currentScreen)!;
      if (typeof e.tap_to_focus_ms === 'number') {
        sv.tap_to_focus_ms = e.tap_to_focus_ms as number;
      }
    } else if (e.ev === 'first_content' && typeof e.screen === 'string') {
      const sv = screenVisits.get(e.screen as string);
      if (sv && typeof e.first_content_ms === 'number') {
        sv.first_content_ms = e.first_content_ms as number;
      }
    } else if (e.ev === 'render_count' && typeof e.screen === 'string') {
      const sv = screenVisits.get(e.screen as string);
      if (sv && typeof e.count === 'number') {
        sv.render_count = e.count as number;
      }
    } else if (e.ev === 'http_response') {
      const req: RequestEntry = {
        path: String(e.path ?? ''),
        method: String(e.method ?? ''),
        token_wait_ms: Number(e.token_wait_ms ?? 0),
        network_ms: Number(e.network_ms ?? 0),
        total_ms: Number(e.total_ms ?? 0),
        status: Number(e.status ?? 0),
      };
      const screenReqs = requestsByScreen.get(currentScreen) ?? [];
      screenReqs.push(req);
      requestsByScreen.set(currentScreen, screenReqs);
      const sv = screenVisits.get(currentScreen);
      if (sv) {
        sv.request_count++;
        sv.sum_total_ms += req.total_ms;
        sv.max_total_ms = Math.max(sv.max_total_ms, req.total_ms);
        sv.sum_token_wait_ms += req.token_wait_ms;
        sv.max_token_wait_ms = Math.max(sv.max_token_wait_ms, req.token_wait_ms);
      }
    } else if (e.ev === 'img_load' && typeof e.screen === 'string') {
      const sv = screenVisits.get(e.screen as string);
      if (sv && typeof e.load_ms === 'number') {
        if (sv.slowest_image_ms == null || (e.load_ms as number) > sv.slowest_image_ms) {
          sv.slowest_image_ms = e.load_ms as number;
        }
      }
    }
  }

  if (screenVisits.size > 0) {
    lines.push('── Screen Visits ───────────────────────────');
    for (const [, sv] of screenVisits) {
      lines.push(`Screen: ${sv.name}`);
      lines.push(`  tap_to_focus_ms  : ${sv.tap_to_focus_ms ?? '-'}`);
      lines.push(`  first_content_ms : ${sv.first_content_ms ?? '-'}`);
      lines.push(`  requests         : ${sv.request_count}`);
      lines.push(`  total_ms sum/max : ${sv.sum_total_ms} / ${sv.max_total_ms}`);
      lines.push(`  token_wait sum/max: ${sv.sum_token_wait_ms} / ${sv.max_token_wait_ms}`);
      lines.push(`  render_count     : ${sv.render_count}`);
      lines.push(`  slowest_img_ms   : ${sv.slowest_image_ms ?? '-'}`);
    }
    lines.push('');
  }

  // ── 4. Keychain stats ────────────────────────────────────────────────────
  const keychainCalls: KeychainStat = { total_calls: 0, durations: [], max_concurrent: 0 };
  for (const e of parsed) {
    if (e.ev === 'keychain_read' || e.ev === 'keychain_write') {
      keychainCalls.total_calls++;
      if (typeof e.duration_ms === 'number') {
        keychainCalls.durations.push(e.duration_ms as number);
      }
      if (typeof e.in_flight === 'number') {
        keychainCalls.max_concurrent = Math.max(keychainCalls.max_concurrent, e.in_flight as number);
      }
    }
  }
  if (keychainCalls.total_calls > 0) {
    keychainCalls.durations.sort((a, b) => a - b);
    const n = keychainCalls.durations.length;
    const avg = n > 0 ? Math.round(keychainCalls.durations.reduce((a, b) => a + b, 0) / n) : 0;
    const p95 = n > 0 ? keychainCalls.durations[Math.floor(n * 0.95)] ?? keychainCalls.durations[n - 1] : 0;
    const max = n > 0 ? keychainCalls.durations[n - 1] : 0;
    lines.push('── Keychain Stats ──────────────────────────');
    lines.push(`  calls          : ${keychainCalls.total_calls}`);
    lines.push(`  avg_ms         : ${avg}`);
    lines.push(`  p95_ms         : ${p95}`);
    lines.push(`  max_ms         : ${max}`);
    lines.push(`  max_concurrent : ${keychainCalls.max_concurrent}`);
    lines.push('');
  }

  // ── 5. Top 10 slowest requests ───────────────────────────────────────────
  const allRequests: RequestEntry[] = [];
  for (const e of parsed) {
    if (e.ev === 'http_response') {
      allRequests.push({
        path: String(e.path ?? ''),
        method: String(e.method ?? ''),
        token_wait_ms: Number(e.token_wait_ms ?? 0),
        network_ms: Number(e.network_ms ?? 0),
        total_ms: Number(e.total_ms ?? 0),
        status: Number(e.status ?? 0),
      });
    }
  }
  if (allRequests.length > 0) {
    const top10 = allRequests
      .slice()
      .sort((a, b) => b.total_ms - a.total_ms)
      .slice(0, 10);
    lines.push('── Top 10 Slowest Requests ─────────────────');
    lines.push('Method  Path                             TokenWait  Network   Total');
    for (const r of top10) {
      const path = r.path.slice(0, 33).padEnd(33);
      lines.push(
        `${r.method.padEnd(7)} ${path} ${String(r.token_wait_ms).padStart(9)} ${String(r.network_ms).padStart(8)} ${String(r.total_ms).padStart(7)}`,
      );
    }
    lines.push('');
  }

  // ── 6. JS stalls ─────────────────────────────────────────────────────────
  const stalls: StallEntry[] = parsed
    .filter(e => e.ev === 'js_stall')
    .map(e => ({ t: Number(e.t), drift_ms: Number(e.drift_ms) }));
  if (stalls.length > 0) {
    const top10Stalls = stalls.slice().sort((a, b) => b.drift_ms - a.drift_ms).slice(0, 10);
    const maxDrift = top10Stalls[0]?.drift_ms ?? 0;
    lines.push('── JS Thread Stalls ────────────────────────');
    lines.push(`  count    : ${stalls.length}`);
    lines.push(`  max_ms   : ${maxDrift}`);
    lines.push('  Top 10:');
    for (const s of top10Stalls) {
      lines.push(`    t=${s.t} drift=${s.drift_ms}ms`);
    }
    lines.push('');
  }

  // ── 7. Image loads ───────────────────────────────────────────────────────
  const images: ImageEntry[] = parsed
    .filter(e => e.ev === 'img_load')
    .map(e => ({
      key: String(e.key ?? ''),
      load_ms: Number(e.load_ms ?? 0),
      width: typeof e.width === 'number' ? (e.width as number) : undefined,
      height: typeof e.height === 'number' ? (e.height as number) : undefined,
    }));
  if (images.length > 0) {
    const slowest = images.slice().sort((a, b) => b.load_ms - a.load_ms)[0];
    const largest = images
      .filter(i => i.width != null && i.height != null)
      .sort((a, b) => (b.width! * b.height!) - (a.width! * a.height!))[0];
    lines.push('── Image Loads ─────────────────────────────');
    lines.push(`  count         : ${images.length}`);
    lines.push(`  slowest_ms    : ${slowest?.load_ms ?? '-'} (${slowest?.key ?? ''})`);
    lines.push(
      `  largest_dims  : ${largest ? `${largest.width}x${largest.height} (${largest.key})` : '-'}`,
    );
    lines.push('');
  }

  lines.push('=== RAW EVENTS ===');
  lines.push(events.join('\n'));

  return lines.join('\n');
}

// ─── Share ───────────────────────────────────────────────────────────────────
/** Share the diagnostic report via React Native's built-in Share sheet. */
export async function shareLog(): Promise<void> {
  const message = buildSummary();
  await Share.share({ message });
}
