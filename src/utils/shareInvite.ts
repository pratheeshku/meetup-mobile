/**
 * GameOn SG share invite message (TASK 3.1; mirrors the web `buildInviteMessage` /
 * `buildShareText`). All wording comes from the admin labels `share.invite_message`
 * (placeholders `{name}`, `{store_links}`), `share.invite_android_line` and
 * `share.invite_ios_line` (placeholder `{url}`); store URLs come from
 * `GET /config/client`. Nothing is hardcoded here.
 */
import type { LabelMap } from '../api/labels';
import { formatLabel } from '../labels/LabelsContext';

export interface StoreUrls {
  android?: string | null;
  ios?: string | null;
}

/** A raw label value, or '' when the label is missing or blank (no bundled fallback on purpose). */
function rawLabel(labels: LabelMap | null | undefined, key: string): string {
  const value = labels?.[key];
  return typeof value === 'string' && value.trim() !== '' ? value : '';
}

/**
 * The invite message, or '' when `share.invite_message` is missing/empty.
 * A store line is left out when its URL is empty (or its line label is missing).
 */
export function buildInviteMessage(labels: LabelMap | null | undefined, name: string, urls?: StoreUrls): string {
  const template = rawLabel(labels, 'share.invite_message');
  if (!template) {
    return '';
  }
  const lines: string[] = [];
  const androidLine = rawLabel(labels, 'share.invite_android_line');
  const iosLine = rawLabel(labels, 'share.invite_ios_line');
  if (urls?.android && androidLine) {
    lines.push(formatLabel(androidLine, { url: urls.android }));
  }
  if (urls?.ios && iosLine) {
    lines.push(formatLabel(iosLine, { url: urls.ios }));
  }
  return formatLabel(template, { name: name || '', store_links: lines.join('\n') });
}

/**
 * The text to share: the invite message, then (group invite only) a blank line and the
 * link. '' when the invite label is missing — the caller then shares nothing.
 */
export function buildShareText(
  labels: LabelMap | null | undefined,
  name: string,
  urls?: StoreUrls,
  link?: string | null,
): string {
  const message = buildInviteMessage(labels, name, urls);
  if (!message) {
    return '';
  }
  return link ? `${message}\n\n${link}` : message;
}
