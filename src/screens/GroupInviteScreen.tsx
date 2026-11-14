/**
 * Group invitation landing for a signed-out person (deep-links AD-10). Shows the group name from
 * `GET /public/groups/invitations/{token}` (response: `group_name` only), then Sign up / Log in. The
 * join happens on the server at account creation, when the token is sent as `invitation_token`; a
 * person who already has an account is not joined by the link (OI-8) and lands on the Groups list
 * after sign-in. The token stays in memory (`links/linkStore`), never in route params or logs.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { getPublicGroupInvitation } from '../api/publicLinks';
import Button from '../components/Button';
import LoadingView from '../components/LoadingView';
import ScreenContainer from '../components/ScreenContainer';
import TextLink from '../components/TextLink';
import { useT } from '../labels/LabelsContext';
import { peekPendingTarget } from '../links/linkStore';
import type { AuthStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme/tokens';

type Props = NativeStackScreenProps<AuthStackParamList, 'GroupInvite'>;

type State = { status: 'loading' } | { status: 'ready'; name: string | null } | { status: 'invalid' };

export default function GroupInviteScreen({ navigation }: Props): React.JSX.Element {
  const t = useT();
  const [target] = useState(() => {
    const pending = peekPendingTarget();
    return pending?.kind === 'group_invite' ? pending : null;
  });
  const [state, setState] = useState<State>({ status: 'loading' });

  const load = useCallback(async (): Promise<void> => {
    if (!target) {
      return;
    }
    try {
      const { group_name } = await getPublicGroupInvitation(target.token);
      setState({ status: 'ready', name: group_name });
    } catch {
      // Unknown, used or expired: one neutral message, never why.
      setState({ status: 'invalid' });
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
        {state.status === 'loading' ? <LoadingView /> : null}
        {state.status === 'ready' ? (
          <Text style={styles.message}>
            {state.name
              ? t('mob.group_invite.invited_to', { name: state.name })
              : t('mob.group_invite.invited_generic')}
          </Text>
        ) : null}
        {state.status === 'invalid' ? <Text style={styles.message}>{t('mob.group_invite.invalid')}</Text> : null}
        {state.status !== 'invalid' ? (
          <Button
            label={t('mob.link_preview.sign_up')}
            onPress={() => navigation.navigate('Register')}
            style={styles.button}
          />
        ) : null}
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
  message: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  button: { marginBottom: spacing.md },
  link: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
});
