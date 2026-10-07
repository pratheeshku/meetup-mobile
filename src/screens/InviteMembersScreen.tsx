/**
 * Group creation, step 2: "Invite members" (DES-MEETUP-FEEDBACK-001 C4,
 * R-05 to R-08). Optional; Done and Skip both go to the dashboard (C3).
 *
 * The shared `UserSearchPicker` (group-members context) lists up to 10 people
 * and searches; tapping a row calls the existing add-member call
 * (`inviteMember`). After a successful add the person moves into an "Added (n)"
 * list (screen-local state; resets on leave, no remove action) and the picker
 * refetches silently so the list refills. Repeated taps are ignored while a
 * call is in flight. A 400 with code `already_member_or_invited` counts as
 * already done. Display names, nicknames and image URLs are never logged.
 */
import React, { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { withCorrelationId } from '../api/correlationId';
import { inviteMember } from '../api/groups';
import Button from '../components/Button';
import UserAvatar from '../components/UserAvatar';
import UserSearchPicker from '../components/UserSearchPicker';
import { useT } from '../labels/LabelsContext';
import { goToDashboard } from '../navigation/goToDashboard';
import type { GroupsStackParamList } from '../navigation/types';
import { borderWidth, colors, radius, sizes, spacing, typography } from '../theme/tokens';
import type { SuggestedMember } from '../types/group';
import type { UserSearchResult } from '../types/user';

type Props = NativeStackScreenProps<GroupsStackParamList, 'InviteMembers'>;

const AVATAR_SIZE = 48;

/** Only a 400 whose body has `code = "already_member_or_invited"` counts as already done. */
function isAlreadyMemberOrInvited(error: unknown): boolean {
  const response = (error as { response?: { status?: number; data?: { code?: unknown } } } | null)
    ?.response;
  return response?.status === 400 && response?.data?.code === 'already_member_or_invited';
}

export default function InviteMembersScreen({ route }: Props): React.JSX.Element {
  const { groupId } = route.params;
  const t = useT();
  const tRef = useRef(t);
  tRef.current = t;

  const [addError, setAddError] = useState<string | null>(null);
  const [added, setAdded] = useState<SuggestedMember[]>([]);
  const [refreshToken, setRefreshToken] = useState(0);
  // Synchronous guard: a state flag alone would let a second tap in the same
  // frame through before the re-render.
  const inFlight = useRef(false);

  const handleAdd = async (member: SuggestedMember): Promise<void> => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setAddError(null);
    try {
      await withCorrelationId(correlationId =>
        inviteMember(groupId, member.user_id, { correlationId }),
      );
      setAdded(current =>
        current.some(item => item.user_id === member.user_id) ? current : [...current, member],
      );
    } catch (e) {
      if (isAlreadyMemberOrInvited(e)) {
        // Treat as done: no error; the refetch below drops the person from the list.
      } else {
        setAddError(tRef.current('mob.invite.add_error'));
      }
    } finally {
      inFlight.current = false;
      // Silent refetch so the list refills up to 10.
      setRefreshToken(token => token + 1);
    }
  };

  const handleSelectSearchResult = (user: UserSearchResult): Promise<void> =>
    handleAdd({
      user_id: user.id,
      display_name: user.display_name ?? '',
      nickname: user.nickname ?? '',
      image_url: user.image_url ?? null,
    });

  const addedIds = added.map(item => item.user_id);

  const finish = (): void => {
    goToDashboard(t('mob.success.group_created'));
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title} accessibilityRole="header">
        {t('mob.invite.title')}
      </Text>
      <Text style={styles.subtitle}>{t('mob.invite.subtitle')}</Text>

      <View style={styles.search}>
        <UserSearchPicker
          onSelect={handleSelectSearchResult}
          excludeGroupId={groupId}
          excludeUserIds={addedIds}
          placeholder={t('mob.invite.search_placeholder')}
          suggestionContext="group_members"
          refreshToken={refreshToken}
        />
      </View>

      {added.length > 0 ? (
        <>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            {t('mob.invite.added_title', { count: String(added.length) })}
          </Text>
          {added.map(member => (
            <View
              key={member.user_id}
              style={styles.card}
              accessible
              accessibilityLabel={t('mob.invite.added_a11y', { name: member.display_name })}
              testID="added-member-row"
            >
              <UserAvatar imageUrl={member.image_url} name={member.display_name} size={AVATAR_SIZE} />
              <View style={styles.cardText}>
                <Text style={styles.displayName} numberOfLines={1}>
                  {member.display_name}
                </Text>
                {(member.nickname ?? '').trim() ? (
                  <Text style={styles.nickname} numberOfLines={1}>
                    {member.nickname.trim()}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </>
      ) : null}

      {addError ? (
        <Text style={styles.error} accessibilityRole="alert">
          {addError}
        </Text>
      ) : null}

      <Button label={t('mob.common.done')} onPress={finish} style={styles.done} />
      <Button label={t('mob.common.skip')} variant="secondary" onPress={finish} style={styles.skip} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg },
  title: { ...typography.h2, color: colors.textPrimary },
  subtitle: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  sectionTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  search: { marginTop: spacing.lg },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: sizes.touchTarget,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardText: { flex: 1, marginLeft: spacing.md },
  displayName: { ...typography.bodyBold, color: colors.textPrimary },
  nickname: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  error: { ...typography.body, color: colors.error, marginVertical: spacing.sm },
  done: { marginTop: spacing.lg },
  skip: { marginTop: spacing.sm },
});
