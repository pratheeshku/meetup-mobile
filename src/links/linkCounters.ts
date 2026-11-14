/**
 * Link counters (deep-links design section 6). Diagnostic log events through the existing
 * diagnostics module: kind, platform and outcome only. Never an id, a token or a URL. No server
 * endpoint is involved.
 */
import { Platform } from 'react-native';

import { perfLog } from '../diagnostics/perfLog';

export type LinkCounterKind = 'reset' | 'game' | 'tournament' | 'group_invite' | 'unknown';
export type LinkOutcome = 'opened_target' | 'preview' | 'not_available' | 'sign_in_first' | 'malformed';

export function countLinkOpened(kind: LinkCounterKind, outcome: LinkOutcome): void {
  perfLog('link_opened', { kind, platform: Platform.OS, outcome });
}

/** A share link was built: `form` is which grammar it used. */
export function countLinkGenerated(kind: 'game' | 'tournament', form: 'path' | 'hash'): void {
  perfLog('link_generated', { kind, platform: Platform.OS, form });
}
