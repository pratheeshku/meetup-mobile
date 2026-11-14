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
import { countLinkGenerated } from '../links/linkCounters';
import { buildShareLink } from '../links/shareLinks';
import type { ShareTarget } from '../links/shareLinks';
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

/** The sharer's display name and id; blank when there is no auth provider (the name placeholder is then blank). */
function useSharer(): { name: string; id: string } {
  try {
    // Called unconditionally on every render; the try only absorbs the missing-provider throw.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { user } = useAuth();
    return { name: user?.display_name || user?.nickname || '', id: user?.id ?? '' };
  } catch {
    return { name: '', id: '' };
  }
}

/**
 * The share text is the admin-label GameOn SG invite message (see `utils/shareInvite`), then a blank
 * line and a link:
 * - `groupId`: the server's `invitation_url`, unchanged.
 * - `target` (a game or tournament; deep-links AD-11): a link built from `link_base_url` and
 *   `app_links_enabled` in `GET /config/client` (`links/shareLinks`). No base: the message alone.
 * When `share.invite_message` is missing nothing is shared. A failing config call never aborts the
 * share: it falls back to the message with no store lines and no link.
 */
export function useAppShare(groupId?: string | null, target?: ShareTarget): AppShare {
  const t = useT();
  const labels = useLabels();
  const { name, id: userId } = useSharer();
  const targetKind = target?.kind;
  const targetId = target ? (target.kind === 'game' ? target.eventId : target.tournamentId) : null;
  const [sheetVisible, setSheetVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const open = useCallback(() => {
    setSheetVisible(true);
  }, []);

  const close = useCallback(() => setSheetVisible(false), []);
  const clearToast = useCallback(() => setToastMessage(null), []);

  /** The text to share, or '' when nothing should be shared. */
  const composeText = useCallback(async (): Promise<string> => {
    let config: Awaited<ReturnType<typeof getClientConfig>> | null = null;
    try {
      config = await getClientConfig();
    } catch {
      config = null;
    }
    const urls = { android: config?.android_store_url, ios: config?.ios_store_url };
    if (!groupId) {
      const built =
        targetKind && targetId
          ? buildShareLink(config, targetKind === 'game' ? { kind: 'game', eventId: targetId } : { kind: 'tournament', tournamentId: targetId }, userId)
          : null;
      const text = buildShareText(labels, name, urls, built?.url);
      if (built && text && targetKind) {
        countLinkGenerated(targetKind, built.form);
      }
      return text;
    }
    // Check the label before creating an invitation, so a missing label creates nothing.
    if (!buildShareText(labels, name, urls)) {
      return '';
    }
    const { invitation_url } = await withCorrelationId(correlationId =>
      createGroupInvitation(groupId, { correlationId }),
    );
    return buildShareText(labels, name, urls, invitation_url);
  }, [groupId, labels, name, userId, targetKind, targetId]);

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
