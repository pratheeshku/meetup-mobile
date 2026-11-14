/**
 * Public game preview for a signed-out person (deep-links AD-8). Opened by a game link. Shows the 7
 * fields of `GET /public/events/{id}` (no auth) with two actions: "Sign up to join" and "Already have
 * an account? Log in". The target stays in memory (`links/linkStore`), so after sign-up and sign-in
 * the person lands on the game; `ref` and `invite` ride along at sign-up.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { getPublicEventPreview } from '../api/publicLinks';
import type { PublicEventPreview } from '../api/publicLinks';
import Button from '../components/Button';
import GamePreviewCard from '../components/GamePreviewCard';
import InlineError from '../components/InlineError';
import LoadingView from '../components/LoadingView';
import ScreenContainer from '../components/ScreenContainer';
import TextLink from '../components/TextLink';
import { useT } from '../labels/LabelsContext';
import { peekPendingTarget } from '../links/linkStore';
import type { AuthStackParamList } from '../navigation/types';
import { spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<AuthStackParamList, 'GamePreview'>;

export default function GamePreviewScreen({ navigation }: Props): React.JSX.Element {
  const t = useT();
  const [target] = useState(() => {
    const pending = peekPendingTarget();
    return pending?.kind === 'game' ? pending : null;
  });
  const [preview, setPreview] = useState<PublicEventPreview | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    if (!target) {
      return;
    }
    setFailed(false);
    try {
      setPreview(await getPublicEventPreview(target.eventId, target.ref));
    } catch {
      setFailed(true);
    }
  }, [target]);

  useEffect(() => {
    if (!target) {
      navigation.navigate('Login');
      return;
    }
    load();
  }, [target, load, navigation]);

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
        <Button
          label={t('mob.link_preview.sign_up')}
          onPress={() => navigation.navigate('Register')}
          style={styles.button}
        />
        <TextLink
          label={t('mob.link_preview.log_in')}
          onPress={() => navigation.navigate('Login')}
          style={styles.link}
        />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  button: { marginBottom: spacing.md },
  link: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
});
