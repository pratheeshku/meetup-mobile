/** Wizard fee field (tournament-registration AD-4, OI-10; brief M4): hidden with the flag, whole cents 0..max, sent as registration_fee_cents. */
import {
  FALLBACK_LIMITS,
  WIZARD_STEP,
  buildCreateBody,
  firstFocusField,
  initialWizardState,
  mapCreateRejection,
  needsPayeeNumber,
  validateFee,
  validatePayee,
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
    expect(validateFee(state({ feeAmount: '' }), FEE)).toBeNull();
    expect(validateFee(state({ feeAmount: 'abc' }), null)).toBeNull();
  });

  it.each(['0', '1', '15', '15.5', '15.50', '1000.00'])('%s is accepted', value => {
    expect(validateFee(state({ feeAmount: value }), FEE)).toBeNull();
  });

  it.each(['1000.01', '-5', '15.005', '1e3', 'abc', '15,00', '1 5'])('%s is refused on the registration step, under the fee field, with the maximum as an amount', value => {
    const issue = validateFee(state({ feeAmount: value }), FEE);
    expect(issue).toMatchObject({ key: 'mob.tw.fee_error', field: 'registration_fee_cents', step: WIZARD_STEP.registration });
    expect(String(issue?.params?.max)).toMatch(/1,?000\.00/);
  });

  it('is part of the registration step only while the flag is on', () => {
    const bad = state({ feeAmount: '99999' });
    expect(validateStep(WIZARD_STEP.registration, bad, ctx(FEE)).map(i => i.field)).toContain('registration_fee_cents');
    expect(validateStep(WIZARD_STEP.registration, bad, ctx(null)).map(i => i.field)).not.toContain('registration_fee_cents');
  });
});

describe('request body', () => {
  it('sends the typed amount as whole cents while the flag is on', () => {
    expect(buildCreateBody(state({ feeAmount: '15' }), false, true).registration_fee_cents).toBe(1500);
    expect(buildCreateBody(state({ feeAmount: '15.5' }), false, true).registration_fee_cents).toBe(1550);
    expect(buildCreateBody(state({ feeAmount: '0' }), false, true).registration_fee_cents).toBe(0);
  });

  it('omits it when empty, when the flag is off, or by default (an unchanged call keeps its old body)', () => {
    expect(buildCreateBody(state({ feeAmount: '' }), false, true)).not.toHaveProperty('registration_fee_cents');
    expect(buildCreateBody(state({ feeAmount: '15' }), false, false)).not.toHaveProperty('registration_fee_cents');
    expect(buildCreateBody(state({ feeAmount: '15' }), false)).not.toHaveProperty('registration_fee_cents');
  });
});

describe('server refusal and focus', () => {
  it('422 FEE_INVALID goes back to the registration step with the fee error', () => {
    const outcome = mapCreateRejection(
      { response: { status: 422, data: { code: 'FEE_INVALID', field: 'registration_fee_cents', step: 3, detail: 'x' } } },
      { committeeMax: 10, startLabel: '', feeMaxText: 'S$1,000.00' },
    );
    expect(outcome).toMatchObject({ kind: 'step', step: WIZARD_STEP.registration, issue: { key: 'mob.tw.fee_error', field: 'registration_fee_cents', params: { max: 'S$1,000.00' } } });
  });

  it('focus lands on the fee field when it has the error', () => {
    expect(firstFocusField(WIZARD_STEP.registration, { registration_fee_cents: 'x' })).toBe('registration_fee_cents');
  });
});

describe('payee number (teams-payments AD-7)', () => {
  const withFee = (over: Partial<WizardState> = {}): WizardState => state({ feeAmount: '15', ...over });

  it('is asked for only while the flag is on and a fee above 0 is typed', () => {
    expect(needsPayeeNumber(withFee(), FEE)).toBe(true);
    expect(needsPayeeNumber(withFee({ feeAmount: '0' }), FEE)).toBe(false);
    expect(needsPayeeNumber(withFee({ feeAmount: '' }), FEE)).toBe(false);
    expect(needsPayeeNumber(withFee(), null)).toBe(false);
  });

  it('a fee above 0 without a number is refused on the registration step with the server label, under the number field', () => {
    expect(validatePayee(withFee(), FEE)).toMatchObject({ key: 'mob.reg.err.payment_number_required', field: 'payment_contact_number', step: WIZARD_STEP.registration });
    expect(validateStep(WIZARD_STEP.registration, withFee(), ctx(FEE)).map(i => i.field)).toContain('payment_contact_number');
  });

  it('is satisfied by a number, and never asked of a free tournament or with the flag off', () => {
    expect(validatePayee(withFee({ payeeNumber: '+6591234567' }), FEE)).toBeNull();
    expect(validatePayee(withFee({ feeAmount: '' }), FEE)).toBeNull();
    expect(validatePayee(withFee(), null)).toBeNull();
  });

  it('is sent with a fee above 0 and nothing else', () => {
    expect(buildCreateBody(withFee({ payeeNumber: '+6591234567' }), false, true)).toMatchObject({
      registration_fee_cents: 1500,
      payment_contact_number: '+6591234567',
    });
    expect(buildCreateBody(withFee({ feeAmount: '0', payeeNumber: '+6591234567' }), false, true)).not.toHaveProperty('payment_contact_number');
    expect(buildCreateBody(withFee({ feeAmount: '', payeeNumber: '+6591234567' }), false, true)).not.toHaveProperty('payment_contact_number');
    expect(buildCreateBody(withFee({ payeeNumber: '+6591234567' }), false, false)).not.toHaveProperty('payment_contact_number');
  });

  it.each(['PAYMENT_NUMBER_REQUIRED', 'PAYMENT_NUMBER_INVALID'])('422 %s goes back to the registration step under the number field', code => {
    const outcome = mapCreateRejection({ response: { status: 422, data: { code, detail: 'x' } } }, { committeeMax: 10, startLabel: '' });
    expect(outcome).toMatchObject({ kind: 'step', step: WIZARD_STEP.registration, issue: { field: 'payment_contact_number' } });
  });
});
