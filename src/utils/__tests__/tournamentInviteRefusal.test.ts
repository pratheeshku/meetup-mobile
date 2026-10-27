/** Tournament invite refusals (tp-mobile-invite): every refusal has its own label; the server text is never shown. */
import { inviteRefusal } from '../tournamentInviteError';

const err = (status: number, data: unknown) => ({ response: { status, data } });

describe('inviteRefusal', () => {
  it.each([
    [409, { detail: 'INVITES_CLOSED' }, 'mob.tournament.invites_closed'],
    [409, { detail: 'GROUP_CAP_REACHED' }, 'mob.invite.err.group_cap_reached'],
    [409, { detail: 'INVITE_LIMIT_REACHED' }, 'mob.invite.err.limit_reached'],
    [409, { detail: 'x', code: 'tournament_ended' }, 'mob.reg.err.tournament_ended'],
    [400, { detail: 'The organizer cannot be invited' }, 'mob.invite.err.organizer'],
    [404, { detail: 'User not found' }, 'mob.invite.err.user_not_found'],
    [400, { detail: 'User is already invited to this tournament' }, 'mob.invite.err.already_invited'],
    [400, { detail: 'This e-mail address is already invited to this tournament' }, 'mob.invite.err.email_already_invited'],
    [404, { detail: 'Group not found' }, 'mob.invite.err.group_not_found'],
    [404, { detail: 'Tournament not found' }, 'mob.reg.err.tournament_not_found'],
    [403, { detail: 'Only the organizer or committee can invite to this tournament' }, 'mob.reg.err.forbidden'],
    [401, {}, 'mob.reg.err.forbidden'],
    [429, { error: 'rate limit' }, 'mob.reg.err.rate_limited'],
    [422, { detail: [{ msg: 'value is not a valid email address' }] }, 'mob.invite.err.invalid'],
    [500, { detail: 'boom' }, 'mob.add_remove.error'],
  ])('%s %j -> %s', (status, data, key) => {
    expect(inviteRefusal(err(status, data))).toEqual({ labelKey: key, featureOff: false });
  });

  it('a network failure is the generic text', () => {
    expect(inviteRefusal(new Error('Network Error')).labelKey).toBe('mob.add_remove.error');
  });

  it('the flag-off 404 "Not found" means the feature is off', () => {
    expect(inviteRefusal(err(404, { detail: 'Not found' })).featureOff).toBe(true);
  });
});
