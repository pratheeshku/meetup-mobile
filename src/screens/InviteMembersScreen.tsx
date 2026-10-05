/**
 * Group creation, step 2: "Invite members" (DES-MEETUP-FEEDBACK-001 C4,
 * R-05 to R-08). Optional; Done and Skip both go to the dashboard (C3).
 *
 * "Suggested members" shows up to 5 cards from the suggestions endpoint
 * (`getSuggestedMembers`). Tapping a card calls the existing add-member call
 * (`inviteMember`); its response carries the next candidate, which replaces
 * the tapped card so 5 stay shown — when there is none the list shrinks. The
 * full list is never re-queried. Repeated taps are ignored while a call is in
 * flight. Display names, nicknames and image URLs are never logged.
 *
 * A search box (the shared `UserSearchPicker`) adds people through the same
 * `inviteMember` call. Everyone added on this screen moves into an "Added (n)"
 * list (screen-local state; resets on leave, no remove action) and is excluded
 * from the suggestions and the search results.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { withCorrelationId } from '../api/correlationId';
import { getSuggestedMembers, inviteMember } from '../api/groups';
import Button from '../components/Button';
import InlineError from '../components/InlineError';
import LoadingView from '../components/LoadingView';
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

function SuggestionCard({
  member,
  busy,
  onPress,
}: {
  member: SuggestedMember;
  busy: boolean;
  onPress: (member: SuggestedMember) => void;
}): React.JSX.Element {
  const t = useT();
  const nickname = (member.nickname ?? '').trim();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('mob.invite.card_a11y', { name: member.display_name })}
      onPress={() => onPress(member)}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
      testID="suggested-member-card"
    >
      <UserAvatar imageUrl={member.image_url} name={member.display_name} size={AVATAR_SIZE} />
      <View style={styles.cardText}>
        <Text style={styles.displayName} numberOfLines={1}>
          {member.display_name}
        </Text>
        {nickname ? (
          <Text style={styles.nickname} numberOfLines={1}>
            {nickname}
          </Text>
        ) : null}
      </View>
      {busy ? <ActivityIndicator size="small" color={colors.primary} /> : null}
    </Pressable>
  );
}

export default function InviteMembersScreen({ route }: Props): React.JSX.Element {
  const { groupId } = route.params;
  const t = useT();
  const tRef = useRef(t);
  tRef.current = t;

  const [members, setMembers] = useState<SuggestedMember[] | null>(null);
  const membersRef = useRef<SuggestedMember[] | null>(null);
  membersRef.current = members;
  const [loadFailed, setLoadFailed] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [added, setAdded] = useState<SuggestedMember[]>([]);
  const [addingUserId, setAddingUserId] = useState<string | null>(null);
  // Synchronous guard: a state flag alone would let a second tap in the same
  // frame through before the re-render.
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    setLoadFailed(false);
    setMembers(null);
    try {
      setMembers(await withCorrelationId(correlationId => getSuggestedMembers(groupId, { correlationId })));
    } catch {
      setLoadFailed(true);
    }
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  /** One silent refetch (no loading state) after a response without a next candidate. */
  const refillSuggestions = async (): Promise<void> => {
    try {
      const fresh = await withCorrelationId(correlationId =>
        getSuggestedMembers(groupId, { correlationId }),
      );
      setMembers(fresh);
    } catch {
      // Keep the current list; the refetch is best-effort.
    }
  };

  const handleAdd = async (member: SuggestedMember): Promise<void> => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setAddingUserId(member.user_id);
    setAddError(null);
    try {
      const result = await withCorrelationId(correlationId =>
        inviteMember(groupId, member.user_id, { correlationId }),
      );
      setAdded(current =>
        current.some(item => item.user_id === member.user_id) ? current : [...current, member],
      );
      // Read from a ref: a state updater may run after this line, so it can't report back.
      const wasSuggested = membersRef.current?.some(item => item.user_id === member.user_id) ?? false;
      setMembers(current => {
        if (!current) {
          return current;
        }
        const index = current.findIndex(item => item.user_id === member.user_id);
        if (index < 0) {
          return current;
        }
        const next = result.nextCandidate;
        const alreadyShown = next ? current.some(item => item.user_id === next.user_id) : false;
        const updated = [...current];
        if (next && !alreadyShown) {
          updated[index] = next;
        } else {
          updated.splice(index, 1);
        }
        return updated;
      });
      if (wasSuggested && !result.nextCandidate) {
        await refillSuggestions();
      }
    } catch (e) {
      if (isAlreadyMemberOrInvited(e)) {
        // 400 with code `already_member_or_invited`: treat as done. Drop the card, no error,
        // and refetch once to keep up to 5 shown.
        setMembers(current => current && current.filter(item => item.user_id !== member.user_id));
        await refillSuggestions();
      } else {
        setAddError(tRef.current('mob.invite.add_error'));
      }
    } finally {
      inFlight.current = false;
      setAddingUserId(null);
    }
  };

  const handleSelectSearchResult = (user: UserSearchResult): void => {
    handleAdd({
      user_id: user.id,
      display_name: user.display_name ?? '',
      nickname: user.nickname ?? '',
      image_url: user.image_url ?? null,
    });
  };

  const addedIds = added.map(item => item.user_id);
  const visibleMembers = members === null ? null : members.filter(item => !addedIds.includes(item.user_id));

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

      <Text style={styles.sectionTitle} accessibilityRole="header">
        {t('mob.invite.suggested_title')}
      </Text>

      {loadFailed ? (
        <InlineError message={t('mob.invite.load_error')} onRetry={load} />
      ) : visibleMembers === null ? (
        <View style={styles.loading}>
          <LoadingView />
        </View>
      ) : visibleMembers.length === 0 ? (
        <Text style={styles.empty}>{t('mob.invite.empty')}</Text>
      ) : (
        visibleMembers.map(member => (
          <SuggestionCard
            key={member.user_id}
            member={member}
            busy={addingUserId === member.user_id}
            onPress={handleAdd}
          />
        ))
      )}

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
  loading: { height: sizes.touchTarget * 2 },
  empty: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
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
  pressed: { opacity: 0.85 },
  cardText: { flex: 1, marginLeft: spacing.md },
  displayName: { ...typography.bodyBold, color: colors.textPrimary },
  nickname: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  error: { ...typography.body, color: colors.error, marginVertical: spacing.sm },
  done: { marginTop: spacing.lg },
  skip: { marginTop: spacing.sm },
});
