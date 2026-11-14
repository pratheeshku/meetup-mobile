/**
 * Link grammar (deep-links AD-2). Pure parsing of the part of a GameOn SG link after the host.
 *
 *   /l/reset#token={token}                       password reset
 *   /l/game/{uuid}?ref={uuid}#invite={uuid}      game
 *   /l/tournament/{uuid}#invite={uuid}           tournament
 *   /l/group-invite#token={uuid}                 group invitation
 *
 * Public identifiers go in the path or query; anything that proves a claim (reset token, group
 * token, invitation id) is read from the fragment only. Ids are validated as UUIDs. Anything else
 * is `malformed`, which the caller sends to Home without an error. Nothing here logs, stores or
 * throws; a token is only ever returned to the caller, never echoed.
 */

export type LinkKind = 'reset' | 'game' | 'tournament' | 'group_invite';

export type ParsedLink =
  | { kind: 'reset'; token: string }
  | { kind: 'game'; eventId: string; ref?: string; invite?: string }
  | { kind: 'tournament'; tournamentId: string; invite?: string }
  | { kind: 'group_invite'; token: string }
  | { kind: 'malformed' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// The reset token is `secrets.token_urlsafe(32)` (email-auth AD-2): URL-safe base64 characters only.
const RESET_TOKEN = /^[A-Za-z0-9_-]{16,512}$/;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

function decode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/** `a=1&b=2` to a map; a repeated key keeps its first value. */
function parseParams(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of raw.split('&')) {
    if (!pair) {
      continue;
    }
    const eq = pair.indexOf('=');
    const key = decode(eq === -1 ? pair : pair.slice(0, eq));
    const value = decode(eq === -1 ? '' : pair.slice(eq + 1));
    if (key !== null && value !== null && !(key in out)) {
      out[key] = value;
    }
  }
  return out;
}

const MALFORMED: ParsedLink = { kind: 'malformed' };

function optionalUuid(value: string | undefined): string | undefined {
  return isUuid(value) ? value.toLowerCase() : undefined;
}

/** `path` starts at the first `/` after the host and may carry `?query` and `#fragment`. */
export function parseLinkPath(path: string): ParsedLink {
  if (typeof path !== 'string' || !path.startsWith('/')) {
    return MALFORMED;
  }
  const hashAt = path.indexOf('#');
  const fragment = hashAt === -1 ? '' : path.slice(hashAt + 1);
  const beforeHash = hashAt === -1 ? path : path.slice(0, hashAt);
  const queryAt = beforeHash.indexOf('?');
  const query = queryAt === -1 ? '' : beforeHash.slice(queryAt + 1);
  const pathname = queryAt === -1 ? beforeHash : beforeHash.slice(0, queryAt);

  // A trailing slash is ignored.
  const parts = pathname.split('/').filter(segment => segment !== '');
  if (parts[0] !== 'l') {
    return MALFORMED;
  }
  const params = parseParams(query);
  const claims = parseParams(fragment);

  switch (parts[1]) {
    case 'reset': {
      const token = claims.token;
      return parts.length === 2 && token && RESET_TOKEN.test(token) ? { kind: 'reset', token } : MALFORMED;
    }
    case 'game': {
      const id = parts[2];
      if (parts.length !== 3 || !isUuid(id)) {
        return MALFORMED;
      }
      return {
        kind: 'game',
        eventId: id.toLowerCase(),
        ref: optionalUuid(params.ref),
        invite: optionalUuid(claims.invite),
      };
    }
    case 'tournament': {
      const id = parts[2];
      if (parts.length !== 3 || !isUuid(id)) {
        return MALFORMED;
      }
      return { kind: 'tournament', tournamentId: id.toLowerCase(), invite: optionalUuid(claims.invite) };
    }
    case 'group-invite': {
      const token = claims.token;
      return parts.length === 2 && isUuid(token) ? { kind: 'group_invite', token: token.toLowerCase() } : MALFORMED;
    }
    default:
      return MALFORMED;
  }
}

/**
 * A full URL: accepted only when it is `https` and its host is exactly `host` (no userinfo, no port).
 * Anything else is `malformed`. The operating system has already verified the host before the app
 * sees a link; this is the second check.
 */
export function parseLinkUrl(url: string, host: string): ParsedLink {
  if (typeof url !== 'string') {
    return MALFORMED;
  }
  const prefix = `https://${host}`;
  if (url.slice(0, prefix.length).toLowerCase() !== prefix.toLowerCase()) {
    return MALFORMED;
  }
  return parseLinkPath(url.slice(prefix.length));
}
