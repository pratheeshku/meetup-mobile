/**
 * A sport from `GET /admin/sports/public` (unauthenticated; DES-MEETUP-MOBILE.md
 * §7). Active rows only, in the order the API returns them (admin order).
 *
 * `icon_key` selects a bundled glyph. `color` is the single colour the UI
 * tints, chips and shadows are derived from. Either may be absent until the
 * sports API sends them; the UI then uses a neutral icon and colour.
 */
export interface Sport {
  /** Sport UUID from the sports API. `GET /venues` takes this as `sport_id`. */
  id?: string;
  /** The value sent as `sport` on create requests (see `api/sports.ts`). */
  name: string;
  display_name: string;
  slug?: string;
  /** Bundled glyph id. Null or absent when the API does not send one. */
  icon_key?: string | null;
  /** CSS hex colour from the API. Null or absent when the API does not send one. */
  color?: string | null;
}
