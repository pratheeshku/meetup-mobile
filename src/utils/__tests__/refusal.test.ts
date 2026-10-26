/** teams-payments AD-1: every refusal shows its own label; the generic one is for a system fault only; a server detail is never shown. */
import { classifyRefusal, refusalText } from '../refusal';
import { classifyRegistrationError } from '../registration';
import { currentT } from '../../labels/LabelsContext';

const body = (status: number, data: Record<string, unknown>) => ({ response: { status, data } });

describe('classifyRefusal', () => {
  it.each([
    ['NOT_TEAM_MEMBER', 403, 'mob.reg.err.not_team_member'],
    ['TEAM_NOT_FOUND', 404, 'mob.reg.err.team_not_found'],
    ['USER_MISMATCH', 403, 'mob.reg.err.user_mismatch'],
    ['TEAM_NAME_TAKEN', 409, 'mob.reg.err.team_name_taken'],
    ['SPORT_MISMATCH', 400, 'mob.reg.err.sport_mismatch'],
    ['POINTS_LOCKED', 409, 'mob.reg.err.points_locked'],
    ['POINTS_OUT_OF_BOUNDS', 422, 'mob.reg.err.points_out_of_bounds'],
    ['PAYMENT_NUMBER_REQUIRED', 422, 'mob.reg.err.payment_number_required'],
    ['FEE_INVALID', 422, 'mob.reg.err.fee_invalid'],
    ['NO_FEE', 409, 'mob.reg.err.no_fee'],
    ['WITHDRAWAL_CLOSED', 409, 'mob.reg.err.withdrawal_closed'],
    ['COMMITTEE_ADD_CLOSED', 409, 'mob.reg.err.committee_add_closed'],
  ] as const)('%s -> its own label, not a system fault', (code, status, key) => {
    const refusal = classifyRefusal(body(status, { detail: 'raw server text', code }));
    expect(refusal.labelKey).toBe(key);
    expect(refusal.isSystemFault).toBe(false);
  });

  it('401 and 403 without a code are "You cannot do this", 404 is "Not found", 429 is its own label', () => {
    expect(classifyRefusal(body(401, {})).labelKey).toBe('mob.reg.err.forbidden');
    expect(classifyRefusal(body(403, { detail: 'Forbidden' })).labelKey).toBe('mob.reg.err.forbidden');
    expect(classifyRefusal(body(404, { detail: 'Not found' })).labelKey).toBe('mob.reg.err.not_found');
    expect(classifyRefusal(body(429, { error: 'rate limit exceeded' })).labelKey).toBe('mob.reg.err.rate_limited');
  });

  it('INTERNAL_ERROR, a 500, a network failure and an unreadable body are the generic label (a system fault)', () => {
    for (const error of [body(500, { code: 'INTERNAL_ERROR', detail: 'Something went wrong' }), body(502, {}), new Error('Network Error'), null, undefined, { response: {} }]) {
      const refusal = classifyRefusal(error);
      expect(refusal.labelKey).toBe('mob.reg.err.generic');
      expect(refusal.isSystemFault).toBe(true);
    }
  });

  it('a screen that is not a registration passes its own generic label', () => {
    expect(classifyRefusal(body(500, {}), 'mob.reg.err.internal_error').labelKey).toBe('mob.reg.err.internal_error');
  });

  it('an unknown code on a 4xx is generic, never the server detail', () => {
    const refusal = classifyRefusal(body(409, { code: 'SOMETHING_NEW', detail: 'Python said no' }));
    expect(refusal.labelKey).toBe('mob.reg.err.generic');
  });

  it('TEAM_SIZE_INVALID fills {range} from min and max', () => {
    const refusal = classifyRefusal(body(409, { code: 'TEAM_SIZE_INVALID', min: 2, max: 4 }));
    expect(refusal.labelParams).toEqual({ range: '2 to 4' });
    expect(currentT(refusal.labelKey, refusal.labelParams)).toBe('This tournament team needs 2 to 4 players to register. Change its players and try again.');
    expect(classifyRefusal(body(409, { code: 'TEAM_SIZE_INVALID', min: 3, max: 3 })).labelParams).toEqual({ range: '3' });
  });

  it('FEE_CHANGED and FEE_ACK_REQUIRED carry the current fee', () => {
    expect(classifyRefusal(body(409, { code: 'FEE_CHANGED', registration_fee_cents: 2500 })).currentFeeCents).toBe(2500);
    expect(classifyRefusal(body(409, { code: 'FEE_ACK_REQUIRED', registration_fee_cents: 1000 })).currentFeeCents).toBe(1000);
  });

  it('refusalText never contains the server detail', () => {
    const text = refusalText(body(409, { code: 'TEAM_NAME_TAKEN', detail: 'duplicate key value violates unique constraint' }), currentT);
    expect(text).toBe('A tournament team with this name already exists for this sport. Choose another name.');
  });
});

describe('classifyRegistrationError (teams-payments)', () => {
  it('NOT_TEAM_MEMBER offers "Choose team" and no retry; the message is the seeded one', () => {
    const failure = classifyRegistrationError(body(403, { code: 'NOT_TEAM_MEMBER' }));
    expect(failure.chooseTeamLink).toBe(true);
    expect(failure.canRetry).toBe(false);
    expect(currentT(failure.labelKey)).toMatch(/not a player on this tournament team/);
  });
});
