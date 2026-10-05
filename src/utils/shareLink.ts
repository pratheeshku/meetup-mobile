/**
 * App share link (DES-MEETUP-FEEDBACK-001 C5, AD-6, R-09; supersedes the
 * per-game / per-group invite links of DES-MEETUP-MOBILE-ADDENDUM-shareable-
 * links).
 *
 * The share action shares ONE URL — `shareUrl` from `config/appConfig.json`
 * (P1), the backend redirect that routes to the Play Store or App Store by
 * platform — with text asking the recipient to download the app. The text is
 * the `mob.share.message` label. No game or group context is carried in the
 * link or the text (deep-link-after-install is deferred, DD-1).
 */
import { Clipboard, Linking, Share } from 'react-native';

import appConfig from '../../config/appConfig.json';
import { toHttpsUrl } from './httpsUrl';

/** The configured share URL, or `null` when it is missing / not an https URL. */
export function getShareUrl(): string | null {
  return toHttpsUrl(appConfig.shareUrl);
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
