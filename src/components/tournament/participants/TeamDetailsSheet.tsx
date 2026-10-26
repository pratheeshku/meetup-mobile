/**
 * The team details pop-up (DES-MEETUP-ADDENDUM-teams-payments AD-11, board P4): the tournament team's name, sport and player count, the frozen
 * roster with the captain marked (names only when the server returned them: organizer, committee, the roster's own players and the registrant), then
 * the organizer section. Each player opens the existing user details pop-up. Reusable for any viewer: without the organizer section it shows the
 * name, the captain and the count.
 */
import React from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useT } from '../../../labels/LabelsContext';
import { borderWidth, colors, groupView, radius, sizes, spacing, typography } from '../../../theme/tokens';
import type { RegistrationRoster } from '../../../types/tournament';
import type { UserIdentity } from '../../../types/userMenu';
import ScreenContainer from '../../ScreenContainer';
import UserAvatar from '../../UserAvatar';

const AVATAR = 36;

export interface TeamDetailsSheetProps {
  name: string;
  /** The sport's display name. */
  sport: string;
  /** The count from the registration row, shown while the roster loads or when it fails. */
  playerCount: number | null;
  captainName: string | null;
  roster: RegistrationRoster | null;
  rosterStatus: 'loading' | 'ready' | 'failed';
  onOpenPlayer: (person: UserIdentity) => void;
  /** The organizer section (fee, payment, points, remove); absent for other viewers. */
  extras?: React.ReactNode;
  onClose: () => void;
}

export default function TeamDetailsSheet(props: TeamDetailsSheetProps): React.JSX.Element {
  const t = useT();
  const count = props.roster?.player_count ?? props.playerCount;
  const players = props.roster?.players ?? null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={props.onClose}>
      <View style={styles.root}>
        <Pressable style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={props.onClose} accessibilityRole="button" accessibilityLabel={t('mob.user_menu.close')} />
        <ScreenContainer edges="bottom" pointerEvents="box-none" style={styles.host}>
          <View style={styles.sheet} accessibilityViewIsModal testID="team-details-sheet">
            <View style={styles.grabber} />
            <View style={styles.head}>
              <Text style={styles.headTitle} accessibilityRole="header">
                {t('mob.part.details_title')}
              </Text>
              <Pressable onPress={props.onClose} accessibilityRole="button" accessibilityLabel={t('mob.user_menu.close')} style={styles.headClose} testID="team-details-close">
                <Text style={styles.headCloseText}>{t('mob.user_menu.close')}</Text>
              </Pressable>
            </View>
            <ScrollView>
              <View style={styles.identity}>
                <Text style={styles.name} testID="team-details-name">
                  {props.name}
                </Text>
                <Text style={styles.sub} testID="team-details-sub">
                  {count !== null ? t('mob.part.team_sub', { sport: props.sport, count }) : props.sport}
                </Text>
              </View>
              <View style={styles.roster} testID="team-details-roster">
                {props.rosterStatus === 'loading' ? (
                  <ActivityIndicator color={colors.primary} accessibilityLabel={t('mob.part.roster_loading')} />
                ) : players ? (
                  players.map(player => {
                    const display = player.display_name ?? '';
                    return (
                      <Pressable
                        key={player.user_id}
                        accessibilityRole="button"
                        accessibilityLabel={display}
                        onPress={() => props.onOpenPlayer({ userId: player.user_id, displayName: display, photoUrl: null })}
                        style={styles.playerRow}
                        testID={`team-player-${player.user_id}`}
                      >
                        <View style={styles.avatarBox}>
                          <UserAvatar name={display} size={AVATAR} fallback="initials" />
                        </View>
                        <Text style={styles.playerName} numberOfLines={1}>
                          {display}
                          {player.is_captain ? ` · ${t('mob.part.captain')}` : ''}
                        </Text>
                      </Pressable>
                    );
                  })
                ) : (
                  <Text style={styles.hidden} testID="team-details-hidden">
                    {props.captainName ? `${t('mob.part.captain')}: ${props.captainName}. ` : ''}
                    {t('mob.part.roster_hidden')}
                  </Text>
                )}
              </View>
              {props.extras}
            </ScrollView>
          </View>
        </ScreenContainer>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { backgroundColor: groupView.dim },
  host: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: '90%', backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, overflow: 'hidden' },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: groupView.divider, marginTop: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, minHeight: sizes.touchTarget },
  headTitle: { ...typography.bodyBold, color: colors.textPrimary },
  headClose: { minHeight: sizes.touchTarget, justifyContent: 'center' },
  headCloseText: { ...typography.body, color: colors.textSecondary },
  identity: { alignItems: 'center', paddingBottom: spacing.sm },
  name: { ...typography.h2, color: colors.textPrimary, textAlign: 'center' },
  sub: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  roster: { borderTopWidth: borderWidth.thin, borderTopColor: groupView.divider, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  playerRow: { flexDirection: 'row', alignItems: 'center', minHeight: sizes.touchTarget },
  avatarBox: { width: AVATAR, height: AVATAR, marginRight: spacing.sm },
  playerName: { ...typography.body, color: colors.textPrimary, flex: 1 },
  hidden: { ...typography.caption, color: colors.textSecondary },
});
