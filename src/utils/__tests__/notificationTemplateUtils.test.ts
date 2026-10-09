import { renderNotificationContent } from '../notificationTemplateUtils';
import type { NotificationHistoryItem } from '../../types/notification';

describe('notificationTemplateUtils', () => {
  const dummyT = (key: string, placeholders?: Record<string, string | number>): string => {
    if (key === 'notif.waitlist_promoted.title') return 'You got a spot';
    if (key === 'notif.waitlist_promoted.body') {
      return `A spot opened up in ${placeholders?.game_title ?? ''}`;
    }
    if (key === 'mob.notif_history.fallback_title') return 'Notification';
    return key;
  };

  it('uses item.title and item.body directly if present', () => {
    const item: NotificationHistoryItem = {
      id: '1',
      notification_type: 'event_reminder',
      title: 'Explicit Title',
      body: 'Explicit Body',
      entity_id: null,
      entity_type: null,
      created_at: new Date().toISOString(),
      read_at: null,
    };
    const content = renderNotificationContent(item, dummyT);
    expect(content.title).toBe('Explicit Title');
    expect(content.body).toBe('Explicit Body');
  });

  it('substitutes placeholders into item.title and item.body if placeholders present', () => {
    const item: NotificationHistoryItem = {
      id: '2',
      notification_type: 'event_reminder',
      title: 'Game {game_title}',
      body: 'Starts at {venue}',
      entity_id: null,
      entity_type: null,
      created_at: new Date().toISOString(),
      read_at: null,
      data: {
        game_title: 'Football Sunday',
        venue: 'Main Pitch',
      },
    };
    const content = renderNotificationContent(item, dummyT);
    expect(content.title).toBe('Game Football Sunday');
    expect(content.body).toBe('Starts at Main Pitch');
  });

  it('resolves per-type label template when title and body are absent', () => {
    const item: NotificationHistoryItem = {
      id: '3',
      notification_type: 'waitlist_promoted',
      title: null,
      body: null,
      entity_id: null,
      entity_type: null,
      created_at: new Date().toISOString(),
      read_at: null,
      payload: {
        game_title: 'Tennis Open',
      },
    };
    const content = renderNotificationContent(item, dummyT);
    expect(content.title).toBe('You got a spot');
    expect(content.body).toBe('A spot opened up in Tennis Open');
  });

  it('falls back to fallback title when unknown type has no title', () => {
    const item: NotificationHistoryItem = {
      id: '4',
      notification_type: 'brand_new_unknown_type',
      title: null,
      body: null,
      entity_id: null,
      entity_type: null,
      created_at: new Date().toISOString(),
      read_at: null,
    };
    const content = renderNotificationContent(item, dummyT);
    expect(content.title).toBe('Notification');
    expect(content.body).toBe('');
  });
});
