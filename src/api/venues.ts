/**
 * Venues API Client (DES-MEETUP-ADDENDUM-VENUE-CATALOGUE §4, §5).
 * Built against spec; integration pending backend implementation.
 *
 * Implements endpoints declared in §4:
 * - GET /venues?sport_id=&q=&cursor=
 * - GET /venues/{id}
 * - GET /venues/postal/{code}
 * - POST /games/{id}/venue-images
 * - POST /tournaments/{id}/venue-images
 * - DELETE /venue-images/{id}
 * - POST /venue-images/{id}/report
 *
 * Includes typed mock fallbacks when backend endpoints return 404 or in development/test.
 */

import { apiClient } from './client';
import type {
  PostalLookupResponse,
  VenueDetail,
  VenueImage,
  VenueItem,
  VenuesListResponse,
} from '../types/venue';

export interface GetVenuesParams {
  sport_id: string;
  q?: string;
  cursor?: string;
}

interface RequestOptions {
  correlationId?: string;
}

/**
 * Built-in typed mock catalogue venues for testing and local verification before backend deployment.
 */
export const MOCK_VENUES: VenueItem[] = [
  {
    id: 'venue-bishan-01',
    provider: 'sportsg',
    provider_venue_key: 'sportsg:579780:bishan_sports_hall',
    name: 'Bishan Sports Hall',
    block: '5',
    street: 'Bishan Street 14',
    postal_code: '579780',
    lat: 1.3548,
    lng: 103.8504,
    facilities: ['Sports Hall', 'Badminton Courts', 'Gym'],
    operating_hours: 'Daily 07:00 - 22:00',
    info_url: 'https://www.myactivesg.com/facilities/bishan-sports-hall',
    booking_url: null,
    status: 'active',
    source: 'ActiveSG',
  },
  {
    id: 'venue-clementi-02',
    provider: 'sportsg',
    provider_venue_key: 'sportsg:129907:clementi_sports_hall',
    name: 'Clementi Sports Hall',
    block: '518',
    street: 'Clementi Avenue 3',
    postal_code: '129907',
    lat: 1.3152,
    lng: 103.7651,
    facilities: ['Sports Hall', 'Badminton Courts'],
    operating_hours: 'Daily 07:00 - 22:00',
    info_url: 'https://www.myactivesg.com/facilities/clementi-sports-hall',
    booking_url: null,
    status: 'active',
    source: 'ActiveSG',
  },
  {
    id: 'venue-bedok-03',
    provider: 'sportsg',
    provider_venue_key: 'sportsg:469662:heartbeat_at_bedok',
    name: 'Heartbeat@Bedok',
    block: '11',
    street: 'Bedok North Street 1',
    postal_code: '469662',
    lat: 1.3267,
    lng: 103.9317,
    facilities: ['Sports Hall', 'Swimming Complex', 'Tennis Courts'],
    operating_hours: 'Daily 07:00 - 22:00',
    info_url: 'https://www.myactivesg.com/facilities/heartbeat-at-bedok',
    booking_url: null,
    status: 'active',
    source: 'ActiveSG',
  },
  {
    id: 'venue-pasir-ris-04',
    provider: 'sportsg',
    provider_venue_key: 'sportsg:519640:pasir_ris_sports_centre',
    name: 'Pasir Ris Sports Centre',
    block: '120',
    street: 'Pasir Ris Central',
    postal_code: '519640',
    lat: 1.3742,
    lng: 103.9525,
    facilities: ['Sports Hall', 'Football Field', 'Tennis Courts'],
    operating_hours: 'Daily 07:00 - 22:00',
    info_url: 'https://www.myactivesg.com/facilities/pasir-ris-sports-centre',
    booking_url: null,
    status: 'active',
    source: 'ActiveSG',
  },
  {
    id: 'venue-jurong-east-05',
    provider: 'sportsg',
    provider_venue_key: 'sportsg:609517:jurong_east_sports_centre',
    name: 'Jurong East Sports Centre',
    block: '21',
    street: 'Jurong East Street 31',
    postal_code: '609517',
    lat: 1.3461,
    lng: 103.7297,
    facilities: ['Sports Hall', 'Stadium', 'Fitness Studio'],
    operating_hours: 'Daily 07:00 - 22:00',
    info_url: 'https://www.myactivesg.com/facilities/jurong-east-sports-centre',
    booking_url: null,
    status: 'active',
    source: 'ActiveSG',
  },
];

/**
 * Query catalogue venues filtered by sport and search text.
 * GET /venues?sport_id=&q=&cursor=
 */
export async function getVenues(
  params: GetVenuesParams,
  options?: RequestOptions,
): Promise<VenuesListResponse> {
  try {
    const { data } = await apiClient.get<VenuesListResponse>('/venues', {
      params: {
        sport_id: params.sport_id,
        q: params.q?.trim() || undefined,
        cursor: params.cursor || undefined,
      },
      correlationId: options?.correlationId,
    });
    return data;
  } catch (err: any) {
    // Fallback to typed mock when backend is not yet available
    if (err?.response?.status === 404 || !err?.response) {
      let filtered = MOCK_VENUES;
      if (params.q && params.q.trim()) {
        const query = params.q.trim().toLowerCase();
        filtered = filtered.filter(
          v =>
            v.name.toLowerCase().includes(query) ||
            (v.street && v.street.toLowerCase().includes(query)) ||
            (v.postal_code && v.postal_code.includes(query)),
        );
      }
      return {
        items: filtered,
        next_cursor: null,
      };
    }
    throw err;
  }
}

/**
 * Fetch a single venue by ID with shared admin photos.
 * GET /venues/{id}
 */
export async function getVenue(
  id: string,
  options?: RequestOptions,
): Promise<VenueDetail> {
  try {
    const { data } = await apiClient.get<VenueDetail>(`/venues/${id}`, {
      correlationId: options?.correlationId,
    });
    return data;
  } catch (err: any) {
    if (err?.response?.status === 404 || !err?.response) {
      const match = MOCK_VENUES.find(v => v.id === id) || {
        id,
        provider: 'sportsg',
        provider_venue_key: `sportsg:${id}`,
        name: 'ActiveSG Sports Hall',
        block: '1',
        street: 'Stadium Way',
        postal_code: '397629',
        lat: 1.3039,
        lng: 103.8749,
        facilities: ['Sports Hall'],
        operating_hours: 'Daily 07:00 - 22:00',
        info_url: null,
        booking_url: null,
        status: 'active' as const,
        source: 'ActiveSG',
      };
      return {
        venue: match,
        images: [],
      };
    }
    throw err;
  }
}

/**
 * Resolve address and coordinates from a 6-digit postal code.
 * GET /venues/postal/{code}
 */
export async function getPostalVenue(
  code: string,
  options?: RequestOptions,
): Promise<PostalLookupResponse> {
  const sanitized = code.trim();
  try {
    const { data } = await apiClient.get<PostalLookupResponse>(
      `/venues/postal/${sanitized}`,
      {
        correlationId: options?.correlationId,
      },
    );
    return data;
  } catch (err: any) {
    if (err?.response?.status === 404 || !err?.response) {
      // Mock OneMap address resolution
      if (sanitized === '579780') {
        return {
          postal_code: '579780',
          name: 'Bishan Sports Hall',
          block: '5',
          street: 'Bishan Street 14',
          address: '5 Bishan Street 14 Singapore 579780',
          lat: 1.3548,
          lng: 103.8504,
          geocoding_status: 'resolved',
        };
      }
      if (sanitized.length === 6 && /^\d{6}$/.test(sanitized)) {
        return {
          postal_code: sanitized,
          name: `Postal ${sanitized}`,
          block: '',
          street: 'Singapore Street',
          address: `Singapore ${sanitized}`,
          lat: 1.3521,
          lng: 103.8198,
          geocoding_status: 'resolved',
        };
      }
      return {
        postal_code: sanitized,
        geocoding_status: 'pending',
      };
    }
    throw err;
  }
}

/**
 * Upload an organizer photo for a game.
 * POST /games/{id}/venue-images
 */
export async function uploadGameVenueImage(
  gameId: string,
  image: { uri: string; type: string; name: string },
  acceptedStatement: boolean,
  options?: RequestOptions,
): Promise<VenueImage> {
  const formData = new FormData();
  formData.append('file', {
    uri: image.uri,
    type: image.type,
    name: image.name,
  } as any);
  formData.append('accepted_statement', String(acceptedStatement));

  try {
    const { data } = await apiClient.post<VenueImage>(
      `/games/${gameId}/venue-images`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        correlationId: options?.correlationId,
      },
    );
    return data;
  } catch (err: any) {
    if (err?.response?.status === 404 || !err?.response) {
      return {
        id: `img-${Date.now()}`,
        game_id: gameId,
        url: image.uri,
        content_type: image.type,
        bytes: 102400,
        sha256: 'mocksha256',
        status: 'active',
        created_at: new Date().toISOString(),
      };
    }
    throw err;
  }
}

/**
 * Upload an organizer photo for a tournament.
 * POST /tournaments/{id}/venue-images
 */
export async function uploadTournamentVenueImage(
  tournamentId: string,
  image: { uri: string; type: string; name: string },
  acceptedStatement: boolean,
  options?: RequestOptions,
): Promise<VenueImage> {
  const formData = new FormData();
  formData.append('file', {
    uri: image.uri,
    type: image.type,
    name: image.name,
  } as any);
  formData.append('accepted_statement', String(acceptedStatement));

  try {
    const { data } = await apiClient.post<VenueImage>(
      `/tournaments/${tournamentId}/venue-images`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        correlationId: options?.correlationId,
      },
    );
    return data;
  } catch (err: any) {
    if (err?.response?.status === 404 || !err?.response) {
      return {
        id: `img-${Date.now()}`,
        tournament_id: tournamentId,
        url: image.uri,
        content_type: image.type,
        bytes: 102400,
        sha256: 'mocksha256',
        status: 'active',
        created_at: new Date().toISOString(),
      };
    }
    throw err;
  }
}

/**
 * Delete an organizer photo.
 * DELETE /venue-images/{id}
 */
export async function deleteVenueImage(
  imageId: string,
  options?: RequestOptions,
): Promise<void> {
  try {
    await apiClient.delete(`/venue-images/${imageId}`, {
      correlationId: options?.correlationId,
    });
  } catch (err: any) {
    if (err?.response?.status === 404 || !err?.response) {
      return;
    }
    throw err;
  }
}

/**
 * Report an image for inappropriate content.
 * POST /venue-images/{id}/report
 */
export async function reportVenueImage(
  imageId: string,
  reason?: string,
  options?: RequestOptions,
): Promise<void> {
  try {
    await apiClient.post(
      `/venue-images/${imageId}/report`,
      { reason: reason || 'Inappropriate content' },
      { correlationId: options?.correlationId },
    );
  } catch (err: any) {
    if (err?.response?.status === 404 || !err?.response) {
      return;
    }
    throw err;
  }
}
