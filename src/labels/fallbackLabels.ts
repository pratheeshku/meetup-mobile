/**
 * Bundled fallback label snapshot — the last-resort source of label text
 * when BOTH the network fetch (`GET /api/labels`, `src/api/labels.ts`) AND
 * the AsyncStorage cache (`LabelsContext.tsx`) are unavailable: first
 * launch, offline, with nothing cached yet.
 *
 * These are the exact values `src/utils/labels.ts` hardcoded before this
 * fix (`SKILL_LEVEL_LABELS`, `EVENT_VISIBILITY_LABELS`,
 * `TOURNAMENT_VISIBILITY_LABELS`) plus `CreateGroupScreen.tsx`'s previously
 * inline `TEAM_VISIBILITY_OPTIONS` strings — i.e. "current known-good
 * values from labels.ts", per this task's brief, not a re-copy of the live
 * `/api/labels` response text. The two differ in a few places (e.g.
 * `event_visibility.invite_only` is `"Private"` here vs. the live
 * endpoint's `"Invite Only"`) — that's expected: this snapshot exists to
 * preserve exactly what already shipped, for the total-outage case only.
 * Every other case (network reachable, or a prior fetch cached to
 * AsyncStorage) uses the backend's live text instead.
 *
 * This same object is also the `LabelsContext` default value, so any
 * component rendered without a `LabelsProvider` ancestor (e.g. a unit test
 * that doesn't exercise label-fetching behaviour) gets these deterministic
 * strings rather than an error.
 */
import type { LabelMap } from '../api/labels';

export const FALLBACK_LABELS: LabelMap = {
  'skill_level.beginner': 'Beginner',
  'skill_level.intermediate': 'Intermediate',
  'skill_level.expert': 'Expert',
  'skill_level.all_levels': 'All Levels',

  'event_visibility.public': 'Public',
  'event_visibility.invite_only': 'Private',
  'event_visibility.group': 'Group',

  'tournament_visibility.public': 'Public',
  'tournament_visibility.invite': 'Private',
  'tournament_visibility.group': 'Group Only',

  'team_visibility.public': 'Public',
  'team_visibility.private': 'Private',
};
