/**
 * Review fixtures (board TV2MobReviewFixtures; addendum AD-T12): the second committee member reads the submitted draw
 * before deciding. Built from `GET .../drafts/{id}`, which carries registration ids; they are shown as the names of the
 * participants the page already loads, never as ids. Approve and publish and Reject use the existing routes. Reject takes
 * NO reason: the board's reason field is dropped (addendum supersession; the route takes none).
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { withCorrelationId } from '../../../../api/correlationId';
import { getFixtureDraft } from '../../../../api/tournaments';
import { useT } from '../../../../labels/LabelsContext';
import { dash } from '../../../../theme/dashboardTheme';
import { borderWidth, colors, radius, spacing, typography } from '../../../../theme/tokens';
import type { DraftDetail } from '../../../../types/tournamentTabs';
import { draftPlayerCount } from '../../../../utils/fixturesSetup';
import { formatClock } from '../../../../utils/tournamentExperience';
import Button from '../../../Button';
import { CrossIcon } from '../../../icons/ActionIcons';
import { Chip } from './parts';

const CLOSE = 40;
const SHOWN = 4;

export default function ReviewFixturesSheet(props: {
  tournamentId: string;
  draftId: string;
  /** "Requested by {name} · {when}", built from the request. */
  requestedBy: string;
  names: ReadonlyMap<string, string>;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onClose: () => void;
}): React.JSX.Element {
  const t = useT();
  const [draft, setDraft] = useState<DraftDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [all, setAll] = useState(false);

  useEffect(() => {
    withCorrelationId(correlationId => getFixtureDraft(props.tournamentId, props.draftId, { correlationId }))
      .then(setDraft)
      .catch(() => setFailed(true));
  }, [props.tournamentId, props.draftId]);

  const sideText = (side: DraftDetail['matches'][number]['a']): string => {
    if (side.kind === 'entrant') {
      return (side.entrantId && props.names.get(side.entrantId.toLowerCase())) || t('mob.scoring.unknown_entry');
    }
    if (side.kind === 'group_place' && side.group && side.place !== null) {
      return t('mob.scoring.placeholder.group_place', { group: side.group, place: side.place });
    }
    if (side.kind === 'winner') {
      return t('mob.scoring.placeholder.winner_generic');
    }
    if (side.kind === 'loser') {
      return t('mob.scoring.placeholder.loser_generic');
    }
    return t('mob.scoring.placeholder.tbd');
  };

  const rows = draft ? (all ? draft.matches : draft.matches.slice(0, SHOWN)) : [];

  return (
    <Modal visible animationType="slide" transparent onRequestClose={props.onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet} testID="review-fixtures">
          <View style={styles.head}>
            <Text style={styles.title} accessibilityRole="header">
              {t('mob.tournament.approvals.type_publish')}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t('mob.common.close')} onPress={props.onClose} style={styles.close} testID="review-close">
              <CrossIcon size={18} color={dash.text} />
            </Pressable>
          </View>
          <Text style={styles.sub}>{props.requestedBy}</Text>
          {!draft && !failed ? <ActivityIndicator color={dash.brand} style={styles.loading} testID="review-loading" /> : null}
          {failed ? <Text style={styles.error}>{t('mob.scoring.draw.detail_missing')}</Text> : null}
          {draft ? (
            <View>
              <View style={styles.chips}>
                <Chip label={t('mob.tournament.approvals.summary_matches', { count: draft.matches.length })} tone="amber" />
                <Chip label={t('mob.tournament.approvals.summary_players', { count: draftPlayerCount(draft) })} tone="purple" />
              </View>
              <View style={styles.list} testID="review-matches">
                {rows.map((m, index) => (
                  <View key={`${m.group}-${m.round}-${m.ordinal}-${index}`} style={styles.match}>
                    <Text style={styles.when}>{m.start ? formatClock(m.start) : ''}</Text>
                    {m.court ? <Chip label={m.court} tone="teal" /> : null}
                    <Text style={styles.sides} numberOfLines={2}>
                      {t('mob.tournament.fixtures.match_label', { a: sideText(m.a), b: sideText(m.b) })}
                    </Text>
                  </View>
                ))}
              </View>
              {!all && draft.matches.length > SHOWN ? (
                <Pressable accessibilityRole="button" onPress={() => setAll(true)} style={styles.more} testID="review-see-all">
                  <Text style={styles.moreText}>{t('mob.tournament.approvals.show_all')}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          <View style={styles.actions}>
            <Button label={t('mob.tournament.approvals.reject')} variant="secondary" onPress={props.onReject} disabled={props.busy} style={styles.action} testID="review-reject" />
            <Button label={t('mob.tournament.approvals.approve_publish')} onPress={props.onApprove} loading={props.busy} style={styles.action} testID="review-approve" />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
  sheet: { maxHeight: '92%', backgroundColor: colors.surface, borderTopLeftRadius: radius.lg + 8, borderTopRightRadius: radius.lg + 8, padding: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center' },
  title: { ...typography.h2, color: dash.text, flex: 1 },
  close: { width: CLOSE, height: CLOSE, borderRadius: CLOSE / 2, backgroundColor: dash.page, alignItems: 'center', justifyContent: 'center' },
  sub: { ...typography.caption, color: dash.textMuted, marginBottom: spacing.sm },
  loading: { marginVertical: spacing.lg },
  error: { ...typography.body, color: colors.error },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  list: { borderWidth: borderWidth.thin, borderColor: dash.cardBorder, borderRadius: radius.md, marginTop: spacing.sm },
  match: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', padding: spacing.sm, borderBottomWidth: borderWidth.thin, borderBottomColor: dash.cardBorder },
  when: { ...typography.bodyBold, color: dash.textMuted, marginRight: spacing.sm },
  sides: { ...typography.bodyBold, color: dash.text, flexShrink: 1 },
  more: { minHeight: 44, justifyContent: 'center' },
  moreText: { ...typography.bodyBold, color: dash.brand },
  actions: { flexDirection: 'row', marginTop: spacing.md },
  action: { flex: 1, marginHorizontal: spacing.xs },
});
