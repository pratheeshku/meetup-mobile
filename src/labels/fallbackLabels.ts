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
import { DEFAULT_LABELS } from './defaultLabels';

const BASE_LABELS = {
  'skill_level.beginner': 'Beginner',
  'skill_level.intermediate': 'Intermediate',
  'skill_level.expert': 'Expert',
  'skill_level.all_levels': 'All Levels',
  'skill_level.beginner.desc': 'New to the sport or still learning the rules',
  'skill_level.intermediate.desc': 'Play regularly, comfortable with the basics',
  'skill_level.expert.desc': 'Competitive, strong technique and match experience',

  mob_skill_sports_title: 'What do you play?',
  mob_skill_sports_subtitle: 'Select all that apply. Level comes next.',
  mob_skill_level_title: 'How good are you?',
  mob_skill_level_subtitle: 'One level per sport. Change it anytime.',
  mob_skill_pick_level_hint: 'Pick a level to continue',
  mob_my_sports_title: 'My sports',
  mob_add_sport: 'Add sport',

  'event_visibility.public': 'Public',
  'event_visibility.invite_only': 'Invite Only',
  'event_visibility.group': 'Group',

  'tournament_visibility.public': 'Public',
  'tournament_visibility.invite': 'Private',
  'tournament_visibility.group': 'Group Only',

  'team_visibility.public': 'Public',
  'team_visibility.private': 'Private',
} as const;

const ALL_LABELS = { ...BASE_LABELS, ...DEFAULT_LABELS };

/** Every label key the app resolves; `t()` only accepts these. */
export type LabelKey = keyof typeof ALL_LABELS;

/** Bundled default per key (DES-MEETUP-FEEDBACK-001 AD-7). */
export const FALLBACK_LABELS: LabelMap = ALL_LABELS;
