/** Registration helpers (tournament-registration AD-1, AD-4, AD-5; brief M2, M3, M4): one label per server code, money from cents. */
import { currentT } from '../../labels/LabelsContext';
import { centsToAmountText, formatMoney, hasFee, parseAmountToCents } from '../money';
import { classifyRegistrationError, feeLineFor, teamsForSport } from '../registration';

const body = (status: number, data: Record<string, unknown>) => ({ response: { status, data } });

describe('classifyRegistrationError', () => {
  it.each([
    ['REGISTRATION_CLOSED', 'mob.reg.err.registration_closed'],
    ['SKILL_LEVEL_REQUIRED', 'mob.reg.err.skill_level_required'],
    ['ALREADY_REGISTERED', 'mob.reg.err.already_registered'],
    ['TOURNAMENT_FULL', 'mob.reg.err.tournament_full'],
    ['INVITATION_REQUIRED', 'mob.reg.err.invitation_required'],
    ['TEAM_REQUIRED', 'mob.reg.err.team_required'],
    ['FEE_CHANGED', 'mob.reg.err.fee_changed'],
    ['FEE_ACK_REQUIRED', 'mob.reg.err.fee_ack_required'],
  ] as const)('%s -> %s, retry not offered', (code, key) => {
    const failure = classifyRegistrationError(body(409, { detail: 'raw', code }));
    expect(failure.code).toBe(code);
    expect(failure.labelKey).toBe(key);
    expect(failure.canRetry).toBe(false);
  });

  it('an unknown code, no code, a 500 and a thrown non-HTTP error are all generic, and retry is offered', () => {
    for (const error of [body(409, { code: 'NEW_ONE' }), body(409, { detail: 'x' }), body(500, {}), new Error('network'), null, undefined]) {
      const failure = classifyRegistrationError(error);
      expect(failure.labelKey).toBe('mob.reg.err.generic');
      expect(failure.canRetry).toBe(true);
    }
  });

  it('only SKILL_LEVEL_REQUIRED offers the skill-level link', () => {
    expect(classifyRegistrationError(body(409, { code: 'SKILL_LEVEL_REQUIRED' })).skillLevelLink).toBe(true);
    expect(classifyRegistrationError(body(409, { code: 'TOURNAMENT_FULL' })).skillLevelLink).toBe(false);
  });

  it('FEE_CHANGED carries the current fee from the body; a missing or non-numeric one is null', () => {
    expect(classifyRegistrationError(body(409, { code: 'FEE_CHANGED', registration_fee_cents: 2000 })).currentFeeCents).toBe(2000);
    expect(classifyRegistrationError(body(409, { code: 'FEE_CHANGED', registration_fee_cents: 0 })).currentFeeCents).toBe(0);
    expect(classifyRegistrationError(body(409, { code: 'FEE_CHANGED' })).currentFeeCents).toBeNull();
    expect(classifyRegistrationError(body(409, { code: 'FEE_CHANGED', registration_fee_cents: '2000' })).currentFeeCents).toBeNull();
    expect(classifyRegistrationError(body(409, { code: 'FEE_ACK_REQUIRED', registration_fee_cents: 1500 })).currentFeeCents).toBeNull();
  });

  it('the closure codes keep their own message', () => {
    expect(classifyRegistrationError(body(409, { code: 'tournament_ended' })).labelKey).toBe('mob.closure.game_ended');
  });
});

describe('fee text', () => {
  const t = (key: Parameters<typeof currentT>[0], params?: Record<string, string | number>) => currentT(key, params);

  it('formats whole cents with the currency, never recomputing anything', () => {
    expect(formatMoney(1500, 'SGD')).toMatch(/15\.00/);
    expect(formatMoney(50, 'SGD')).toMatch(/0\.50/);
    expect(formatMoney(1500, 'NOT-A-CODE')).toBe('NOT-A-CODE 15.00');
  });

  it('hasFee: only a number above zero', () => {
    expect([hasFee(1), hasFee(0), hasFee(null), hasFee(undefined), hasFee(NaN)]).toEqual([true, false, false, false, false]);
  });

  it('no fee, zero, or an unreadable currency reads "Free registration"', () => {
    expect(feeLineFor(t, null, 'SGD', 'individual')).toBe('Free registration');
    expect(feeLineFor(t, 0, 'SGD', 'individual')).toBe('Free registration');
    expect(feeLineFor(t, undefined, null, null)).toBe('Free registration');
  });

  it('per player in individual mode, per tournament team in team mode', () => {
    expect(feeLineFor(t, 1500, 'SGD', 'individual')).toMatch(/^Registration fee: .*15\.00 per player$/);
    expect(feeLineFor(t, 1500, 'SGD', null)).toMatch(/per player$/);
    expect(feeLineFor(t, 1500, 'SGD', 'team')).toMatch(/^Registration fee: .*15\.00 per tournament team$/);
  });
});

describe('fee amounts in the currency (brief M3)', () => {
  it.each([
    ['15', 1500],
    ['15.5', 1550],
    ['15.50', 1550],
    ['15.05', 1505],
    ['0', 0],
    ['0.01', 1],
    ['  15  ', 1500],
    ['1000', 100000],
  ])('%s -> %i cents', (text, cents) => {
    expect(parseAmountToCents(text)).toEqual({ valid: true, cents });
  });

  it('an empty field is no fee (null), not zero', () => {
    expect(parseAmountToCents('')).toEqual({ valid: true, cents: null });
    expect(parseAmountToCents('   ')).toEqual({ valid: true, cents: null });
  });

  it.each(['15.005', '-1', '-0.5', '+5', 'abc', '15,50', '1e3', '1 5', '.5', '15.', '15.5.5', '$15'])('%s is rejected', text => {
    expect(parseAmountToCents(text)).toEqual({ valid: false });
  });

  it('a number too large to be a safe integer is rejected', () => {
    expect(parseAmountToCents('9'.repeat(30))).toEqual({ valid: false });
  });

  it('stored cents come back as an editable amount', () => {
    expect(centsToAmountText(1500)).toBe('15.00');
    expect(centsToAmountText(1550)).toBe('15.50');
    expect(centsToAmountText(1)).toBe('0.01');
    expect(parseAmountToCents(centsToAmountText(123456))).toEqual({ valid: true, cents: 123456 });
  });
});

describe('teamsForSport', () => {
  it('keeps the teams of the sport, ignoring case and spaces, in order', () => {
    const teams = [
      { id: 'a', sport: 'Badminton' },
      { id: 'b', sport: 'football' },
      { id: 'c', sport: ' badminton ' },
    ];
    expect(teamsForSport(teams, 'BADMINTON').map(x => x.id)).toEqual(['a', 'c']);
    expect(teamsForSport(teams, 'tennis')).toEqual([]);
  });
});
