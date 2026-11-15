/**
 * Signed-in confirm for a group invitation link (group-invite-existing-accounts AD-4, D-1). Opening the link
 * joins nobody: this screen shows the group name from `GET /public/groups/invitations/{token}` and waits for
 * Join (`POST /groups/invitations/join`, one correlation ID per tap) or Not now. No board exists; the layout,
 * components and tokens are those of `GroupInviteScreen`. The token lives in `links/linkStore` memory only and is
 * dropped after Join, Not now or a failure: never route params, storage or logs.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { withCorrelationId } from '../api/correlationId';
import { joinGroupByInvitation } from '../api/groups';
import { getPublicGroupInvitation } from '../api/publicLinks';
import Button from '../components/Button';
import LoadingView from '../components/LoadingView';
import ScreenContainer from '../components/ScreenContainer';
import TextLink from '../components/TextLink';
import { useT } from '../labels/LabelsContext';
import { clearGroupJoinToken, getGroupJoinToken } from '../links/linkStore';
import type { GroupsStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme/tokens';
import { isNetworkError, NETWORK_ERROR_MESSAGE, SERVER_ERROR_MESSAGE } from '../utils/networkError';

type Props = NativeStackScreenProps<GroupsStackParamList, 'GroupInviteJoin'>;

type Name = { status: 'loading' } | { status: 'ready'; name: string | null };

function httpStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } } | null)?.response?.status;
}

export default function GroupInviteJoinScreen({ navigation }: Props): React.JSX.Element {
  const t = useT();
  const [token] = useState(() => getGroupJoinToken());
  const [name, setName] = useState<Name>({ status: 'loading' });
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toGroupsList = useCallback((): void => {
    clearGroupJoinToken();
    navigation.replace('GroupsList');
  }, [navigation]);

  useEffect(() => {
    if (!token) {
      // Nothing to confirm (the token was already used or dropped): the Groups list.
      navigation.replace('GroupsList');
      return;
    }
    let active = true;
    getPublicGroupInvitation(token)
      .then(({ group_name }) => active && setName({ status: 'ready', name: group_name }))
      // A failed preview is not a verdict: Join decides, so show the generic question.
      .catch(() => active && setName({ status: 'ready', name: null }));
    return () => {
      active = false;
    };
  }, [token, navigation]);

  const join = async (): Promise<void> => {
    if (!token || joining) {
      return;
    }
    setError(null);
    setJoining(true);
    try {
      const { group_id } = await withCorrelationId(correlationId => joinGroupByInvitation(token, { correlationId }));
      clearGroupJoinToken();
      // `joined` and `already_member` both open the group.
      navigation.replace('GroupDetail', { groupId: group_id });
    } catch (e) {
      setJoining(false);
      if (httpStatus(e) === 404) {
        // Every token failure is the same neutral message (AD-2); the token is no use any more.
        Alert.alert(t('mob.group_invite.title'), t('mob.group_invite.invalid'));
        toGroupsList();
      } else {
        // Network or server error: stay here, the token is kept, Join can be tapped again.
        setError(t(isNetworkError(e) ? NETWORK_ERROR_MESSAGE : SERVER_ERROR_MESSAGE));
      }
    }
  };

  return (
    <ScreenContainer edges="bottom">
      <ScrollView contentContainerStyle={styles.container}>
        {name.status === 'loading' ? <LoadingView /> : null}
        {name.status === 'ready' ? (
          <Text style={styles.message}>
            {name.name
              ? t('mob.group_invite.join_question', { name: name.name })
              : t('mob.group_invite.join_question_generic')}
          </Text>
        ) : null}
        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        <Button
          label={t('mob.group_invite.join')}
          onPress={join}
          loading={joining}
          disabled={name.status !== 'ready'}
          style={styles.button}
        />
        <TextLink label={t('mob.group_invite.not_now')} onPress={toGroupsList} style={styles.link} />
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
  error: { ...typography.body, color: colors.error, marginBottom: spacing.md, textAlign: 'center' },
  button: { marginBottom: spacing.md },
  link: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
});
