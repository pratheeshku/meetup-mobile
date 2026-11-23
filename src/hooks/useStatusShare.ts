/**
 * Share the game or tournament status as a screenshot (DES-MEETUP-ADDENDUM-priority1-nov23 P1-06).
 *
 * Captures the detail page (react-native-view-shot). When the target is a ScrollView, pass `{ scrollView: true }`
 * so the whole scrolled length is captured (`snapshotContentContainer`); a plain View target is captured as laid
 * out (iOS fails a full-scroll capture on a non-ScrollView). The picture holds what this viewer sees: the Accepted, Declined and Pending lists the server sent them. Then:
 * - Android: straight to WhatsApp (or WhatsApp Business) when installed, else the system share sheet;
 * - iOS: the system share sheet, where WhatsApp is one of the targets.
 * A person who closes the sheet is not an error. The temporary file is left to the OS cache cleanup.
 * Nothing is logged except that a share failed.
 */
import { useCallback, useState } from 'react';
import type { RefObject } from 'react';
import { Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import Share from 'react-native-share';

import { useT } from '../labels/LabelsContext';

type Capturable = Parameters<typeof captureRef>[0];

export interface StatusShare {
  sharing: boolean;
  error: string | null;
  share: () => Promise<void>;
}

const WHATSAPP_PACKAGES: ReadonlyArray<{ pkg: string; social: string }> = [
  { pkg: 'com.whatsapp', social: Share.Social.WHATSAPP },
  { pkg: 'com.whatsapp.w4b', social: Share.Social.WHATSAPPBUSINESS },
];

function isDismissal(e: unknown): boolean {
  const message = (e as { message?: string } | null)?.message ?? '';
  return /did not share|user did not share|cancel/i.test(message);
}

async function installedWhatsApp(): Promise<string | null> {
  for (const candidate of WHATSAPP_PACKAGES) {
    try {
      const result = await Share.isPackageInstalled(candidate.pkg);
      if (result?.isInstalled) {
        return candidate.social;
      }
    } catch {
      // Not visible or not installed: try the next one.
    }
  }
  return null;
}

export interface StatusShareOptions {
  /** True only when `target` is a ScrollView: capture its full content, not just the visible part. */
  scrollView?: boolean;
}

export function useStatusShare(
  target: RefObject<unknown>,
  title: string,
  options: StatusShareOptions = {},
): StatusShare {
  const scrollView = options.scrollView === true;
  const t = useT();
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const share = useCallback(async () => {
    setError(null);
    setSharing(true);
    try {
      const uri = await captureRef(target as Capturable, {
        format: 'png',
        result: 'tmpfile',
        ...(scrollView ? { snapshotContentContainer: true } : {}),
      });
      const url = uri.startsWith('file://') ? uri : `file://${uri}`;
      const message = t('mob.share_status.message', { title });
      const social = Platform.OS === 'android' ? await installedWhatsApp() : null;
      if (social) {
        await Share.shareSingle({ social: social as never, url, type: 'image/png', message });
      } else {
        await Share.open({ url, type: 'image/png', message, title, failOnCancel: false });
      }
    } catch (e) {
      if (!isDismissal(e)) {
        console.warn('[share-status] share failed');
        setError(t('mob.share_status.error'));
      }
    } finally {
      setSharing(false);
    }
  }, [target, title, t, scrollView]);

  return { sharing, error, share };
}
