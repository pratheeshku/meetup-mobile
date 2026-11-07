/**
 * Share-sheet state and actions for the single app-download link
 * (DES-MEETUP-FEEDBACK-001 C5). Shared by the Game and Group screens so both
 * share exactly the same URL and label-backed text.
 */
import { useCallback, useState } from 'react';

import { getClientConfig } from '../api/config';
import { withCorrelationId } from '../api/correlationId';
import { createGroupInvitation } from '../api/groups';
import { useAuth } from '../auth/AuthContext';
import { useLabels, useT } from '../labels/LabelsContext';
import {
  copyLinkToClipboard,
  getShareUrl,
  shareGeneric,
  shareToWhatsApp,
} from '../utils/shareLink';
import { buildShareText } from '../utils/shareInvite';

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

/** The sharer's display name; '' when there is no auth provider (the name placeholder is then blank). */
function useSharerName(): string {
  try {
    // Called unconditionally on every render; the try only absorbs the missing-provider throw.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { user } = useAuth();
    return user?.display_name || user?.nickname || '';
  } catch {
    return '';
  }
}

/**
 * TASK 3.1: the share text is the admin-label GameOn SG invite message (see
 * `utils/shareInvite`). Game and tournament shares send it alone; pass
 * `groupId` for a group share, which appends the group invite link after a
 * blank line. When `share.invite_message` is missing nothing is shared.
 */
export function useAppShare(groupId?: string | null): AppShare {
  const t = useT();
  const labels = useLabels();
  const name = useSharerName();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const open = useCallback(() => {
    setSheetVisible(true);
  }, []);

  const close = useCallback(() => setSheetVisible(false), []);
  const clearToast = useCallback(() => setToastMessage(null), []);

  /** The text to share, or '' when nothing should be shared. */
  const composeText = useCallback(async (): Promise<string> => {
    const { android_store_url, ios_store_url } = await getClientConfig();
    const urls = { android: android_store_url, ios: ios_store_url };
    if (!groupId) {
      return buildShareText(labels, name, urls);
    }
    // Check the label before creating an invitation, so a missing label creates nothing.
    if (!buildShareText(labels, name, urls)) {
      return '';
    }
    const { invitation_url } = await withCorrelationId(correlationId =>
      createGroupInvitation(groupId, { correlationId }),
    );
    return buildShareText(labels, name, urls, invitation_url);
  }, [groupId, labels, name]);

  const shareViaSystem = useCallback(async () => {
    const message = await composeText();
    if (!message) {
      return;
    }
    await shareGeneric({ message });
  }, [composeText]);

  const shareViaWhatsApp = useCallback(async () => {
    const message = await composeText();
    if (!message) {
      return;
    }
    await shareToWhatsApp(message);
  }, [composeText]);

  const copyLink = useCallback(() => {
    const url = getShareUrl();
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
