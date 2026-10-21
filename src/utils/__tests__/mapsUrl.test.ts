/** T6: the "Open in Google Maps" link follows game-view-redesign AD-5 (coordinates, place id, text fallback). */
import { buildGoogleMapsUrl } from '../mapsUrl';

const BASE = 'https://www.google.com/maps/search/?api=1';

describe('buildGoogleMapsUrl (AD-5)', () => {
  it('uses lat,lng when coordinates exist', () => {
    expect(buildGoogleMapsUrl({ lat: 1.3521, lng: 103.8198, name: 'Hub', address: '1 Walk' })).toBe(
      `${BASE}&query=1.3521,103.8198`,
    );
  });

  it('appends query_place_id when the venue has one', () => {
    expect(buildGoogleMapsUrl({ lat: 1.35, lng: 103.82, placeId: 'ChIJabc' })).toBe(
      `${BASE}&query=1.35,103.82&query_place_id=ChIJabc`,
    );
  });

  it('falls back to the url-encoded name and address without coordinates', () => {
    expect(buildGoogleMapsUrl({ name: 'Our Tampines Hub · Hall 2', address: '1 Tampines Walk, Singapore 528523' })).toBe(
      `${BASE}&query=${encodeURIComponent('Our Tampines Hub · Hall 2 1 Tampines Walk, Singapore 528523')}`,
    );
  });

  it('the fallback also takes a place id', () => {
    expect(buildGoogleMapsUrl({ name: 'Hub', placeId: 'ChIJ x' })).toBe(
      `${BASE}&query=Hub&query_place_id=${encodeURIComponent('ChIJ x')}`,
    );
  });

  it('treats a lone coordinate as missing', () => {
    expect(buildGoogleMapsUrl({ lat: 1.3, lng: null, name: 'Hub' })).toBe(`${BASE}&query=Hub`);
  });

  it('is null when there is nothing to search for', () => {
    expect(buildGoogleMapsUrl({})).toBeNull();
    expect(buildGoogleMapsUrl({ name: '  ', address: null })).toBeNull();
  });
});
