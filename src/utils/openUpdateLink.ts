/**
 * Opens the store page for the Update button of the blocking screen and the optional prompt
 * (DES-MEETUP-ADDENDUM-app-update-prompt 4.3, AD-10). The backend link is untrusted: it is opened only if it passes
 * the platform allow-list. A link that is invalid or cannot be opened falls back to this build's own store page: the
 * Play page for the production or staging id, the App Store page for production iOS. Staging iOS has no App Store
 * page, so there only the admin link is used. Never rejects; only error tags are logged, never the URL.
 */
import { Linking } from 'react-native';

import type { UpdatePlatform } from '../api/versionPolicy';
import { describeError } from './logSafeError';
import { resolveUpdateUrl, storeFallbackUrl } from './playStoreUrl';

export async function openUpdateLink(platform: UpdatePlatform, storeUrl: string | null): Promise<void> {
  const target = resolveUpdateUrl(platform, storeUrl);
  if (target === null) {
    console.log('[update] no valid store page to open');
    return;
  }
  try {
    await Linking.openURL(target);
    return;
  } catch (error) {
    console.log('[update] opening the store page failed', describeError(error));
  }
  const fallback = storeFallbackUrl(platform);
  if (fallback === null || target === fallback) {
    return;
  }
  try {
    await Linking.openURL(fallback);
  } catch (error) {
    console.log('[update] opening the fallback store page failed', describeError(error));
  }
}
