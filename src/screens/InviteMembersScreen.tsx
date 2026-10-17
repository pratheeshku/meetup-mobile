/**
 * Group creation, step 2: "Invite members" (DES-MEETUP-FEEDBACK-001 C4,
 * R-05 to R-08; design-ref-p23/CreateGroup2.png).
 */
import React, { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { withCorrelationId } from '../api/correlationId';
import { createGroupInvitation, inviteMember } from '../api/groups';
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import UserSearchPicker from '../components/UserSearchPicker';
import WizardFooter from '../components/WizardFooter';
import WizardHeader from '../components/WizardHeader';
import { useT } from '../labels/LabelsContext';
import { readGroupCreateDraft } from '../navigation/groupCreateDraft';
import { showCompletion } from '../navigation/showCompletion';
import type { GroupsStackParamList } from '../navigation/types';
import { borderWidth, colors, radius, spacing, typography } from '../theme/tokens';
import type { UserSearchResult } from '../types/user';
import { addInviteEmail } from '../utils/inviteEmails';

type Props = NativeStackScreenProps<GroupsStackParamList, 'InviteMembers'>;

const AVATAR_TINTS = [
  { bg: colors.avatarTint1, text: colors.avatarTintText1 },
  { bg: colors.avatarTint2, text: colors.avatarTintText2 },
  { bg: colors.avatarTint3, text: colors.avatarTintText3 },
  { bg: colors.avatarTint4, text: colors.avatarTintText4 },
  { bg: colors.avatarTint5, text: colors.avatarTintText5 },
];

function getAvatarTint(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return AVATAR_TINTS[Math.abs(hash) % AVATAR_TINTS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  }
  return (name.trim().slice(0, 2) || '?').toUpperCase();
}

export default function InviteMembersScreen({ navigation, route }: Props): React.JSX.Element {
  const { groupId } = route.params;
  const t = useT();

  const [added, setAdded] = useState<UserSearchResult[]>([]);
  const [addedEmails, setAddedEmails] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const inFlight = useRef(false);

  // One search field: a name adds that person; a valid email that matches nobody
  // is invited by email (same `POST /groups/invitations` call as Group Detail).
  const handleAdd = async (user: UserSearchResult): Promise<void> => {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    try {
      await withCorrelationId(correlationId =>
        inviteMember(groupId, user.id, { correlationId }),
      );
      setAdded(current =>
        current.some(item => item.id === user.id) ? current : [...current, user],
      );
    } catch {
      setError(t('mob.invite.add_error'));
    } finally {
      inFlight.current = false;
    }
  };

  const handleAddEmail = async (email: string): Promise<void> => {
    const next = addInviteEmail(addedEmails, email);
    if (!next.ok || inFlight.current) return; // already invited (case-insensitive) or busy
    inFlight.current = true;
    setError(null);
    try {
      await withCorrelationId(correlationId =>
        createGroupInvitation(groupId, { invitedEmail: email, correlationId }),
      );
      setAddedEmails(next.emails);
    } catch {
      setError(t('mob.invite.add_error'));
    } finally {
      inFlight.current = false;
    }
  };

  const finish = (): void => {
    const draft = readGroupCreateDraft(groupId);
    const names = [
      ...added.map(user => user.display_name.trim()).filter(name => name.length > 0),
      ...addedEmails,
    ];
    const total = added.length + addedEmails.length;
    const membersValue = names.length > 0 ? `${total} — ${names.join(', ')}` : String(total);
    showCompletion({
      flow: 'group_created',
      rows: [
        { label: t('mob.done.f_name'), value: draft?.name ?? '' },
        {
          label: t('mob.done.f_description'),
          value: draft?.description ? draft.description : t('mob.done.v_none'),
        },
        {
          label: t('mob.done.f_logo'),
          value: t(draft?.logoAdded ? 'mob.done.v_added' : 'mob.done.v_none'),
        },
        { label: t('mob.done.f_members'), value: membersValue },
      ],
      primary: 'dashboard',
      secondary: { button: 'view_group', id: groupId },
    });
  };

  const addedCard =
    added.length + addedEmails.length > 0 ? (
      <View style={styles.addedCard}>
        <View style={styles.addedHeader}>
          <Text style={styles.addedTitle}>{t('mob.create_game.review_header')}</Text>
          <View style={styles.addedPill}>
            <Text style={styles.addedPillText}>
              {t('mob.invite.added_pill', { count: added.length + addedEmails.length })}
            </Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.addedRow}>
          {added.map(user => {
            const tint = getAvatarTint(user.display_name);
            const firstName = user.display_name.trim().split(/\s+/)[0];
            return (
              <View key={user.id} style={styles.addedItem}>
                <View style={[styles.avatarCircleLarge, { backgroundColor: tint.bg }]}>
                  <Text style={[styles.avatarTextLarge, { color: tint.text }]}>
                    {getInitials(user.display_name)}
                  </Text>
                </View>
                <Text style={styles.addedName} numberOfLines={1}>
                  {firstName}
                </Text>
              </View>
            );
          })}
          {addedEmails.map(email => {
            const tint = getAvatarTint(email);
            return (
              <View key={email.toLowerCase()} style={styles.addedItem}>
                <View style={[styles.avatarCircleLarge, { backgroundColor: tint.bg }]}>
                  <Text style={[styles.avatarTextLarge, { color: tint.text }]}>
                    {email.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.addedName} numberOfLines={1}>
                  {email}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      </View>
    ) : null;

  return (
    <View style={styles.screen}>
      <WizardHeader
        title={t('mob.invite.step_title')}
        currentStep={2}
        totalSteps={2}
        onBack={() => navigation.goBack()}
      />

      <KeyboardAwareScreen
        contentContainerStyle={styles.content}
      >
        <UserSearchPicker
          onSelect={handleAdd}
          onSelectEmail={handleAddEmail}
          excludeGroupId={groupId}
          excludeUserIds={added.map(user => user.id)}
          suggestionContext="group_members"
          placeholder={t('mob.create_game.search_players_placeholder')}
          belowInput={addedCard}
        />

        <Text style={styles.helperText}>{t('mob.invite.suggested_players_hint')}</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </KeyboardAwareScreen>

      <WizardFooter
        nextLabel={t('mob.invite.create_group_button')}
        backLabel={t('mob.invite.skip_for_now')}
        onNext={finish}
        onBack={finish}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  addedCard: {
    backgroundColor: colors.surface,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  addedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  addedTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  addedPill: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  addedPillText: {
    ...typography.caption,
    color: colors.primaryDark,
    fontWeight: '600',
  },
  addedRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  addedItem: {
    alignItems: 'center',
    width: 60,
  },
  avatarCircleLarge: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  avatarTextLarge: {
    ...typography.bodyBold,
  },
  addedName: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  helperText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
