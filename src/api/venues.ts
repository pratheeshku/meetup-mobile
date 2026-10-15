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
 * No runtime mock fallbacks. Failures (404, network error, 5xx) throw errors
 * so callers display proper error and retry state. Upload, delete, and report
 * succeed only if the server call succeeds.
 */

import { apiClient } from './client';
import type {
  PostalLookupResponse,
  VenueDetail,
  VenueImage,
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
 * Query catalogue venues filtered by sport and search text.
 * GET /venues?sport_id=&q=&cursor=
 */
export async function getVenues(
  params: GetVenuesParams,
  options?: RequestOptions,
): Promise<VenuesListResponse> {
  const { data } = await apiClient.get<VenuesListResponse>('/venues', {
    params: {
      sport_id: params.sport_id,
      q: params.q?.trim() || undefined,
      cursor: params.cursor || undefined,
    },
    correlationId: options?.correlationId,
  });
  return data;
}

/**
 * Fetch a single venue by ID with shared admin photos.
 * GET /venues/{id}
 */
export async function getVenue(
  id: string,
  options?: RequestOptions,
): Promise<VenueDetail> {
  const { data } = await apiClient.get<VenueDetail>(`/venues/${id}`, {
    correlationId: options?.correlationId,
  });
  return data;
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
  const { data } = await apiClient.get<PostalLookupResponse>(
    `/venues/postal/${sanitized}`,
    {
      correlationId: options?.correlationId,
    },
  );
  return data;
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

  const { data } = await apiClient.post<VenueImage>(
    `/games/${gameId}/venue-images`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      correlationId: options?.correlationId,
    },
  );
  return data;
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

  const { data } = await apiClient.post<VenueImage>(
    `/tournaments/${tournamentId}/venue-images`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      correlationId: options?.correlationId,
    },
  );
  return data;
}

/**
 * Delete an organizer photo.
 * DELETE /venue-images/{id}
 */
export async function deleteVenueImage(
  imageId: string,
  options?: RequestOptions,
): Promise<void> {
  await apiClient.delete(`/venue-images/${imageId}`, {
    correlationId: options?.correlationId,
  });
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
  await apiClient.post(
    `/venue-images/${imageId}/report`,
    { reason: reason || 'Inappropriate content' },
    { correlationId: options?.correlationId },
  );
}
