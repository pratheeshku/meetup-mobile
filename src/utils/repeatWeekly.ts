/**
 * Repeat weekly on Create game (DES-MEETUP-ADDENDUM-tournament-edit-recurring AD-8; A38 board of record). The screen requires exactly one end
 * rule (the server code is `SERIES_END_INVALID`); no bound is kept on the device: a series that is too long is refused by the server
 * (`SERIES_LIMIT_EXCEEDED`) and the screen shows that labelled message (A29). The weekday is the start date's and is not sent.
 */
import type { LabelKey } from '../labels/fallbackLabels';
import type { CreateEventInput } from '../types/event';

export type RepeatEnd = 'count' | 'date';

export interface RepeatState {
  on: boolean;
  /** Weeks between games, typed text. */
  every: string;
  end: RepeatEnd | null;
  /** Number of games, the first included, typed text. */
  count: string;
  /** Last date, local "YYYY-MM-DD". */
  endDate: string;
}

export const INITIAL_REPEAT: RepeatState = { on: false, every: '1', end: null, count: '', endDate: '' };

const WHOLE = /^\d+$/;

/** The label of the first thing wrong with the control, or null. Off is always valid. */
export function repeatProblem(state: RepeatState): LabelKey | null {
  if (!state.on) {
    return null;
  }
  if (!WHOLE.test(state.every.trim()) || Number(state.every) < 1) {
    return 'web.series.every_invalid';
  }
  if (state.end === 'count') {
    return WHOLE.test(state.count.trim()) && Number(state.count) >= 1 ? null : 'web.series.end_required';
  }
  if (state.end === 'date') {
    return state.endDate ? null : 'web.series.end_required';
  }
  return 'web.series.end_required';
}

/** The recurrence fields of `POST /events`: weekly, the interval and exactly one end rule. Empty when the control is off. */
export function repeatFields(
  state: RepeatState,
): Pick<CreateEventInput, 'recurrence_frequency' | 'recurrence_interval' | 'recurrence_ends_on' | 'recurrence_occurrence_limit'> {
  if (!state.on || repeatProblem(state) !== null) {
    return {};
  }
  return {
    recurrence_frequency: 'weekly',
    recurrence_interval: Number(state.every),
    ...(state.end === 'count' ? { recurrence_occurrence_limit: Number(state.count) } : { recurrence_ends_on: state.endDate }),
  };
}
