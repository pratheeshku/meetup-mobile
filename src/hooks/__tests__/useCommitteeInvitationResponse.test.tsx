/** Accept or decline a committee seat: one correlation id for the answer and the refresh; refusals are states. */
import React from 'react';

import { respondToCommitteeInvitation } from '../../api/tournaments';
import { act, render } from '../../test-utils/render';
import { useCommitteeInvitationResponse } from '../useCommitteeInvitationResponse';
import type { CommitteeInvitationResponse } from '../useCommitteeInvitationResponse';

jest.mock('../../api/tournaments', () => ({ respondToCommitteeInvitation: jest.fn() }));

const respondApi = respondToCommitteeInvitation as jest.Mock;
let latest: CommitteeInvitationResponse;

function Probe({ refresh }: { refresh: (id: string) => Promise<void> }): null {
  latest = useCommitteeInvitationResponse('t-1', refresh);
  return null;
}

const reject = (status: number, code: string) => ({ response: { status, data: { code, detail: 'x' } } });

beforeEach(() => {
  respondApi.mockReset().mockResolvedValue({ tournament_id: 't-1', status: 'active' });
});

describe('useCommitteeInvitationResponse', () => {
  it('accept: one call, then the refresh with the same correlation id', async () => {
    const refresh = jest.fn().mockResolvedValue(undefined);
    render(<Probe refresh={refresh} />);
    let outcome: unknown;
    await act(async () => {
      outcome = await latest.respond(true);
    });
    expect(respondApi).toHaveBeenCalledTimes(1);
    const [id, accept, options] = respondApi.mock.calls[0];
    expect([id, accept]).toEqual(['t-1', true]);
    expect(options.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(refresh).toHaveBeenCalledWith(options.correlationId);
    expect(outcome).toMatchObject({ state: 'done' });
    expect(latest.error).toBeNull();
    expect(latest.busy).toBeNull();
  });

  it('decline answers false and refreshes', async () => {
    const refresh = jest.fn().mockResolvedValue(undefined);
    render(<Probe refresh={refresh} />);
    await act(async () => {
      await latest.respond(false);
    });
    expect(respondApi.mock.calls[0].slice(0, 2)).toEqual(['t-1', false]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['committee_already_active', 'already_active'],
    ['committee_invitation_closed', 'closed'],
    ['committee_not_invited', 'not_invited'],
    ['tournament_cancelled', 'cancelled'],
    ['tournament_ended', 'ended'],
  ])('%s: no throw, the message is set and the tournament is re-read', async (code, state) => {
    respondApi.mockRejectedValue(reject(409, code));
    const refresh = jest.fn().mockResolvedValue(undefined);
    render(<Probe refresh={refresh} />);
    let outcome: unknown;
    await act(async () => {
      outcome = await latest.respond(true);
    });
    expect(outcome).toMatchObject({ state });
    expect(latest.error).toMatch(/^mob\.committee_invite\./);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(latest.busy).toBeNull();
  });

  it('a network failure changes nothing: message set, no refresh, and the next try works', async () => {
    respondApi.mockRejectedValueOnce(new Error('Network Error'));
    const refresh = jest.fn().mockResolvedValue(undefined);
    render(<Probe refresh={refresh} />);
    await act(async () => {
      await latest.respond(true);
    });
    expect(latest.error).toBe('mob.committee_invite.failed');
    expect(refresh).not.toHaveBeenCalled();
    await act(async () => {
      await latest.respond(true);
    });
    expect(latest.error).toBeNull();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('a failed re-read does not undo or hide the answer', async () => {
    const refresh = jest.fn().mockRejectedValue(new Error('offline'));
    render(<Probe refresh={refresh} />);
    let outcome: unknown;
    await act(async () => {
      outcome = await latest.respond(true);
    });
    expect(outcome).toMatchObject({ state: 'done' });
    expect(latest.error).toBeNull();
  });

  it('a second tap while an answer is in flight sends nothing', async () => {
    let finish: (v: unknown) => void = () => undefined;
    respondApi.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const refresh = jest.fn().mockResolvedValue(undefined);
    render(<Probe refresh={refresh} />);
    let first!: Promise<unknown>;
    let second: unknown;
    await act(async () => {
      first = latest.respond(true);
      second = await latest.respond(false);
    });
    expect(second).toBeNull();
    expect(respondApi).toHaveBeenCalledTimes(1);
    expect(latest.busy).toBe('accept');
    await act(async () => {
      finish({ tournament_id: 't-1', status: 'active' });
      await first;
    });
    expect(latest.busy).toBeNull();
  });
});
