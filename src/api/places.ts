import axios from 'axios';
import uuid from 'react-native-uuid';
import { describeError } from '../utils/logSafeError';
import { isNetworkError } from '../utils/networkError';

const PLACES_BASE_URL = 'https://places.googleapis.com/v1';
const PLACES_TIMEOUT_MS = 10000;

// One Places session = autocomplete requests followed by one details call.
// Screens do not pass a token, so it is held here and rotated after details.
let activeSessionToken: string | null = null;

function newSessionToken(): string {
  return uuid.v4() as string;
}

function currentSessionToken(explicit?: string): string {
  if (explicit) {
    return explicit;
  }
  if (!activeSessionToken) {
    activeSessionToken = newSessionToken();
  }
  return activeSessionToken;
}

// Never log the key, the URL, the input text or the error object (R-111).
function logPlacesFailure(op: string, error: unknown): void {
  console.warn(
    `[places] ${op} failed: ${
      isNetworkError(error) ? 'network' : describeError(error)
    }`,
  );
}

export interface PlacePrediction {
  place_id: string;
  description: string;
  main_text?: string;
  secondary_text?: string;
}

export async function fetchPlacePredictions(
  query: string,
  apiKey: string | null | undefined,
  sessionToken?: string,
): Promise<PlacePrediction[]> {
  if (!query || !query.trim() || !apiKey) {
    return [];
  }
  try {
    const response = await axios.post(
      `${PLACES_BASE_URL}/places:autocomplete`,
      {
        input: query.trim(),
        includedRegionCodes: ['sg'],
        sessionToken: currentSessionToken(sessionToken),
      },
      {
        headers: {
          'X-Goog-Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
        timeout: PLACES_TIMEOUT_MS,
      },
    );
    const suggestions = response.data?.suggestions;
    if (!Array.isArray(suggestions)) {
      return [];
    }
    return suggestions
      .map((s: any) => s?.placePrediction)
      .filter((p: any) => p && typeof p.placeId === 'string')
      .map((p: any) => {
        const description: string = p.text?.text ?? '';
        return {
          place_id: p.placeId,
          description,
          main_text: p.structuredFormat?.mainText?.text ?? description,
          secondary_text: p.structuredFormat?.secondaryText?.text ?? '',
        };
      });
  } catch (error) {
    logPlacesFailure('autocomplete', error);
    return [];
  }
}

export interface PlaceDetails {
  place_id: string;
  name: string;
  formatted_address: string;
  lat: number;
  lng: number;
}

export async function fetchPlaceDetails(
  placeId: string,
  apiKey: string | null | undefined,
  sessionToken?: string,
): Promise<PlaceDetails | null> {
  if (!placeId || !apiKey) {
    return null;
  }
  try {
    const response = await axios.get(
      `${PLACES_BASE_URL}/places/${encodeURIComponent(placeId)}`,
      {
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'id,displayName,formattedAddress,location',
        },
        params: { sessionToken: currentSessionToken(sessionToken) },
        timeout: PLACES_TIMEOUT_MS,
      },
    );
    const result = response.data;
    if (!result) {
      return null;
    }
    return {
      place_id: placeId,
      name: result.displayName?.text ?? '',
      formatted_address: result.formattedAddress ?? '',
      lat: result.location?.latitude ?? 0,
      lng: result.location?.longitude ?? 0,
    };
  } catch (error) {
    logPlacesFailure('details', error);
    return null;
  } finally {
    // The session ends with the details call, success or not.
    activeSessionToken = null;
  }
}

export async function reverseGeocodeCoordinates(
  lat: number,
  lng: number,
  apiKey: string | null | undefined,
): Promise<PlaceDetails | null> {
  if (!apiKey) {
    return null;
  }
  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.append('latlng', `${lat},${lng}`);
    url.searchParams.append('key', apiKey);

    const response = await fetch(url.toString());
    const data = await response.json();
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const top = data.results[0];
      return {
        place_id: top.place_id ?? '',
        name:
          top.formatted_address?.split(',')[0] ?? top.formatted_address ?? '',
        formatted_address: top.formatted_address ?? '',
        lat: top.geometry?.location?.lat ?? lat,
        lng: top.geometry?.location?.lng ?? lng,
      };
    }
    return null;
  } catch {
    return null;
  }
}
