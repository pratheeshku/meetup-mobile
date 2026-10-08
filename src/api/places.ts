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
    const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
    url.searchParams.append('input', query.trim());
    url.searchParams.append('key', apiKey);
    if (sessionToken) {
      url.searchParams.append('sessiontoken', sessionToken);
    }

    const response = await fetch(url.toString());
    const data = await response.json();
    if (data.status === 'OK' && Array.isArray(data.predictions)) {
      return data.predictions.map((p: any) => ({
        place_id: p.place_id,
        description: p.description,
        main_text: p.structured_formatting?.main_text ?? p.description,
        secondary_text: p.structured_formatting?.secondary_text ?? '',
      }));
    }
    return [];
  } catch {
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
    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    url.searchParams.append('place_id', placeId);
    url.searchParams.append('fields', 'geometry,formatted_address,name');
    url.searchParams.append('key', apiKey);
    if (sessionToken) {
      url.searchParams.append('sessiontoken', sessionToken);
    }

    const response = await fetch(url.toString());
    const data = await response.json();
    if (data.status === 'OK' && data.result) {
      const { result } = data;
      return {
        place_id: placeId,
        name: result.name ?? '',
        formatted_address: result.formatted_address ?? '',
        lat: result.geometry?.location?.lat ?? 0,
        lng: result.geometry?.location?.lng ?? 0,
      };
    }
    return null;
  } catch {
    return null;
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
        name: top.formatted_address?.split(',')[0] ?? top.formatted_address ?? '',
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
