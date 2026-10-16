/**
 * Venue domain and catalog types (DES-MEETUP-ADDENDUM-VENUE-CATALOGUE §4, §5).
 * Built against spec; integration pending backend implementation.
 */

export interface VenueItem {
  id: string;
  provider: string;
  provider_venue_key: string;
  name: string;
  block?: string | null;
  street?: string | null;
  postal_code?: string | null;
  lat?: number | null;
  lng?: number | null;
  facilities?: string[] | null;
  operating_hours?: string | Record<string, unknown> | null;
  info_url?: string | null;
  booking_url?: string | null;
  status: 'active' | 'retired';
  /** Display source tag identifier (e.g. 'catalogue', provider name). */
  source?: string;
}

export interface VenueSnapshot {
  schema_version?: number;
  name: string;
  block?: string | null;
  street?: string | null;
  postal_code?: string | null;
  lat?: number | null;
  lng?: number | null;
  source: 'catalogue' | 'user' | string;
  facility_types?: string[] | null;
  operating_hours?: string | Record<string, unknown> | null;
  info_url?: string | null;
  captured_at?: string;
  geocoding_status?: 'pending' | 'resolved' | 'failed' | null;
  geocoded_at?: string | null;
  address?: string | null;
}

export interface OthersVenueInput {
  name: string;
  /** Exactly 6 numeric digits validated on blur and save (AD-8). */
  postal_code: string;
  facilities?: string[];
  operating_hours?: string;
  info_url?: string;
}

export interface VenueImage {
  id: string;
  venue_id?: string;
  game_id?: string | null;
  tournament_id?: string | null;
  url: string;
  content_type: string;
  bytes: number;
  sha256: string;
  origin?: 'admin_upload' | 'promoted';
  uploaded_by?: string;
  status: 'active' | 'reported' | 'removed';
  created_at: string;
}

export interface VenueDetail {
  venue: VenueItem;
  images: VenueImage[];
}

export interface VenuesListResponse {
  items: VenueItem[];
  next_cursor?: string | null;
}

export interface PostalLookupResponse {
  postal_code: string;
  name?: string | null;
  block?: string | null;
  street?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  geocoding_status?: 'resolved' | 'pending' | 'failed' | null;
}

/**
 * Feature flag constant to hide organizer venue photo upload, delete, and report
 * controls until the S3 backend ships. Shared admin photos in the detail card stay visible.
 */
export const VENUE_ORGANIZER_PHOTOS_ENABLED = false;

