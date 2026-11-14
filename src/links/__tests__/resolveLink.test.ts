import { getActionFromState } from '@react-navigation/native';

import { perfLog } from '../../diagnostics/perfLog';
import { getInvitationFields, getResetToken, noteJoinedGroup, peekPendingTarget, _resetLinkStoreForTesting } from '../linkStore';
import { parseLinkPath } from '../parseLink';
import { homeState, resolveLink, stateForPending } from '../resolveLink';
import type { LinkState } from '../resolveLink';

jest.mock('../../diagnostics/perfLog', () => ({ perfLog: jest.fn() }));

const ID = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b';
const OTHER = '9a8b7c6d-1e2f-4a3b-8c4d-5e6f7a8b9c0d';
const RESET = 'Zk3-_abcdefghijklmnopqrstuvwxyz0123456789ABCDE';

const resolve = (path: string, signedIn: boolean): LinkState => resolveLink(parseLinkPath(path), signedIn);

/** Names of the routes along the focused (last) path, e.g. ['Tabs', 'Home', 'GameLink']. */
function focusedPath(state: LinkState | undefined): string[] {
  const out: string[] = [];
  let current = state;
  while (current && current.routes?.length) {
    const route = current.routes[current.routes.length - 1];
    out.push(route.name);
    current = route.state as LinkState | undefined;
  }
  return out;
}

const counters = (): unknown[] => (perfLog as jest.Mock).mock.calls.map(call => call[1]);

beforeEach(() => {
  _resetLinkStoreForTesting();
  (perfLog as jest.Mock).mockClear();
});

describe('resolveLink: password reset (needs no sign-in)', () => {
  it('signed out: Login under ResetPassword; the token is held in memory only', () => {
    const state = resolve(`/l/reset#token=${RESET}`, false);
    expect(focusedPath(state)).toEqual(['ResetPassword']);
    expect(state.routes.map(r => r.name)).toEqual(['Login', 'ResetPassword']);
    expect(getResetToken()).toBe(RESET);
    expect(JSON.stringify(state)).not.toContain(RESET);
    expect(peekPendingTarget()).toBeNull();
  });

  it('signed in: ResetPassword on top of the tabs', () => {
    const state = resolve(`/l/reset#token=${RESET}`, true);
    expect(state.routes.map(r => r.name)).toEqual(['Tabs', 'ResetPassword']);
    expect(getResetToken()).toBe(RESET);
    expect(JSON.stringify(state)).not.toContain(RESET);
  });
});

describe('resolveLink: game', () => {
  const path = `/l/game/${ID}?ref=${OTHER}#invite=${OTHER}`;

  it('signed out: public preview; the target is held with ref and invite for sign-up', () => {
    const state = resolve(path, false);
    expect(state.routes.map(r => r.name)).toEqual(['Login', 'GamePreview']);
    expect(peekPendingTarget()).toEqual({ kind: 'game', eventId: ID, ref: OTHER, invite: OTHER });
    expect(getInvitationFields()).toEqual({ event_id: ID, ref: OTHER, invite: OTHER });
    expect(counters()).toEqual([{ kind: 'game', platform: expect.any(String), outcome: 'preview' }]);
  });

  it('signed in: GameLink with the id (the authenticated call decides access); nothing is held', () => {
    const state = resolve(path, true);
    expect(focusedPath(state)).toEqual(['Tabs', 'Home', 'GameLink']);
    const home = (state.routes[0].state as LinkState).routes[0];
    expect((home.state as LinkState).routes.map(r => r.name)).toEqual(['EventsList', 'GameLink']);
    expect((home.state as LinkState).routes[1]).toMatchObject({ params: { eventId: ID, ref: OTHER } });
    expect(JSON.stringify(state)).not.toContain('invite');
    expect(peekPendingTarget()).toBeNull();
  });
});

describe('resolveLink: tournament', () => {
  const path = `/l/tournament/${ID}#invite=${OTHER}`;

  it('signed out: sign in first, target held, invite ready for sign-up', () => {
    const state = resolve(path, false);
    expect(state.routes.map(r => r.name)).toEqual(['Login']);
    expect(peekPendingTarget()).toEqual({ kind: 'tournament', tournamentId: ID, invite: OTHER });
    expect(getInvitationFields()).toEqual({ invite: OTHER });
    expect(counters()).toEqual([{ kind: 'tournament', platform: expect.any(String), outcome: 'sign_in_first' }]);
  });

  it('signed in: TournamentDetail on the Games tab stack', () => {
    const state = resolve(path, true);
    expect(focusedPath(state)).toEqual(['Tabs', 'Tournaments', 'TournamentDetail']);
    expect(counters()).toEqual([{ kind: 'tournament', platform: expect.any(String), outcome: 'opened_target' }]);
  });
});

describe('resolveLink: group invitation', () => {
  const path = `/l/group-invite#token=${ID}`;

  it('signed out: landing screen; the token is held in memory and offered as invitation_token', () => {
    const state = resolve(path, false);
    expect(state.routes.map(r => r.name)).toEqual(['Login', 'GroupInvite']);
    expect(getInvitationFields()).toEqual({ invitation_token: ID });
    expect(JSON.stringify(state)).not.toContain(ID);
  });

  it('signed in: the Groups list (no join call for an existing account, OI-8)', () => {
    const state = resolve(path, true);
    expect(focusedPath(state)).toEqual(['Tabs', 'Groups', 'GroupsList']);
    expect(peekPendingTarget()).toBeNull();
  });
});

describe('resolveLink: malformed or unknown', () => {
  it.each(['/l/', '/l/profile/1', '/l/game/not-a-uuid', '/elsewhere', ''])('%p opens Home with no error', path => {
    expect(focusedPath(resolve(path, true))).toEqual(['Tabs', 'Home', 'EventsList']);
    expect(focusedPath(resolve(path, false))).toEqual(['Login']);
    expect(counters()).toEqual([
      { kind: 'unknown', platform: expect.any(String), outcome: 'malformed' },
      { kind: 'unknown', platform: expect.any(String), outcome: 'malformed' },
    ]);
    expect(peekPendingTarget()).toBeNull();
    expect(getResetToken()).toBeNull();
  });

  it('counters carry kind, platform and outcome only', () => {
    resolve(`/l/game/${ID}?ref=${OTHER}`, false);
    resolve(`/l/reset#token=${RESET}`, true);
    for (const fields of counters()) {
      expect(Object.keys(fields as object).sort()).toEqual(['kind', 'outcome', 'platform']);
      expect(JSON.stringify(fields)).not.toContain(ID);
      expect(JSON.stringify(fields)).not.toContain(RESET);
    }
  });
});

describe('state shapes work as React Navigation actions (open app)', () => {
  it.each([
    [`/l/game/${ID}`, true],
    [`/l/tournament/${ID}`, true],
    [`/l/group-invite#token=${ID}`, true],
    [`/l/reset#token=${RESET}`, true],
    [`/l/reset#token=${RESET}`, false],
    [`/l/game/${ID}`, false],
    ['/l/nope', true],
  ])('%s signedIn=%s', (path, signedIn) => {
    expect(getActionFromState(resolve(path, signedIn))).toBeDefined();
  });
});

describe('remembered targets after sign-in', () => {
  it('maps every pending kind to a screen', () => {
    expect(focusedPath(stateForPending({ kind: 'game', eventId: ID }))).toEqual(['Tabs', 'Home', 'GameLink']);
    expect(focusedPath(stateForPending({ kind: 'tournament', tournamentId: ID }))).toEqual([
      'Tabs',
      'Tournaments',
      'TournamentDetail',
    ]);
    expect(focusedPath(stateForPending({ kind: 'group', groupId: ID }))).toEqual(['Tabs', 'Groups', 'GroupDetail']);
    expect(focusedPath(stateForPending({ kind: 'group_invite', token: ID }))).toEqual(['Tabs', 'Groups', 'GroupsList']);
    expect(focusedPath(homeState(true))).toEqual(['Tabs', 'Home', 'EventsList']);
  });

  it('a joined_group_id replaces the target; a non-UUID is ignored', () => {
    resolve(`/l/group-invite#token=${ID}`, false);
    noteJoinedGroup('nope');
    expect(peekPendingTarget()).toEqual({ kind: 'group_invite', token: ID });
    noteJoinedGroup(OTHER);
    expect(peekPendingTarget()).toEqual({ kind: 'group', groupId: OTHER });
    expect(getInvitationFields()).toEqual({});
  });
});
