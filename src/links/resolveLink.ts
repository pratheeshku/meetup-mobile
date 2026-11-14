/**
 * The one link resolver (deep-links AD-6). Maps a parsed link to a React Navigation state for the
 * current sign-in state, keeps claims in memory (`linkStore`) and counts the outcome.
 *
 *   signed out: reset -> ResetPassword (no sign-in needed); game -> GamePreview; group invitation ->
 *               GroupInvite; tournament -> Login with the target held (sign in first).
 *   signed in : reset -> ResetPassword (the device is signed out on success); game -> GameLink (opens
 *               the game, or the preview with the access notice); tournament -> TournamentDetail;
 *               group invitation -> Groups list (OI-8: the link joins nobody who has an account).
 *   malformed or unknown: Home (Login when signed out), no error.
 *
 * Used both for a closed app (initial URL) and an open app (URL event) through the `linking` option
 * of NavigationContainer. Reset and group tokens are never placed in route params.
 */
import type { NavigationState, PartialState } from '@react-navigation/native';

import { countLinkOpened } from './linkCounters';
import type { PendingTarget } from './linkStore';
import { clearResetToken, setPendingTarget, setResetToken, takePendingTarget } from './linkStore';
import type { ParsedLink } from './parseLink';

export type LinkState = PartialState<NavigationState>;

type Route = { name: string; params?: object; state?: LinkState };

const stack = (...routes: Route[]): LinkState => ({ routes } as LinkState);
const inTab = (tab: string, ...routes: Route[]): LinkState =>
  stack({ name: 'Tabs', state: stack({ name: tab, state: stack(...routes) }) });

/** Signed-in Home. */
export function homeState(signedIn: boolean): LinkState {
  return signedIn ? inTab('Home', { name: 'EventsList' }) : stack({ name: 'Login' });
}

/** Where a remembered target opens once the person is signed in (also used right after sign-in). */
export function stateForPending(target: PendingTarget): LinkState {
  switch (target.kind) {
    case 'game':
      return inTab('Home', { name: 'EventsList' }, { name: 'GameLink', params: { eventId: target.eventId, ref: target.ref } });
    case 'tournament':
      return inTab(
        'Tournaments',
        { name: 'TournamentsList' },
        { name: 'TournamentDetail', params: { tournamentId: target.tournamentId } },
      );
    case 'group':
      return inTab('Groups', { name: 'GroupsList' }, { name: 'GroupDetail', params: { groupId: target.groupId } });
    case 'group_invite':
      return inTab('Groups', { name: 'GroupsList' });
  }
}

export function resolveLink(link: ParsedLink, signedIn: boolean): LinkState {
  switch (link.kind) {
    case 'malformed':
      countLinkOpened('unknown', 'malformed');
      return homeState(signedIn);

    case 'reset':
      setResetToken(link.token);
      countLinkOpened('reset', 'opened_target');
      return signedIn
        ? stack({ name: 'Tabs' }, { name: 'ResetPassword' })
        : stack({ name: 'Login' }, { name: 'ResetPassword' });

    case 'game': {
      const target: PendingTarget = { kind: 'game', eventId: link.eventId, ref: link.ref, invite: link.invite };
      if (signedIn) {
        // Whether the game opens or the preview shows is decided by the authenticated call in GameLink,
        // which counts the outcome.
        return stateForPending(target);
      }
      setPendingTarget(target);
      countLinkOpened('game', 'preview');
      return stack({ name: 'Login' }, { name: 'GamePreview' });
    }

    case 'tournament': {
      const target: PendingTarget = { kind: 'tournament', tournamentId: link.tournamentId, invite: link.invite };
      if (signedIn) {
        countLinkOpened('tournament', 'opened_target');
        return stateForPending(target);
      }
      setPendingTarget(target);
      countLinkOpened('tournament', 'sign_in_first');
      return stack({ name: 'Login' });
    }

    case 'group_invite': {
      const target: PendingTarget = { kind: 'group_invite', token: link.token };
      if (signedIn) {
        countLinkOpened('group_invite', 'opened_target');
        return stateForPending(target);
      }
      setPendingTarget(target);
      countLinkOpened('group_invite', 'preview');
      return stack({ name: 'Login' }, { name: 'GroupInvite' });
    }
  }
}

/** Drops whatever a link left in memory (used when the person backs out of a link flow). */
export function dropLinkMemory(): void {
  clearResetToken();
  takePendingTarget();
}
