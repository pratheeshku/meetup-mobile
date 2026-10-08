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
