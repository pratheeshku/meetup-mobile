/**
 * Words for a series game (DES-MEETUP-ADDENDUM-tournament-edit-recurring AD-8, Display). Everything shown is `EventResponse.series` as the server
 * sent it: the app never counts occurrences or computes dates; the only work here is formatting a calendar date and choosing a label.
 */
import type { LabelKey } from '../labels/fallbackLabels';
import type { EventSeries } from '../types/event';
import { localDateToDate } from './localDateTime';

type Translate = (key: LabelKey, params?: Record<string, string | number>) => string;

/** A server calendar date ("YYYY-MM-DD") for display; the text itself when it cannot be read. */
export function formatSeriesDate(value: string): string {
  const date = localDateToDate(value);
  return date ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : value;
}

/** "Weekly · {index} of {total}", or "Weekly · game {index}" when the server sent no total; null when it sent no index. */
export function seriesChipText(series: EventSeries, t: Translate): string | null {
  if (series.index === null) {
    return null;
  }
  return series.total === null
    ? t('web.series.chip_open', { index: series.index })
    : t('web.series.chip', { index: series.index, total: series.total });
}

/** "Repeats weekly" or "Repeats every n weeks", then "Ends after N games" or "Ends on {date}" when the rule has an end. */
export function seriesLineText(series: EventSeries, t: Translate): string {
  const repeats = series.interval === 1 ? t('web.series.repeats_weekly') : t('web.series.repeats_every', { n: series.interval });
  if (series.occurrence_limit !== null) {
    return `${repeats} · ${t('web.series.ends_after', { total: series.occurrence_limit })}`;
  }
  if (series.ends_on) {
    return `${repeats} · ${t('web.series.ends_on', { date: formatSeriesDate(series.ends_on) })}`;
  }
  return repeats;
}
