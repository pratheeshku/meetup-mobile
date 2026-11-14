/**
 * Share links (deep-links AD-11). Game and tournament shares end with a link built from two server
 * values in `GET /config/client`: `link_base_url` and `app_links_enabled`. No host is hard-coded.
 *
 *   base missing or not a plain https origin: no link (message only, as before)
 *   app_links_enabled true:  {base}/l/game/{event_id}?ref={user_id}   {base}/l/tournament/{id}
 *   otherwise (hash form):   {base}/#event-detail/{event_id}?ref={user_id}   {base}/#tournament-detail/{id}
 *
 * `ref` is the sharer's user id and is left out when it is not known. Group shares do not use this:
 * they keep the server's `invitation_url` unchanged.
 */
export type ShareTarget = { kind: 'game'; eventId: string } | { kind: 'tournament'; tournamentId: string };

export interface ShareLinkConfig {
  link_base_url?: string | null;
  app_links_enabled?: boolean;
}

export interface BuiltShareLink {
  url: string;
  form: 'path' | 'hash';
}

const PLAIN_HTTPS_ORIGIN = /^https:\/\/[A-Za-z0-9.-]+(:\d{1,5})?$/;

export function buildShareLink(
  config: ShareLinkConfig | null | undefined,
  target: ShareTarget,
  userId?: string | null,
): BuiltShareLink | null {
  const base = typeof config?.link_base_url === 'string' ? config.link_base_url.trim().replace(/\/+$/, '') : '';
  if (!PLAIN_HTTPS_ORIGIN.test(base)) {
    return null;
  }
  const path = config?.app_links_enabled === true;
  const ref = userId ? `?ref=${encodeURIComponent(userId)}` : '';
  if (target.kind === 'game') {
    const id = encodeURIComponent(target.eventId);
    return path
      ? { url: `${base}/l/game/${id}${ref}`, form: 'path' }
      : { url: `${base}/#event-detail/${id}${ref}`, form: 'hash' };
  }
  const id = encodeURIComponent(target.tournamentId);
  return path
    ? { url: `${base}/l/tournament/${id}`, form: 'path' }
    : { url: `${base}/#tournament-detail/${id}`, form: 'hash' };
}
