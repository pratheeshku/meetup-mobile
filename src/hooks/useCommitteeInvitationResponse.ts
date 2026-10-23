/**
 * Accept or decline a committee seat (tl-c-accept) and refresh the tournament, as ONE user action: one correlation id
 * covers the answer and the re-read (R-113). A second tap while an answer is in flight does nothing. The hook has no
 * view: the screen shows `error`, hides the buttons when the outcome says the invitation is no longer open, and
 * decides where to go after `done`.
 */
import { useCallback, useRef, useState } from 'react';

import { withCorrelationId } from '../api/correlationId';
import { respondToCommitteeInvitation } from '../api/tournaments';
import type { LabelKey } from '../labels/fallbackLabels';
import {
  COMMITTEE_ANSWER_DONE,
  committeeAnswerOutcome,
  type CommitteeAnswerOutcome,
} from '../utils/committeeInvitation';

export interface CommitteeInvitationResponse {
  busy: 'accept' | 'decline' | null;
  error: LabelKey | null;
  respond: (accept: boolean) => Promise<CommitteeAnswerOutcome | null>;
}

export function useCommitteeInvitationResponse(
  tournamentId: string,
  /** Re-reads the tournament so `my_committee_invitation` reflects the server. Receives the action's correlation id. */
  refresh: (correlationId: string) => Promise<void>,
): CommitteeInvitationResponse {
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const [error, setError] = useState<LabelKey | null>(null);
  const lock = useRef(false);

  const respond = useCallback(
    async (accept: boolean): Promise<CommitteeAnswerOutcome | null> => {
      if (lock.current) {
        return null;
      }
      lock.current = true;
      setBusy(accept ? 'accept' : 'decline');
      setError(null);
      try {
        return await withCorrelationId(async correlationId => {
          let outcome = COMMITTEE_ANSWER_DONE;
          try {
            await respondToCommitteeInvitation(tournamentId, accept, { correlationId });
          } catch (e) {
            outcome = committeeAnswerOutcome(e);
          }
          if (outcome.refresh) {
            try {
              await refresh(correlationId);
            } catch {
              // The answer itself stands; a failed re-read is retried by the screen's own refetch.
            }
          }
          setError(outcome.labelKey);
          return outcome;
        });
      } finally {
        lock.current = false;
        setBusy(null);
      }
    },
    [tournamentId, refresh],
  );

  return { busy, error, respond };
}
