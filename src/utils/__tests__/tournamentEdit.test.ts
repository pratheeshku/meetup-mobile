import type { Tournament } from '../../types/tournament';
import { canOfferEdit, editErrorLabel, editResetsFixtures, fixturesExist, initialEditForm, planEdit } from '../tournamentEdit';

const base = {
  id: 't-1',
  name: 'Open',
  description: 'A cup',
  starts_at: '2030-01-10T01:00:00.000Z',
  ends_at: '2030-01-10T10:00:00.000Z',
  registration_closes_at: '2030-01-05T01:00:00.000Z',
  registration_hard_block_at: '2030-01-08T01:00:00.000Z',
  lifecycle_version: 2,
  lifecycle_status: 'active',
  status: 'upcoming',
  venue_name: 'Hall',
  venue_address: '1 Way',
} as unknown as Tournament;
const now = new Date('2029-12-01T00:00:00Z');

describe('planEdit (AD-3: changed fields only, ISO UTC)', () => {
  it('sends nothing for an untouched form', () => {
    const plan = planEdit(base, initialEditForm(base), { catalogueEnabled: false, now });
    expect(plan.hasChanges).toBe(false);
    expect(plan.body).toEqual({});
  });

  it('a deadline-only change sends that date alone and no withdrawal flag', () => {
    const form = { ...initialEditForm(base), closesAt: '2030-01-06 09:00' };
    const plan = planEdit(base, form, { catalogueEnabled: false, now });
    expect(Object.keys(plan.body)).toEqual(['registration_closes_at']);
    expect(plan.placeChanged).toBe(false);
    expect(plan.body.registration_closes_at).toBe(new Date(2030, 0, 6, 9, 0).toISOString());
  });

  it('a venue change counts as a place change and carries the withdrawal choice', () => {
    const form = { ...initialEditForm(base), venueName: 'New hall', venueAddress: '2 Way', venueTouched: true };
    const plan = planEdit(base, form, { catalogueEnabled: false, now });
    expect(plan.body).toEqual({ venue_name: 'New hall', venue_address: '2 Way', registrants_may_withdraw: true });
    expect(plan.placeChanged).toBe(true);
  });

  it('an emptied date box is not sent, and a past changed date is flagged', () => {
    const emptied = planEdit(base, { ...initialEditForm(base), hardBlockAt: '' }, { catalogueEnabled: false, now });
    expect(emptied.hasChanges).toBe(false);
    const past = planEdit(base, { ...initialEditForm(base), closesAt: '2029-11-01 09:00' }, { catalogueEnabled: false, now });
    expect(past.pastDate).toBe('registration_closes_at');
  });
});

describe('fixtures and entry points', () => {
  it('fixtures exist from the status or the published time; a reset applies to a place or block-date change only', () => {
    expect(fixturesExist(base)).toBe(false);
    const drafted = { ...base, status: 'schedule_draft' } as unknown as Tournament;
    expect(fixturesExist(drafted)).toBe(true);
    const form = initialEditForm(drafted);
    expect(editResetsFixtures(drafted, planEdit(drafted, { ...form, title: 'x' }, { catalogueEnabled: false, now }))).toBe(false);
    expect(editResetsFixtures(drafted, planEdit(drafted, { ...form, hardBlockAt: '2030-01-09 09:00' }, { catalogueEnabled: false, now }))).toBe(true);
  });

  it('the edit entry is for the organizer of a version 2 tournament that has not started', () => {
    expect(canOfferEdit(base, true, now)).toBe(true);
    expect(canOfferEdit(base, false, now)).toBe(false);
    expect(canOfferEdit({ ...base, lifecycle_version: 1 } as Tournament, true, now)).toBe(false);
    expect(canOfferEdit(base, true, new Date('2030-02-01T00:00:00Z'))).toBe(false);
  });
});

describe('editErrorLabel', () => {
  const err = (status: number, data: Record<string, unknown>) => ({ response: { status, data } });
  it('uses the reason of TOURNAMENT_DATES_INVALID', () => {
    expect(editErrorLabel(err(422, { code: 'TOURNAMENT_DATES_INVALID', reason: 'DATE_IN_PAST', field: 'starts_at' }), '').key).toBe('mob.tw.err_window');
    expect(editErrorLabel(err(422, { code: 'TOURNAMENT_DATES_INVALID', reason: 'REG_CLOSE_AFTER_HARD', field: 'registration_closes_at' }), '').key).toBe('mob.tw.dates_err_soft_after_hard');
  });
  it('maps the other server codes through the refusal table', () => {
    expect(editErrorLabel(err(409, { code: 'TOURNAMENT_STARTED' }), '').key).toBe('mob.reg.err.tournament_started');
    expect(editErrorLabel(err(409, { code: 'TOURNAMENT_HAS_RESULTS' }), '').key).toBe('mob.reg.err.tournament_has_results');
    expect(editErrorLabel(err(422, { code: 'REGISTRATION_DATES_REQUIRED' }), '').key).toBe('mob.reg.err.registration_dates_required');
    expect(editErrorLabel(err(500, {}), '').key).toBe('web.edit_tournament.failed_to_update_tournament');
  });
});
