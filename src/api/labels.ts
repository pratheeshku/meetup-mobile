/**
 * Labels API — `GET /api/labels` (DES-MEETUP-MOBILE.md §7.10, "Runtime
 * label-serving, separate integration point"; unauthenticated by design,
 * §4.9: "`/admin/sports/public` and `/api/labels` are unauthenticated by
 * design"). Replaces the hardcoded label maps `src/utils/labels.ts` used to
 * carry (BUG-M02's ad-hoc fix) with the backend's own source of truth.
 *
 * Response shape — NESTED, not a flat map or array. Verified live against
 * `https://meetups.duckdns.org/api/labels` 2026-09-25:
 *
 *   { "labels": { "skill_level.beginner": "Beginner", ... } }
 *
 * Callers must unwrap `response.labels`; the raw Axios response body is
 * never used directly as the label map.
 */
import { apiClient } from './client';

/** Flat map of dotted label keys (`"skill_level.beginner"`) to display text. */
export type LabelMap = Record<string, string>;

interface LabelsApiResponse {
  labels: LabelMap;
}

interface RequestOptions {
  correlationId?: string;
}

export async function getLabels(options?: RequestOptions): Promise<LabelMap> {
  const { data } = await apiClient.get<LabelsApiResponse>('/api/labels', {
    correlationId: options?.correlationId,
  });
  // Shape-correction: the endpoint nests the map under `labels` — unwrap
  // here, once, so every caller gets the flat map directly.
  return data.labels;
}
