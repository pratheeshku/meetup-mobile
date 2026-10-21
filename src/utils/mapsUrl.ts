/**
 * "Open in Google Maps" link (DES-MEETUP-ADDENDUM-game-view-redesign AD-5). Built on the client from
 * the venue data already on the game or tournament; nothing is fetched.
 *
 * - With coordinates: `https://www.google.com/maps/search/?api=1&query=<lat>,<lng>`.
 * - Without: `query=<urlencoded name + address>`.
 * - `query_place_id=<place id>` is appended when the venue has one.
 * Returns `null` when there is nothing to search for.
 */
export interface MapsUrlInput {
  lat?: number | null;
  lng?: number | null;
  placeId?: string | null;
  name?: string | null;
  address?: string | null;
}

const BASE = 'https://www.google.com/maps/search/?api=1';

export function buildGoogleMapsUrl({
  lat,
  lng,
  placeId,
  name,
  address,
}: MapsUrlInput): string | null {
  const hasCoords =
    typeof lat === 'number' &&
    Number.isFinite(lat) &&
    typeof lng === 'number' &&
    Number.isFinite(lng);
  let query: string;
  if (hasCoords) {
    query = `${lat},${lng}`;
  } else {
    const text = [name, address]
      .map(part => (part ?? '').trim())
      .filter(Boolean)
      .join(' ');
    if (!text) {
      return null;
    }
    query = encodeURIComponent(text);
  }
  const place = placeId ? `&query_place_id=${encodeURIComponent(placeId)}` : '';
  return `${BASE}&query=${query}${place}`;
}
