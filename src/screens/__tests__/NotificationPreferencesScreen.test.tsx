/**
 * The preferences screen lists every known notification type — including the
 * two participant types — defaulting to on, and toggles them via
 * `PUT /notifications/preferences/{type}`.
 */
import React from 'react';
import { Switch } from 'react-native';

import { getPreferences, updatePreference } from '../../api/notifications';
import { NOTIFICATION_TYPES } from '../../types/notification';
import { act, renderAsync, texts } from '../../test-utils/render';
import NotificationPreferencesScreen from '../NotificationPreferencesScreen';

jest.mock('../../api/notifications', () => ({
  getPreferences: jest.fn(),
  updatePreference: jest.fn(),
}));

const mockGetPreferences = getPreferences as jest.Mock;
const mockUpdatePreference = updatePreference as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdatePreference.mockResolvedValue(undefined);
});

it('shows a row for every known type, with the two participant labels', async () => {
  // Server lists only some types (none of the participant ones).
  mockGetPreferences.mockResolvedValue([{ notification_type: 'event_changed', enabled: false }]);

  const root = await renderAsync(<NotificationPreferencesScreen />);

  const labels = texts(root);
  expect(labels).toContain('Added to an event');
  expect(labels).toContain('Removed from an event');
  const switches = root.findAllByType(Switch);
  expect(switches).toHaveLength(NOTIFICATION_TYPES.length);
  expect(NOTIFICATION_TYPES.length).toBe(15);

  // Unlisted types default to on; a listed one keeps the server value.
  const added = NOTIFICATION_TYPES.indexOf('event_participant_added');
  const changed = NOTIFICATION_TYPES.indexOf('event_changed');
  expect(switches[added].props.value).toBe(true);
  expect(switches[changed].props.value).toBe(false);
});

it.each(['event_participant_added', 'event_participant_removed'] as const)(
  'toggling %s saves it under its own type',
  async type => {
    mockGetPreferences.mockResolvedValue([]);
    const root = await renderAsync(<NotificationPreferencesScreen />);
    const toggle = root.findAllByType(Switch)[NOTIFICATION_TYPES.indexOf(type)];

    await act(async () => {
      toggle.props.onValueChange(false);
    });

    expect(mockUpdatePreference).toHaveBeenCalledTimes(1);
    expect(mockUpdatePreference.mock.calls[0].slice(0, 2)).toEqual([type, false]);
  },
);
