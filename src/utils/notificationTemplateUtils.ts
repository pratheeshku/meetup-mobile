/**
 * Notification template rendering utility (Requirement A.3).
 *
 * Renders notification title and body from per-type label templates using
 * placeholder values returned by the API (or falling back to item.title/item.body).
 */
import type { NotificationHistoryItem } from '../types/notification';
import { formatLabel, type LabelKey, type TranslateFn } from '../labels/LabelsContext';

export function renderNotificationContent(
  item: NotificationHistoryItem,
  t: TranslateFn,
): { title: string; body: string } {
  const type = item.notification_type;
  const placeholders: Record<string, string | number> = {
    ...(item.data ?? {}),
    ...(item.payload ?? {}),
  };

  if (item.entity_id) {
    placeholders.entity_id = item.entity_id;
  }

  // 1. Resolve Title:
  // If item.title is provided, format and use it.
  // Otherwise, render from per-type label template `notif.${type}.title`.
  let title = item.title?.trim();
  if (!title) {
    const titleKey = `notif.${type}.title` as LabelKey;
    const fromTemplate = t(titleKey, placeholders);
    if (fromTemplate !== titleKey && fromTemplate.trim()) {
      title = fromTemplate;
    } else {
      title = t('mob.notif_history.fallback_title');
    }
  } else {
    title = formatLabel(title, placeholders);
  }

  // 2. Resolve Body:
  // If item.body is provided, format and use it.
  // Otherwise, render from per-type label template `notif.${type}.body`.
  let body = item.body?.trim();
  if (!body) {
    const bodyKey = `notif.${type}.body` as LabelKey;
    const fromTemplate = t(bodyKey, placeholders);
    if (fromTemplate !== bodyKey && fromTemplate.trim()) {
      body = fromTemplate;
    } else {
      body = '';
    }
  } else {
    body = formatLabel(body, placeholders);
  }

  return { title, body };
}
