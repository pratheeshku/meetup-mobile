/** Wizard fee field (tournament-registration AD-4, OI-10; brief M4): hidden with the flag, whole cents 0..max, sent as registration_fee_cents. */
import {
  FALLBACK_LIMITS,
  WIZARD_STEP,
  buildCreateBody,
  firstFocusField,
  initialWizardState,
  mapCreateRejection,
  validateFee,
  validateStep,
  type WizardContext,
  type WizardState,
} from '../tournamentWizard';

const NOW = new Date(2026, 9, 14, 9, 0);
const FEE = { currency: 'SGD', maxCents: 100000 };
const ctx = (fee: WizardContext['fee']): WizardContext => ({ limits: FALLBACK_LIMITS, catalogueEnabled: false, now: NOW, formatDayTime: () => 'x', fee });

const at = (month: number, day: number, hour = 9): string =>
  `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:00`;

function state(over: Partial<WizardState> = {}): WizardState {
  return {
    ...initialWizardState('req-1', 'badminton'),
    title: 'Punggol Open',
    startsAt: at(11, 14),
    endsAt: at(11, 15, 18),
    closesAt: at(10, 30),
    hardBlockAt: at(11, 3),
    hardBlockTouched: true,
    venueName: 'Hall',
    committee: [{ id: 'u1', displayName: 'Ravi' }],
    ...over,
  };
}

describe('validateFee', () => {
  it('empty is free; the flag off ignores whatever is typed', () => {
    expect(validateFee(state({ feeCents: '' }), FEE)).toBeNull();
    expect(validateFee(state({ feeCents: 'abc' }), null)).toBeNull();
  });

  it.each(['0', '1', '1500', '100000'])('%s is accepted', value => {
    expect(validateFee(state({ feeCents: value }), FEE)).toBeNull();
  });

  it.each(['100001', '-5', '12.5', '1e3', 'abc', '15,00'])('%s is refused on the registration step, under the fee field', value => {
    const issue = validateFee(state({ feeCents: value }), FEE);
    expect(issue).toMatchObject({ key: 'mob.tw.fee_error', field: 'registration_fee_cents', step: WIZARD_STEP.registration, params: { max: 100000 } });
  });

  it('is part of the registration step only while the flag is on', () => {
    const bad = state({ feeCents: '999999' });
    expect(validateStep(WIZARD_STEP.registration, bad, ctx(FEE)).map(i => i.field)).toContain('registration_fee_cents');
    expect(validateStep(WIZARD_STEP.registration, bad, ctx(null)).map(i => i.field)).not.toContain('registration_fee_cents');
  });
});

describe('request body', () => {
  it('sends registration_fee_cents as a whole number while the flag is on and a fee is typed', () => {
    expect(buildCreateBody(state({ feeCents: '1500' }), false, true).registration_fee_cents).toBe(1500);
    expect(buildCreateBody(state({ feeCents: '0' }), false, true).registration_fee_cents).toBe(0);
  });

  it('omits it when empty, when the flag is off, or by default (an unchanged call keeps its old body)', () => {
    expect(buildCreateBody(state({ feeCents: '' }), false, true)).not.toHaveProperty('registration_fee_cents');
    expect(buildCreateBody(state({ feeCents: '1500' }), false, false)).not.toHaveProperty('registration_fee_cents');
    expect(buildCreateBody(state({ feeCents: '1500' }), false)).not.toHaveProperty('registration_fee_cents');
  });
});

describe('server refusal and focus', () => {
  it('422 FEE_INVALID goes back to the registration step with the fee error', () => {
    const outcome = mapCreateRejection(
      { response: { status: 422, data: { code: 'FEE_INVALID', field: 'registration_fee_cents', step: 3, detail: 'x' } } },
      { committeeMax: 10, startLabel: '', feeMaxCents: 100000 },
    );
    expect(outcome).toMatchObject({ kind: 'step', step: WIZARD_STEP.registration, issue: { key: 'mob.tw.fee_error', field: 'registration_fee_cents', params: { max: 100000 } } });
  });

  it('focus lands on the fee field when it has the error', () => {
    expect(firstFocusField(WIZARD_STEP.registration, { registration_fee_cents: 'x' })).toBe('registration_fee_cents');
  });
});
