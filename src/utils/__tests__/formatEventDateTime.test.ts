/**
 * Regression tests for the "Invalid Date" bug on event end time.
 * `EventResponse.ends_at` is nullable in the live OpenAPI schema; the
 * formatter must show the start time only when there is no usable end time.
 */
import { formatEventTimeRange } from '../formatEventDateTime';

const START = '2026-09-20T10:00:00Z';
const END = '2026-09-20T11:00:00Z';

describe('formatEventTimeRange', () => {
  it('renders "start – end" when an end time is present', () => {
    const result = formatEventTimeRange(START, END);

    expect(result).toContain(' – ');
    expect(result).not.toContain('Invalid Date');
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty string', ''],
    ['unparseable string', 'not-a-date'],
  ])('renders the start time only when ends_at is %s', (_label, endsAt) => {
    const result = formatEventTimeRange(START, endsAt);

    expect(result).not.toContain('Invalid Date');
    expect(result).not.toContain('–');
    expect(result).toBe(formatEventTimeRange(START, END).split(' – ')[0]);
  });
});
