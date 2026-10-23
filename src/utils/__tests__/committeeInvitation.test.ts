import { committeeAnswerOutcome, committeeNames } from '../committeeInvitation';
import type { CommitteeMember } from '../../types/tournament';

const reject = (status: number, code?: string) => ({ response: { status, data: code ? { code, detail: 'x' } : {} } });
const member = (over: Partial<CommitteeMember>): CommitteeMember => ({
  user_id: 'id-1',
  display_name: 'Ravi K.',
  status: 'active',
  is_organizer: false,
  ...over,
});

describe('committeeAnswerOutcome: every coded refusal is a state, never a throw', () => {
  it.each([
    ['committee_already_active', 409, 'already_active', 'mob.committee_invite.already_active', true],
    ['committee_invitation_closed', 409, 'closed', 'mob.committee_invite.closed', true],
    ['committee_not_invited', 404, 'not_invited', 'mob.committee_invite.not_invited', true],
    ['tournament_cancelled', 409, 'cancelled', 'mob.committee_invite.cancelled', true],
    ['tournament_ended', 409, 'ended', 'mob.committee_invite.ended', true],
    ['v2_disabled', 409, 'disabled', 'mob.committee_invite.disabled', false],
  ])('%s -> %s', (code, status, state, labelKey, refresh) => {
    expect(committeeAnswerOutcome(reject(status as number, code as string))).toEqual({ state, labelKey, refresh });
  });

  it('anything else (unknown code, 5xx, network drop, no body) is "failed": nothing changed, no refresh', () => {
    const failed = { state: 'failed', labelKey: 'mob.committee_invite.failed', refresh: false };
    expect(committeeAnswerOutcome(reject(500))).toEqual(failed);
    expect(committeeAnswerOutcome(reject(409, 'something_new'))).toEqual(failed);
    expect(committeeAnswerOutcome(new Error('Network Error'))).toEqual(failed);
    expect(committeeAnswerOutcome(null)).toEqual(failed);
    expect(committeeAnswerOutcome(reject(409, 'constructor'))).toEqual(failed);
  });
});

describe('committeeNames: people by name, never by id', () => {
  it('lists active people in the server order (organizer first) and leaves removed and invited rows out', () => {
    const rows = [
      member({ user_id: 'id-org', display_name: 'Pratheesh', is_organizer: true }),
      member({ user_id: 'id-2', display_name: 'Ravi K.' }),
      member({ user_id: 'id-3', display_name: 'Alicia Lim', status: 'invited' }),
      member({ user_id: 'id-4', display_name: 'Daniel Soh', status: 'removed' }),
    ];
    expect(committeeNames(rows, 'A committee person')).toEqual(['Pratheesh', 'Ravi K.']);
    expect(committeeNames(rows, 'A committee person', { includeInvited: true })).toEqual(['Pratheesh', 'Ravi K.', 'Alicia Lim']);
  });

  it('a missing or blank name shows the neutral label, never the id', () => {
    const out = committeeNames([member({ display_name: null, user_id: 'abc-123' }), member({ display_name: '  ', user_id: 'def-456' })], 'A committee person');
    expect(out).toEqual(['A committee person', 'A committee person']);
    expect(JSON.stringify(out)).not.toMatch(/abc-123|def-456/);
  });
});
