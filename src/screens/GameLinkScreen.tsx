/**
 * Game link for a signed-in person (deep-links AD-8). The normal authenticated `GET /events/{id}` is
 * the access check: with access the screen is replaced by EventDetailScreen; when the server refuses
 * (404, or 403) the public preview shows with the existing access notice and NO join action. A link
 * grants nothing; the server decides.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { getEvent } from '../api/events';
import { getPublicEventPreview } from '../api/publicLinks';
import type { PublicEventPreview } from '../api/publicLinks';
import GamePreviewCard from '../components/GamePreviewCard';
import InlineError from '../components/InlineError';
import LoadingView from '../components/LoadingView';
import ScreenContainer from '../components/ScreenContainer';
import { useT } from '../labels/LabelsContext';
import { countLinkOpened } from '../links/linkCounters';
import { showAccessNotice } from '../navigation/accessNotice';
import type { HomeStackParamList } from '../navigation/types';
import { spacing } from '../theme/tokens';
import { getHttpStatus } from '../utils/networkError';

type Props = NativeStackScreenProps<HomeStackParamList, 'GameLink'>;

export default function GameLinkScreen({ navigation, route }: Props): React.JSX.Element {
  const t = useT();
  const { eventId, ref } = route.params;
  const [preview, setPreview] = useState<PublicEventPreview | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    setFailed(false);
    try {
      await getEvent(eventId);
    } catch (error) {
      const status = getHttpStatus(error);
      if (status !== 404 && status !== 403) {
        setFailed(true);
        return;
      }
      // No access: the public preview, the access notice, no join action.
      countLinkOpened('game', 'not_available');
      showAccessNotice();
      try {
        setPreview(await getPublicEventPreview(eventId, ref));
      } catch {
        setFailed(true);
      }
      return;
    }
    countLinkOpened('game', 'opened_target');
    navigation.replace('EventDetail', { eventId });
  }, [eventId, ref, navigation]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ScreenContainer edges="bottom">
      <ScrollView contentContainerStyle={styles.container}>
        {preview ? (
          <GamePreviewCard preview={preview} />
        ) : failed ? (
          <InlineError message={t('mob.link_preview.unavailable')} onRetry={load} retryLabel={t('mob.common.retry')} />
        ) : (
          <LoadingView />
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
});
