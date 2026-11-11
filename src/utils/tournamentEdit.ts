/**
 * Pure helpers of the Edit tournament screen (DES-MEETUP-ADDENDUM-tournament-edit-recurring AD-3, AD-6; A38 board of record).
 * The form holds local date-times ("YYYY-MM-DD HH:mm", the picker's format); the request holds only the fields that changed, dates as ISO UTC.
 * The future-date check is UX only: the server (`TOURNAMENT_DATES_INVALID`, reason `DATE_IN_PAST`) is the authority.
 */
import type { LabelKey } from '../labels/fallbackLabels';
import type { Tournament, TournamentEditBody, TournamentParticipationMode } from '../types/tournament';
import type { OthersVenueInput } from '../types/venue';
import { formatLocalDateTime } from './localDateTime';
import { classifyRefusal } from './refusal';
import {
  FALLBACK_RANGE_HINTS,
  FALLBACK_TEAM_SIZE_DEFAULT,
  dateFailureIssue,
  toDate,
  type DateField,
  type DateReason,
  type WizardRangeHints,
  type WizardVenue,
} from './tournamentWizard';

export interface TournamentEditForm {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  closesAt: string;
  hardBlockAt: string;
  /** Catalogue picker value (the venue picker is on); null until one is chosen. */
  venue: WizardVenue | null;
  /** Catalogue-off venue text. */
  venueName: string;
  venueAddress: string;
  /** True once the organizer touched the venue: only then is a venue sent. */
  venueTouched: boolean;
  /** team-size-capacity AD-5: sport, who plays, players per team and maximum participants. */
  sport: string;
  participation: TournamentParticipationMode;
  teamSize: number;
  capacity: number;
  /** The per-edit withdrawal choice. Always starts true: the stored flag is not in the response (A40, OI-15). */
  mayWithdraw: boolean;
}

/** An ISO instant as the picker's local "YYYY-MM-DD HH:mm"; '' when absent or unreadable. */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : formatLocalDateTime(date);
}

export function initialEditForm(tournament: Tournament): TournamentEditForm {
  const venueName = tournament.venue_name || tournament.venue_label || tournament.venue_snapshot?.name || '';
  return {
    title: tournament.name,
    description: tournament.description ?? '',
    startsAt: isoToLocalInput(tournament.starts_at),
    endsAt: isoToLocalInput(tournament.ends_at),
    closesAt: isoToLocalInput(tournament.registration_closes_at),
    hardBlockAt: isoToLocalInput(tournament.registration_hard_block_at),
    venue: venueName
      ? {
          venueId: tournament.venue_id ?? null,
          name: venueName,
          address: tournament.venue_address ?? '',
          lat: tournament.venue_lat ?? null,
          lng: tournament.venue_lng ?? null,
        }
      : null,
    venueName,
    venueAddress: tournament.venue_address ?? '',
    venueTouched: false,
    sport: tournament.sport,
    participation: tournament.participation_mode ?? 'individual',
    teamSize: tournament.team_size ?? FALLBACK_TEAM_SIZE_DEFAULT,
    capacity: tournament.max_participants,
    mayWithdraw: true,
  };
}

/**
 * Registered entrants (the server's `registered_count`). Sport, who plays and players per team lock at the first registration
 * (AD-5); unknown (null) counts as none, and the server's refusal then shows if it was wrong.
 */
export function registeredCountOf(tournament: Tournament): number {
  return tournament.participant_count ?? 0;
}

const DATE_FIELDS: { field: DateField; form: keyof TournamentEditForm; original: (t: Tournament) => string | null | undefined }[] = [
  { field: 'starts_at', form: 'startsAt', original: t => t.starts_at },
  { field: 'ends_at', form: 'endsAt', original: t => t.ends_at },
  { field: 'registration_closes_at', form: 'closesAt', original: t => t.registration_closes_at },
  { field: 'registration_hard_block_at', form: 'hardBlockAt', original: t => t.registration_hard_block_at },
];

export interface EditPlan {
  body: TournamentEditBody;
  /** The date fields that changed. */
  changedDates: DateField[];
  /** A start, end or venue change: the withdrawal choice rides with it and the registration dates may be required. */
  placeChanged: boolean;
  /** The capacity, sport or who plays changed: the server resets existing fixtures (AD-5). */
  structureChanged: boolean;
  /** True when the request would change something. */
  hasChanges: boolean;
  /** A changed date that is not in the future (UX hint; the server decides). */
  pastDate: DateField | null;
}

/**
 * The request for what changed, the way the web builds it (`submitEditTournamentV2`): a date is sent only when it differs from the stored one
 * to the minute; an emptied box is "not sent"; the venue only when touched; `registrants_may_withdraw` with a start, end or venue change, or
 * when switched off.
 */
export function planEdit(
  tournament: Tournament,
  form: TournamentEditForm,
  options: { catalogueEnabled: boolean; now: Date },
): EditPlan {
  const body: TournamentEditBody = {};
  if (form.title.trim() !== tournament.name) {
    body.title = form.title.trim();
  }
  if (form.description.trim() !== (tournament.description ?? '').trim()) {
    body.description = form.description.trim();
  }
  const changedDates: DateField[] = [];
  let pastDate: DateField | null = null;
  for (const entry of DATE_FIELDS) {
    const value = String(form[entry.form] ?? '').trim();
    if (!value || value === isoToLocalInput(entry.original(tournament))) {
      continue;
    }
    const date = toDate(value);
    if (!date) {
      continue;
    }
    body[entry.field] = date.toISOString();
    changedDates.push(entry.field);
    if (pastDate === null && date.getTime() <= options.now.getTime()) {
      pastDate = entry.field;
    }
  }
  let venueChanged = false;
  if (form.venueTouched) {
    if (options.catalogueEnabled && form.venue) {
      venueChanged = true;
      if (form.venue.othersInput) {
        body.others = form.venue.othersInput as OthersVenueInput;
      } else if (form.venue.venueId) {
        body.venue_id = form.venue.venueId;
      }
    } else if (!options.catalogueEnabled && form.venueName.trim()) {
      venueChanged = true;
      body.venue_name = form.venueName.trim();
      body.venue_address = form.venueAddress.trim();
    }
  }
  // team-size-capacity AD-5. Capacity is editable until the start; sport, mode and team size only while nothing is registered
  // (locked fields are never sent). The server decides everything: nothing here refuses.
  let structureChanged = false;
  if (Number.isInteger(form.capacity) && form.capacity !== tournament.max_participants) {
    body.capacity = form.capacity;
    structureChanged = true;
  }
  if (registeredCountOf(tournament) === 0) {
    if (form.sport && form.sport !== tournament.sport) {
      body.sport = form.sport;
      structureChanged = true;
    }
    const originalMode = tournament.participation_mode ?? 'individual';
    if (form.participation !== originalMode) {
      body.participation_mode = form.participation;
      structureChanged = true;
      if (form.participation === 'team') {
        body.team_size = form.teamSize;
      }
    } else if (form.participation === 'team' && form.teamSize !== (tournament.team_size ?? null)) {
      body.team_size = form.teamSize;
    }
  }
  const placeChanged = changedDates.includes('starts_at') || changedDates.includes('ends_at') || venueChanged;
  const hasChanges = Object.keys(body).length > 0;
  if (hasChanges && (placeChanged || !form.mayWithdraw)) {
    body.registrants_may_withdraw = form.mayWithdraw;
  }
  return { body, changedDates, placeChanged, structureChanged, hasChanges, pastDate };
}

/** The generated fixtures exist (a draft or a published set): the same facts the web reads (`schedule_draft`, `published`). */
export function fixturesExist(tournament: Tournament): boolean {
  return Boolean(tournament.schedule_published_at) || ['schedule_draft', 'published'].includes(String(tournament.status));
}

/** True when the edit moves a fixture input (start, end, venue, or a block date): the server resets the fixtures and the screen warns first. */
export function editResetsFixtures(tournament: Tournament, plan: EditPlan): boolean {
  return (
    fixturesExist(tournament) &&
    (plan.placeChanged ||
      plan.structureChanged || plan.changedDates.includes('registration_closes_at') || plan.changedDates.includes('registration_hard_block_at'))
  );
}

/** The edit entry is offered to the organizer of a version 2 tournament that has not started (AD-3; UX only, the server answers 403 or 409). */
export function canOfferEdit(tournament: Tournament, isOrganiser: boolean, now: Date): boolean {
  if (!isOrganiser || tournament.lifecycle_version !== 2) {
    return false;
  }
  if (tournament.lifecycle_status && tournament.lifecycle_status !== 'active') {
    return false;
  }
  const start = Date.parse(tournament.starts_at);
  return Number.isNaN(start) ? false : start > now.getTime();
}

export interface EditErrorLabel {
  key: LabelKey;
  params?: Record<string, string | number>;
}

interface ErrorLike {
  response?: { status?: number; data?: { code?: unknown; reason?: unknown; field?: unknown } };
}

/**
 * The label of a refused edit. `TOURNAMENT_DATES_INVALID` uses its `reason` and `field` (DATE_IN_PAST included) through the date messages the
 * create wizard already has; the other server codes (`REGISTRATION_DATES_REQUIRED`, `TOURNAMENT_HAS_RESULTS`, `TOURNAMENT_STARTED`, ...)
 * go through the one refusal table. The server's `detail` is never shown. The team-size-capacity codes (AD-5): `CAPACITY_BELOW_REGISTERED`
 * shows the registered count the screen already holds from the server; `TEAM_SIZE_INVALID` and `OVERRIDE_OUTSIDE_LIMITS` show the stepper range.
 */
export function editErrorLabel(
  error: unknown,
  startLabel: string,
  options: { registered?: number; hints?: WizardRangeHints } = {},
): EditErrorLabel {
  const data = (error as ErrorLike | null)?.response?.data;
  const hints = options.hints ?? FALLBACK_RANGE_HINTS;
  if (data?.code === 'CAPACITY_BELOW_REGISTERED' && typeof options.registered === 'number') {
    return { key: 'mob.reg.err.capacity_below_registered', params: { count: options.registered } };
  }
  if (data?.code === 'TEAM_SIZE_INVALID') {
    return { key: 'mob.tw.err_team_size', params: { ...hints.teamSize } };
  }
  if (data?.code === 'OVERRIDE_OUTSIDE_LIMITS') {
    const forTeamSize = typeof data.field === 'string' && data.field.startsWith('team_size');
    return forTeamSize
      ? { key: 'mob.tw.err_team_size', params: { ...hints.teamSize } }
      : { key: 'mob.tw.err_entrants_range', params: { ...hints.entrants } };
  }
  if (data?.code === 'TOURNAMENT_DATES_INVALID' && typeof data.reason === 'string' && typeof data.field === 'string') {
    const issue = dateFailureIssue({ field: data.field as DateField, reason: data.reason as DateReason }, { startLabel });
    return { key: issue.key, ...(issue.params ? { params: issue.params } : {}) };
  }
  return { key: classifyRefusal(error, 'web.edit_tournament.failed_to_update_tournament').labelKey };
}
