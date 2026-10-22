/** Preferences list shows the two match-scoring types (v1.2 AD-S8) with their labels, default on. */
import React from 'react';

import { getPreferences } from '../../api/notifications';
import { renderAsync, texts } from '../../test-utils/render';
import NotificationPreferencesList from '../NotificationPreferencesList';

jest.mock('../../api/notifications', () => ({ getPreferences: jest.fn(), updatePreference: jest.fn() }));
jest.mock('../../notifications/fcm', () => ({ hasNotificationPermission: jest.fn().mockResolvedValue(true) }));

describe('NotificationPreferencesList (match scoring types)', () => {
  it('lists tournament advancement and result changes', async () => {
    (getPreferences as jest.Mock).mockResolvedValue([
      { notification_type: 'tournament_advanced', enabled: true },
      { notification_type: 'tournament_result_corrected', enabled: false },
    ]);
    const root = await renderAsync(<NotificationPreferencesList />);
    const all = texts(root);
    expect(all).toContain('Tournament advancement');
    expect(all).toContain('Tournament result changes');
  });

  it('shows both rows even when the backend has not returned them yet', async () => {
    (getPreferences as jest.Mock).mockResolvedValue([]);
    const all = texts(await renderAsync(<NotificationPreferencesList />));
    expect(all).toContain('Tournament advancement');
    expect(all).toContain('Tournament result changes');
  });
});
