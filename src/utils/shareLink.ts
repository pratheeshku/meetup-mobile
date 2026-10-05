/**
 * App share link (DES-MEETUP-FEEDBACK-001 C5, AD-6, R-09; supersedes the
 * per-game / per-group invite links of DES-MEETUP-MOBILE-ADDENDUM-shareable-
 * links).
 *
 * The share action shares ONE URL — the app's API base URL plus
 * `/public/share` (P1). The backend decides the destination (Play Store, App
 * Store or a coming-soon page) from admin config, so the app holds no store
 * URL. It is shared with text asking the recipient to download the app. The text is
 * the `mob.share.message` label. No game or group context is carried in the
 * link or the text (deep-link-after-install is deferred, DD-1).
 */
import { Clipboard, Linking, Share } from 'react-native';

import { ENV } from '../../config/env';

export const SHARE_PATH = '/public/share';

/** The app share URL: API base URL + `/public/share`. */
export function getShareUrl(): string {
  return `${ENV.API_BASE_URL.replace(/\/+$/, '')}${SHARE_PATH}`;
}

/**
 * System share sheet via React Native core `Share.share`. The URL is part of
 * the message text, so only `message` is passed (passing `url` as well makes
 * iOS targets show the link twice).
 */
export async function shareGeneric({ message }: { message: string }): Promise<void> {
  await Share.share({ message });
}

/**
 * WhatsApp share via Linking: `whatsapp://send?text=<encoded>` with fallback
 * to `https://wa.me/?text=<encoded>` if WhatsApp is not installed.
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

/** Copies the share URL to the system clipboard via React Native core `Clipboard.setString`. */
export function copyLinkToClipboard(url: string): void {
  Clipboard.setString(url);
}
