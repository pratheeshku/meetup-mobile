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

  'venue.source.catalogue': 'ActiveSG',
  'venue.source.user': 'Others',
  'venue.search_placeholder': 'Search venues',
  'venue.showing_for_sport': 'Showing venues for {sport}',
  'venue.not_listed_subtitle': 'Not listed? Enter the name and postal code',
  'venue.pin_caption': 'Pin set from the venue address',
  'venue.reselect_prompt': 'Sport changed. Please select a venue again.',

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
  'tournament_visibility.invite': 'Invite',
  'tournament_visibility.group': 'Group',

  'team_visibility.public': 'Public',
  'team_visibility.private': 'Private',

  // COMPLETION SCREENS
  'mob.done.game_created.title': 'Game created',
  'mob.done.game_created.subtitle': 'Your game is live. Here is what you submitted.',
  'mob.done.tournament_created.title': 'Tournament created',
  'mob.done.tournament_created.subtitle': 'Your tournament is set up. Here is what you submitted.',
  'mob.done.team_created.title': 'Tournament team created',
  'mob.done.team_created.subtitle': 'Your tournament team is ready. Here is what you submitted.',
  'mob.done.group_created.title': 'Group created',
  'mob.done.group_created.subtitle': 'Your group is ready. Here is a summary.',
  'mob.done.game_updated.title': 'Game updated',
  'mob.done.game_updated.subtitle': 'Your changes have been saved.',
  'mob.done.group_updated.title': 'Group updated',
  'mob.done.group_updated.subtitle': 'Your changes have been saved.',
  'mob.done.profile_updated.title': 'Profile updated',
  'mob.done.profile_updated.subtitle': 'Your changes have been saved.',
  'mob.done.skills_updated.title': 'Skill levels updated',
  'mob.done.skills_updated.subtitle': 'Your changes have been saved.',
  'mob.done.game_cancelled.title': 'Game cancelled',
  'mob.done.game_cancelled.subtitle': 'This game has been cancelled.',
  'mob.done.tournament_cancelled.title': 'Tournament cancelled',
  'mob.done.tournament_cancelled.subtitle': 'This tournament has been cancelled.',
  'mob.done.group_deleted.title': 'Group deleted',
  'mob.done.group_deleted.subtitle': 'This group has been deleted.',
  'mob.done.group_left.title': 'You left the group',
  'mob.done.group_left.subtitle': 'You are no longer in this group.',
  'mob.done.account_created.title': 'Account verified',
  'mob.done.account_created.subtitle': 'Your account is ready. Sign in to get started.',
  'mob.done.account_deleted.title': 'Account deleted',
  'mob.done.account_deleted.subtitle': 'Your account has been deleted. We are sorry to see you go.',
  'mob.done.onboarding_done.title': 'You are all set',
  'mob.done.onboarding_done.subtitle': 'Here is what you set up.',
  'mob.done.btn_dashboard': 'Back to dashboard',
  'mob.done.btn_groups': 'Back to groups',
  'mob.done.btn_profile': 'Back to profile',
  'mob.done.btn_signin': 'Go to sign in',
  'mob.done.btn_view_game': 'View game',
  'mob.done.btn_view_group': 'View group',
  'mob.done.btn_view_tournament': 'View tournament',
  'mob.done.btn_get_started': 'Get started',
  'mob.done.f_title': 'Title',
  'mob.done.f_sport': 'Sport',
  'mob.done.f_when': 'Date and time',
  'mob.done.f_date': 'Date',
  'mob.done.f_venue': 'Venue',
  'mob.done.f_audience': 'Who can play',
  'mob.done.f_players': 'Players needed',
  'mob.done.f_skill': 'Skill level',
  'mob.done.f_invited': 'Invited players',
  'mob.done.f_name': 'Name',
  'mob.done.f_description': 'Description',
  'mob.done.f_logo': 'Logo',
  'mob.done.f_members': 'Group members added',
  'mob.done.f_format': 'Format',
  'mob.done.f_participation': 'Participation',
  'mob.done.f_visibility': 'Visibility',
  'mob.done.f_display_name': 'Display name',
  'mob.done.f_email': 'Email',
  'mob.done.f_photo': 'Profile photo',
  'mob.done.f_cover': 'Cover image',
  'mob.done.f_mobile': 'Mobile number',
  'mob.done.f_skills': 'Skills',
  'mob.done.f_notifications': 'Notifications',
  'mob.done.f_status': 'Status',
  'mob.done.v_added': 'Added',
  'mob.done.v_updated': 'Updated',
  'mob.done.v_removed': 'Removed',
  'mob.done.v_none': 'None',
  'mob.done.v_saved': 'Saved',
  'mob.done.v_skipped': 'Skipped',
  'mob.done.v_verified': 'Verified',
  'mob.done.v_deleted': 'Deleted',
  'mob.done.v_cancelled': 'Cancelled',
  'mob.done.v_left': 'Left',
  'mob.forgot.sent_to':
    'If an account exists for {email}, we have sent a one-time reset link. Check your inbox and spam folder. The link opens in your browser.',
} as const;

const ALL_LABELS = { ...BASE_LABELS, ...DEFAULT_LABELS };

/** Every label key the app resolves; `t()` only accepts these. */
export type LabelKey = keyof typeof ALL_LABELS;

/** Bundled default per key (DES-MEETUP-FEEDBACK-001 AD-7). */
export const FALLBACK_LABELS: LabelMap = ALL_LABELS;
