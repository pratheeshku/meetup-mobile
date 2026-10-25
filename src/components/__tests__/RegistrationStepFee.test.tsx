/** Wizard registration step, fee field (tournament-registration AD-4, OI-10; brief M4): shown only while the server's fee flag is on. */
import React from 'react';

import { act, render, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { FALLBACK_LIMITS, initialWizardState } from '../../utils/tournamentWizard';
import RegistrationStep from '../tournament/wizard/RegistrationStep';

const NOW = new Date(2026, 9, 14, 9, 0);

function step(props: Partial<React.ComponentProps<typeof RegistrationStep>> = {}): Instance {
  return render(
    <RegistrationStep
      state={{ ...initialWizardState('req-1', 'badminton'), ...(props.state ?? {}) }}
      now={NOW}
      onClosure={jest.fn()}
      onHardBlock={jest.fn()}
      errors={{}}
      {...props}
    />,
  );
}
const byId = (root: Instance, id: string): Instance[] => root.findAll(n => n.props.testID === id && typeof n.type === 'string');

describe('fee field', () => {
  it('is hidden while the server flag is off (no fee config)', () => {
    expect(byId(step({ fee: null, onFee: jest.fn() }), 'tw-fee')).toHaveLength(0);
    expect(byId(step(), 'tw-fee')).toHaveLength(0);
    expect(FALLBACK_LIMITS).toBeDefined();
  });

  it('is shown with the flag on, takes an amount in the currency, and previews it', () => {
    const onFee = jest.fn();
    const root = step({
      fee: { currency: 'SGD', maxCents: 100000 },
      onFee,
      state: { ...initialWizardState('req-1', 'badminton'), feeAmount: '15.00' },
    });
    const field = byId(root, 'tw-fee')[0];
    expect(field.props.keyboardType).toBe('decimal-pad');
    expect(field.props.value).toBe('15.00');
    act(() => field.props.onChangeText('25.5'));
    expect(onFee).toHaveBeenCalledWith('25.5');
    expect(texts(byId(root, 'tw-fee-preview')[0])[0]).toMatch(/^Fee shown to players: .*15\.00$/);
  });

  it('shows the fee error under the field and no preview', () => {
    const root = step({
      fee: { currency: 'SGD', maxCents: 100000 },
      onFee: jest.fn(),
      state: { ...initialWizardState('req-1', 'badminton'), feeAmount: '9999.00' },
      errors: { registration_fee_cents: 'Enter an amount between 0 and S$1,000.00, with at most two decimals.' },
    });
    expect(texts(byId(root, 'tw-fee-error')[0])).toEqual(['Enter an amount between 0 and S$1,000.00, with at most two decimals.']);
    expect(byId(root, 'tw-fee-preview')).toHaveLength(0);
  });
});
