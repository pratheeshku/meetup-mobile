/**
 * Review step and Created view show date AND time (Task 3.1): start, end, soft block, hard block and the
 * Created timeline all go through formatDayTime. Expected text is built with the same formatter on the same
 * local value, so the test holds in any locale and time zone; the date-only form must not be what is shown.
 */
import React from 'react';

import { initialWizardState, toDate } from '../../../../utils/tournamentWizard';
import { createdResult } from '../../../../test-utils/tournamentWizardFixtures';
import { render, texts } from '../../../../test-utils/render';
import CreatedView from '../CreatedView';
import ReviewStep from '../ReviewStep';
import RegistrationStep, { formatDay, formatDayTime } from '../RegistrationStep';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const pad = (n: number): string => String(n).padStart(2, '0');
const local = (day: number, hour: number, minute = 0): string => `2030-11-${pad(day)} ${pad(hour)}:${pad(minute)}`;

function reviewTexts(state: ReturnType<typeof initialWizardState>): string[] {
  const root = render(<ReviewStep state={state} venueLabel="Punggol Hall" onEdit={() => undefined} />);
  return texts(root);
}

describe('ReviewStep date and time', () => {
  it('shows start, end, soft block and hard block with their times', () => {
    const state = {
      ...initialWizardState('req-1', 'badminton'),
      startsAt: local(22, 9, 30),
      endsAt: local(22, 18, 45),
      closesAt: local(20, 21, 15),
      hardBlockAt: local(21, 7, 5),
    };
    const out = reviewTexts(state);
    const fmt = (v: string): string => formatDayTime(toDate(v) as Date);
    expect(out).toContain(`${fmt(state.startsAt)} to ${fmt(state.endsAt)} · Punggol Hall`);
    expect(out).toContain(`${fmt(state.closesAt)} / ${fmt(state.hardBlockAt)}`);
    // The time part is really there, not just a date.
    expect(fmt(state.startsAt)).not.toBe(formatDay(toDate(state.startsAt) as Date));
    expect(out.join(' ')).not.toContain(`${formatDay(toDate(state.startsAt) as Date)} to ${formatDay(toDate(state.endsAt) as Date)} ·`);
  });

  it('keeps the dash for empty values', () => {
    const out = reviewTexts({ ...initialWizardState('req-2', 'badminton'), startsAt: '', endsAt: '', closesAt: '', hardBlockAt: '' });
    expect(out).toContain('– to – · Punggol Hall');
    expect(out).toContain('– / –');
  });
});

describe('CreatedView date and time', () => {
  it('shows the time on the subtitle and on each timeline row', () => {
    const result = createdResult({
      registration_closes_at: '2030-11-20T13:15:00Z',
      registration_hard_block_at: '2030-11-21T07:05:00Z',
      starts_at: '2030-11-22T01:30:00Z',
    });
    const out = texts(render(<CreatedView result={result} hasInvitedCommittee={false} onOpen={() => undefined} />));
    const fmt = (iso: string): string => formatDayTime(new Date(iso));
    expect(out).toContain(`Registration is open until ${fmt(result.registration_closes_at)}.`);
    expect(out).toContain(`Now to ${fmt(result.registration_closes_at)}`);
    expect(out).toContain(fmt(result.registration_hard_block_at));
    expect(out).toContain(fmt(result.starts_at));
    expect(fmt(result.starts_at)).not.toBe(formatDay(new Date(result.starts_at)));
  });
});

describe('RegistrationStep "So far" date and time', () => {
  it('shows the time on the soft and hard block rows', () => {
    const state = {
      ...initialWizardState('req-1', 'badminton'),
      closesAt: local(20, 21, 15),
      hardBlockAt: local(21, 7, 5),
      startsAt: local(22, 9, 30),
    };
    const out = texts(render(<RegistrationStep state={state} now={new Date(2030, 10, 1)} onClosure={() => undefined} onHardBlock={() => undefined} errors={{}} />));
    expect(out).toContain(formatDayTime(toDate(state.closesAt) as Date));
    expect(out).toContain(formatDayTime(toDate(state.hardBlockAt) as Date));
    expect(formatDayTime(toDate(state.closesAt) as Date)).not.toBe(formatDay(toDate(state.closesAt) as Date));
  });
});
