/**
 * Share-sheet state and actions for the single app-download link
 * (DES-MEETUP-FEEDBACK-001 C5). Shared by the Game and Group screens so both
 * share exactly the same URL and label-backed text.
 */
import { useCallback, useState } from 'react';

import { useT } from '../labels/LabelsContext';
import {
  copyLinkToClipboard,
  getShareUrl,
  shareGeneric,
  shareToWhatsApp,
} from '../utils/shareLink';

export interface AppShare {
  sheetVisible: boolean;
  toastMessage: string | null;
  clearToast: () => void;
  open: () => void;
  close: () => void;
  shareViaSystem: () => Promise<void>;
  shareViaWhatsApp: () => Promise<void>;
  copyLink: () => void;
}

export function useAppShare(): AppShare {
  const t = useT();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const open = useCallback(() => {
    if (!getShareUrl()) {
      setToastMessage(t('mob.share.unavailable'));
      return;
    }
    setSheetVisible(true);
  }, [t]);

  const close = useCallback(() => setSheetVisible(false), []);
  const clearToast = useCallback(() => setToastMessage(null), []);

  const shareViaSystem = useCallback(async () => {
    const url = getShareUrl();
    if (!url) {
      return;
    }
    await shareGeneric({ message: t('mob.share.message', { link: url }) });
  }, [t]);

  const shareViaWhatsApp = useCallback(async () => {
    const url = getShareUrl();
    if (!url) {
      return;
    }
    await shareToWhatsApp(t('mob.share.message', { link: url }));
  }, [t]);

  const copyLink = useCallback(() => {
    const url = getShareUrl();
    if (!url) {
      return;
    }
    copyLinkToClipboard(url);
    setSheetVisible(false);
    setToastMessage(t('mob.share.link_copied'));
  }, [t]);

  return {
    sheetVisible,
    toastMessage,
    clearToast,
    open,
    close,
    shareViaSystem,
    shareViaWhatsApp,
    copyLink,
  };
}
