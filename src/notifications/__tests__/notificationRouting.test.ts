/**
 * Routing for the two participant types (`event_participant_added` /
 * `event_participant_removed`) added after the design's original 12.
 * They open Event Detail with `entity_id` as the event id, like
 * `event_changed`; a blank `entity_id` must not open Event Detail.
 */
import { NOTIFICATION_TYPES } from '../../types/notification';
import {
  navigateToNotificationTarget,
  navigationRef,
  resolveNotificationTarget,
} from '../notificationRouting';

const PARTICIPANT_TYPES = ['event_participant_added', 'event_participant_removed'] as const;

describe('type list', () => {
  it('contains both participant types, alongside the original 12 (14 total, no duplicates)', () => {
    expect(NOTIFICATION_TYPES).toEqual(expect.arrayContaining([...PARTICIPANT_TYPES]));
    expect(NOTIFICATION_TYPES).toHaveLength(14);
    expect(new Set(NOTIFICATION_TYPES).size).toBe(14);
  });

  it('resolves every listed type without throwing (list and switch cannot drift)', () => {
    NOTIFICATION_TYPES.forEach(type => {
      expect(() => resolveNotificationTarget(type, 'id-1')).not.toThrow();
    });
  });
});

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
