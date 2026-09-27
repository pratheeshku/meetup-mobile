/**
 * Shareable link composition and native sharing utilities (DES-MEETUP-MOBILE-ADDENDUM-shareable-links).
 *
 * Implements:
 * - Decision 2: Client-side event link composition with `?ref=<current_user_id>`
 * - Decision 4: Native share integration (`Share.share({ message, url })` and WhatsApp with `https://wa.me/` fallback)
 * - Decision 5: Clipboard copy via RN core Clipboard
 * - Decision 7: Single shared message-composition template:
 *   `"{inviter_display_name} invited you to {event_or_group_name} on Shuttlr — {link}"`
 */
import { Clipboard, Linking, Share } from 'react-native';
import { ENV } from '../../config/env';

/**
 * Returns canonical web event URL with optional `?ref=<current_user_id>` query param (Decision 2).
 * Matches the web app's client-side router (frontend/app.js line 2564).
 */
export function getEventShareUrl(eventId: string, currentUserId?: string): string {
  const base = ENV.API_BASE_URL.replace(/\/+$/, '');
  const url = `${base}/#event-detail/${eventId}`;
  return currentUserId ? `${url}?ref=${encodeURIComponent(currentUserId)}` : url;
}

/**
 * Single source of truth for share message composition (Decision 4, Decision 7).
 * Default copy:
 * `"{inviter_display_name} invited you to {event_or_group_name} on Shuttlr — {link}"`
 */
export function composeShareMessage(
  inviterDisplayName: string,
  eventOrGroupName: string,
  link: string,
): string {
  return `${inviterDisplayName} invited you to ${eventOrGroupName} on Shuttlr \u2014 ${link}`;
}

/**
 * Generic system share sheet integration via React Native core `Share.share` (Decision 4).
 */
export async function shareGeneric({
  message,
  url,
}: {
  message: string;
  url: string;
}): Promise<void> {
  await Share.share({ message, url });
}

/**
 * WhatsApp share integration via Linking (Decision 4).
 * Attempts `whatsapp://send?text=<encoded>` with fallback to `https://wa.me/?text=<encoded>`
 * if WhatsApp is not installed.
 */
export async function shareToWhatsApp(message: string): Promise<void> {
  const encoded = encodeURIComponent(message);
  const deepLink = `whatsapp://send?text=${encoded}`;
  const webLink = `https://wa.me/?text=${encoded}`;

  try {
    const canOpen = await Linking.canOpenURL('whatsapp://send');
    if (canOpen) {
      await Linking.openURL(deepLink);
      return;
    }
  } catch {
    // canOpenURL check failed or threw — fall through to web fallback
  }

  await Linking.openURL(webLink);
}

/**
 * Copies link to system clipboard via React Native core `Clipboard.setString` (Decision 5).
 */
export function copyLinkToClipboard(url: string): void {
  Clipboard.setString(url);
}
