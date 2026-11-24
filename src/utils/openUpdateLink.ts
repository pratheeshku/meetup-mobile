/**
 * Opens the store page for the Update button of the blocking screen and the optional prompt
 * (DES-MEETUP-ADDENDUM-app-update-prompt 4.3, AD-10). The backend link is untrusted: it is opened only if it passes
 * the platform allow-list. On Android a link that is invalid or cannot be opened falls back to this build's own Play
 * page (production or staging id). Never rejects; only error tags are logged, never the URL.
 */
import { Linking } from 'react-native';

import type { UpdatePlatform } from '../api/versionPolicy';
import { describeError } from './logSafeError';
import { playStoreFallbackUrl, resolveUpdateUrl } from './playStoreUrl';

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
  if (platform !== 'android') {
    return;
  }
  const fallback = playStoreFallbackUrl();
  if (target === fallback) {
    return;
  }
  try {
    await Linking.openURL(fallback);
  } catch (error) {
    console.log('[update] opening the fallback store page failed', describeError(error));
  }
}
