/**
 * Joining a game that has a fee (DES-MEETUP-ADDENDUM-teams-payments AD-8): the same confirmation sheet and result pop-up as a tournament, "per player".
 * `begin()` opens the sheet; Confirm runs the caller's join (RSVP going, or the invitation Accept) with `accepted_fee_cents` once per user action
 * (one `withCorrelationId()`); the pop-up reports success (with the number to pay to) or the label for the server `code`.
 *
 * - FEE_CHANGED and FEE_ACK_REQUIRED (409) carry the current fee: the sheet takes it and asks again, no result pop-up.
 * - A free game never opens the sheet: the caller joins directly, exactly as before (old apps keep working).
 * - The payee number comes from the fresh game (`my_participation`, only for a participant who is going), never from the join answer.
 */
import React, { useCallback, useRef, useState } from 'react';

import { withCorrelationId } from '../api/correlationId';
import { RegistrationConfirmSheet, RegistrationResultPopup, type RegistrationPaymentInfo } from '../components/tournament/RegistrationDialogs';
import { useT } from '../labels/LabelsContext';
import type { Event } from '../types/event';
import { isNotFoundError } from '../utils/apiError';
import { formatMoney, hasFee } from '../utils/money';
import { classifyRefusal } from '../utils/refusal';
import { classifyRegistrationError, type RegistrationFailure } from '../utils/registration';

export interface GameFeeTarget {
  name: string;
  feeCents: number;
  currency: string;
}

/** The fee a game asks of a joining player: whole cents above 0 with a currency to show it in. Null for a free game or one whose fee cannot be shown. */
export function gameFeeTarget(event: Pick<Event, 'title' | 'registration_fee_cents' | 'registration_fee_currency'>): GameFeeTarget | null {
  const cents = event.registration_fee_cents;
  const currency = event.registration_fee_currency;
  return hasFee(cents) && currency ? { name: event.title, feeCents: cents, currency } : null;
}

type Phase =
  | { kind: 'closed' }
  | { kind: 'confirm'; notice: string | null }
  | { kind: 'result'; failure: RegistrationFailure | null; payment: RegistrationPaymentInfo | null; waitlisted: boolean };

interface Options {
  /** The join itself (RSVP going or invitation Accept) with the fee the person confirmed. Throws the axios error on refusal. */
  join: (acceptedFeeCents: number, correlationId: string) => Promise<void>;
  /** Refetches the game under the same correlation id and returns it. */
  reload: (correlationId: string) => Promise<Event | void>;
  onNotFound: () => void;
}

export interface GameFeeJoin {
  begin: (target: GameFeeTarget) => void;
  /** Render this once in the host. */
  element: React.JSX.Element | null;
}

export function useGameFeeJoin(options: Options): GameFeeJoin {
  const t = useT();
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const [target, setTarget] = useState<GameFeeTarget | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'closed' });
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const close = useCallback(() => {
    setPhase({ kind: 'closed' });
    setTarget(null);
  }, []);

  const begin = useCallback((next: GameFeeTarget) => {
    setTarget(next);
    setPhase({ kind: 'confirm', notice: null });
  }, []);

  const submit = useCallback(async (): Promise<void> => {
    if (!target || inFlight.current) {
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      await withCorrelationId(async correlationId => {
        await optionsRef.current.join(target.feeCents, correlationId);
        let fresh: Event | undefined;
        try {
          const result = await optionsRef.current.reload(correlationId);
          fresh = result ? result : undefined;
        } catch (error) {
          if (isNotFoundError(error)) {
            optionsRef.current.onNotFound();
          }
        }
        const mine = fresh?.my_participation ?? null;
        const going = mine?.status === 'going';
        const cents = mine?.effective_fee_cents ?? mine?.fee_cents_at_join ?? target.feeCents;
        setPhase({
          kind: 'result',
          failure: null,
          waitlisted: mine?.status === 'waitlisted',
          payment: going
            ? { amount: formatMoney(hasFee(cents) ? cents : target.feeCents, target.currency), number: mine?.payment_contact_number ?? fresh?.payment_contact_number ?? null }
            : null,
        });
      });
    } catch (error) {
      if (isNotFoundError(error)) {
        close();
        optionsRef.current.onNotFound();
        return;
      }
      const refusal = classifyRefusal(error);
      if ((refusal.code === 'FEE_CHANGED' || refusal.code === 'FEE_ACK_REQUIRED') && refusal.currentFeeCents !== null) {
        const fee = refusal.currentFeeCents;
        // A fee that dropped to 0 needs no confirmation: the sheet asks once more with the amount the server now holds.
        setTarget(previous => (previous ? { ...previous, feeCents: fee } : previous));
        setPhase({ kind: 'confirm', notice: t(refusal.labelKey) });
      } else {
        setPhase({ kind: 'result', failure: classifyRegistrationError(error), payment: null, waitlisted: false });
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [target, close, t]);

  if (!target || phase.kind === 'closed') {
    return { begin, element: null };
  }
  const feeValue = t('mob.pay.per_player', { amount: formatMoney(target.feeCents, target.currency) });
  const element =
    phase.kind === 'confirm' ? (
      <RegistrationConfirmSheet
        title={t('mob.game_fee.sheet_title', { name: target.name })}
        subtitle={t('mob.game_fee.sheet_sub')}
        entryLabel={null}
        feeValue={feeValue}
        paymentNote={t('mob.pay.sheet_note_game')}
        feeReadable
        notice={phase.notice}
        busy={busy}
        onConfirm={submit}
        onCancel={close}
      />
    ) : (
      <RegistrationResultPopup
        title={phase.failure ? undefined : t(phase.waitlisted ? 'mob.game_fee.waitlisted_title' : 'mob.game_fee.joined_title')}
        subtitle={t('mob.reg.result_sub', { name: target.name, fee: feeValue })}
        failure={phase.failure}
        payment={phase.payment}
        onRetry={() => {
          setPhase({ kind: 'confirm', notice: null });
          submit();
        }}
        onSkillLevel={close}
        onChooseTeam={close}
        onClose={close}
      />
    );
  return { begin, element };
}
