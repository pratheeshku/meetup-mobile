/**
 * A sport from `GET /admin/sports/public` (unauthenticated; DES-MEETUP-MOBILE.md
 * §7). Subset of the live `SportResponse` schema
 * (`id, name, slug, display_name, is_active`).
 */
export interface Sport {
  /** The value sent as `sport` on create requests (see `api/sports.ts`). */
  name: string;
  display_name: string;
}
