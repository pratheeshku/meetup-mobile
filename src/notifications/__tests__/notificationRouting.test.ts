/**
 * Routing for the two participant types (`event_participant_added` /
 * `event_participant_removed`) added after the design's original 12, plus
 * `group_event_created` (mobile notify-kit task Part 3), added the same way.
 * All three open Event Detail with `entity_id` as the event id;
 * `event_participant_added`/`_removed` additionally guard against a blank
 * `entity_id` (see below) — `group_event_created` does not, matching
 * `event_invite`/`event_changed`'s existing (unguarded) behaviour.
 */
import { NOTIFICATION_TYPES } from '../../types/notification';
import {
  navigateToNotificationTarget,
  navigationRef,
  resolveNotificationTarget,
} from '../notificationRouting';

const PARTICIPANT_TYPES = ['event_participant_added', 'event_participant_removed'] as const;

/** Types added after the original 12. The last two landed with group delete and ownership transfer. */
const ADDED_TYPES = [
  ...PARTICIPANT_TYPES,
  'group_event_created',
  'event_reminder',
  'group_deleted',
  'group_ownership_transferred',
  'tournament_invited',
  'tournament_advanced',
  'tournament_result_corrected',
  'team_join_request',
  'tournament_registration_removed',
  'tournament_updated',
  'tournament_registration_added',
] as const;

describe('type list', () => {
  it('contains the added types alongside the original 12 (25 total, no duplicates)', () => {
    expect(NOTIFICATION_TYPES).toEqual(expect.arrayContaining([...ADDED_TYPES]));
    expect(NOTIFICATION_TYPES).toHaveLength(25);
    expect(new Set(NOTIFICATION_TYPES).size).toBe(25);
  });

  it('resolves every listed type without throwing (list and switch cannot drift)', () => {
    NOTIFICATION_TYPES.forEach(type => {
      expect(() => resolveNotificationTarget(type, 'id-1')).not.toThrow();
    });
  });
});

describe.each(['tournament_advanced', 'tournament_result_corrected', 'tournament_result_posted'] as const)(
  'resolveNotificationTarget(%s) (match scoring)',
  type => {
    it('deep-links to the tournament view with entity_id as the tournament id', () => {
      expect(resolveNotificationTarget(type, 'tour-7')).toEqual({
        tab: 'Tournaments',
        screen: 'TournamentDetail',
        params: { tournamentId: 'tour-7' },
      });
    });
  },
);

describe.each(PARTICIPANT_TYPES)('resolveNotificationTarget(%s)', type => {
  it('opens Event Detail for the entity id', () => {
    expect(resolveNotificationTarget(type, 'evt-42')).toEqual({
      tab: 'Home',
      screen: 'EventDetail',
      params: { eventId: 'evt-42' },
    });
  });

  it('routes exactly like event_changed', () => {
    expect(resolveNotificationTarget(type, 'evt-42')).toEqual(
      resolveNotificationTarget('event_changed', 'evt-42'),
    );
  });

  it.each(['', '   '])('falls back to the events list for a blank entity id (%p)', blank => {
    expect(resolveNotificationTarget(type, blank)).toEqual({ tab: 'Home', screen: 'EventsList' });
  });
});

describe('resolveNotificationTarget(group_event_created)', () => {
  it('opens Event Detail for the entity id', () => {
    expect(resolveNotificationTarget('group_event_created', 'evt-42')).toEqual({
      tab: 'Home',
      screen: 'EventDetail',
      params: { eventId: 'evt-42' },
    });
  });

  it('routes exactly like event_changed', () => {
    expect(resolveNotificationTarget('group_event_created', 'evt-42')).toEqual(
      resolveNotificationTarget('event_changed', 'evt-42'),
    );
  });

  it('does NOT fall back to the events list for a blank entity id (unlike the participant types)', () => {
    expect(resolveNotificationTarget('group_event_created', '')).toEqual({
      tab: 'Home',
      screen: 'EventDetail',
      params: { eventId: '' },
    });
  });
});

describe('resolveNotificationTarget(event_reminder)', () => {
  it('opens Event Detail for the entity id', () => {
    expect(resolveNotificationTarget('event_reminder', 'evt-42')).toEqual({
      tab: 'Home',
      screen: 'EventDetail',
      params: { eventId: 'evt-42' },
    });
  });

  it('routes exactly like event_changed and event_invite', () => {
    expect(resolveNotificationTarget('event_reminder', 'evt-42')).toEqual(
      resolveNotificationTarget('event_changed', 'evt-42'),
    );
    expect(resolveNotificationTarget('event_reminder', 'evt-42')).toEqual(
      resolveNotificationTarget('event_invite', 'evt-42'),
    );
  });

  it('does NOT fall back to the events list for a blank entity id (unlike the participant types)', () => {
    expect(resolveNotificationTarget('event_reminder', '')).toEqual({
      tab: 'Home',
      screen: 'EventDetail',
      params: { eventId: '' },
    });
  });
});

describe('navigateToNotificationTarget for a participant notification', () => {
  let navigate: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
    navigate = jest.spyOn(navigationRef, 'navigate').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('navigates to Home > EventDetail with the event id', () => {
    navigateToNotificationTarget(resolveNotificationTarget('event_participant_added', 'evt-9'));

    expect(navigate).toHaveBeenCalledWith('Home', {
      screen: 'EventDetail',
      params: { eventId: 'evt-9' },
    });
  });

  it('navigates to Home > EventsList (no event id) when entity_id is missing', () => {
    navigateToNotificationTarget(resolveNotificationTarget('event_participant_removed', ''));

    expect(navigate).toHaveBeenCalledWith('Home', { screen: 'EventsList' });
  });
});

describe('tournament_invited', () => {
  it('opens Tournament Detail for the tournament id, like the other tournament types', () => {
    expect(resolveNotificationTarget('tournament_invited', 't-9')).toEqual({
      tab: 'Tournaments',
      screen: 'TournamentDetail',
      params: { tournamentId: 't-9' },
    });
    expect(resolveNotificationTarget('tournament_invited', 't-9')).toEqual(
      resolveNotificationTarget('tournament_cancelled', 't-9'),
    );
  });

  it('is a known notification type (so the push payload is accepted)', () => {
    expect(NOTIFICATION_TYPES).toContain('tournament_invited');
  });
});

describe('teams-payments AD-15 routing', () => {
  it.each(['team_invite', 'team_join_request'] as const)('%s opens Groups with Tournament teams selected, never a group detail', type => {
    expect(resolveNotificationTarget(type, 'team-9')).toEqual({ tab: 'Groups', screen: 'GroupsList', params: { section: 'teams' } });
  });

  it('tournament_registration_removed opens the tournament', () => {
    expect(resolveNotificationTarget('tournament_registration_removed', 'tour-3')).toEqual({
      tab: 'Tournaments',
      screen: 'TournamentDetail',
      params: { tournamentId: 'tour-3' },
    });
  });

  it('navigates to Groups with the teams section param', () => {
    jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
    const navigate = jest.spyOn(navigationRef, 'navigate').mockImplementation(() => {});
    navigateToNotificationTarget(resolveNotificationTarget('team_invite', 'team-9'));
    expect(navigate).toHaveBeenCalledWith('Groups', { screen: 'GroupsList', params: { section: 'teams' } });
    jest.restoreAllMocks();
  });
});

describe('tournament_updated and tournament_registration_added (er-m-series, AD-9, A41)', () => {
  it.each(['tournament_updated', 'tournament_registration_added'] as const)('%s opens the tournament for the entity id', type => {
    expect(resolveNotificationTarget(type, 't-9')).toEqual({
      tab: 'Tournaments',
      screen: 'TournamentDetail',
      params: { tournamentId: 't-9' },
    });
  });

  it('routes exactly like tournament_registration_removed', () => {
    expect(resolveNotificationTarget('tournament_updated', 't-9')).toEqual(resolveNotificationTarget('tournament_registration_removed', 't-9'));
  });

  it('series actions keep reusing event_changed and event_cancelled, which open the game', () => {
    expect(resolveNotificationTarget('event_changed', 'evt-1')).toEqual({ tab: 'Home', screen: 'EventDetail', params: { eventId: 'evt-1' } });
    expect(resolveNotificationTarget('event_cancelled', 'evt-1')).toEqual({ tab: 'Home', screen: 'EventDetail', params: { eventId: 'evt-1' } });
  });
});
