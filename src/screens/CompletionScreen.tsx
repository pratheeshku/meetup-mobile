/**
 * Summary shown after a successful submit. Text comes from labels; row
 * values are whatever the caller already has in memory. Hardware back
 * runs the primary action and does not pop back to the form.
 */
import React, { useCallback, useContext, useEffect, useRef, useSyncExternalStore } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NavigationContext } from '@react-navigation/native';

import Button from '../components/Button';
import Card from '../components/Card';
import { RegistryIcon } from '../components/icons/RegistryIcons';
import ScreenContainer from '../components/ScreenContainer';
import type { ScreenEdge } from '../components/ScreenContainer';
import { useT } from '../labels/LabelsContext';
import type { LabelKey } from '../labels/fallbackLabels';
import {
  leaveCompletion,
  peekCompletion,
  subscribeCompletion,
  type CompletionFlow,
  type CompletionPrimary,
  type CompletionRequest,
  type CompletionRow,
  type CompletionSecondary,
  type CompletionSecondaryButton,
} from '../navigation/showCompletion';
import { borderWidth, colors, radius, spacing, typography } from '../theme/tokens';

const FLOW_TITLE: Record<CompletionFlow, LabelKey> = {
  game_created: 'mob.done.game_created.title',
  tournament_created: 'mob.done.tournament_created.title',
  team_created: 'mob.done.team_created.title',
  group_created: 'mob.done.group_created.title',
  game_updated: 'mob.done.game_updated.title',
  group_updated: 'mob.done.group_updated.title',
  profile_updated: 'mob.done.profile_updated.title',
  skills_updated: 'mob.done.skills_updated.title',
  game_cancelled: 'mob.done.game_cancelled.title',
  tournament_cancelled: 'mob.done.tournament_cancelled.title',
  group_deleted: 'mob.done.group_deleted.title',
  group_left: 'mob.done.group_left.title',
  account_created: 'mob.done.account_created.title',
  account_deleted: 'mob.done.account_deleted.title',
  onboarding_done: 'mob.done.onboarding_done.title',
  game_closed: 'mob.closure.success_title',
  tournament_closed: 'mob.closure.success_title_tournament',
};

const FLOW_SUBTITLE: Record<CompletionFlow, LabelKey> = {
  game_created: 'mob.done.game_created.subtitle',
  tournament_created: 'mob.done.tournament_created.subtitle',
  team_created: 'mob.done.team_created.subtitle',
  group_created: 'mob.done.group_created.subtitle',
  game_updated: 'mob.done.game_updated.subtitle',
  group_updated: 'mob.done.group_updated.subtitle',
  profile_updated: 'mob.done.profile_updated.subtitle',
  skills_updated: 'mob.done.skills_updated.subtitle',
  game_cancelled: 'mob.done.game_cancelled.subtitle',
  tournament_cancelled: 'mob.done.tournament_cancelled.subtitle',
  group_deleted: 'mob.done.group_deleted.subtitle',
  group_left: 'mob.done.group_left.subtitle',
  account_created: 'mob.done.account_created.subtitle',
  account_deleted: 'mob.done.account_deleted.subtitle',
  onboarding_done: 'mob.done.onboarding_done.subtitle',
  game_closed: 'mob.closure.saved',
  tournament_closed: 'mob.closure.saved',
};

const PRIMARY_LABEL: Record<CompletionPrimary, LabelKey> = {
  dashboard: 'mob.done.btn_dashboard',
  groups: 'mob.done.btn_groups',
  profile: 'mob.done.btn_profile',
  signin: 'mob.done.btn_signin',
  get_started: 'mob.done.btn_get_started',
};

const SECONDARY_LABEL: Record<CompletionSecondaryButton, LabelKey> = {
  view_game: 'mob.done.btn_view_game',
  view_group: 'mob.done.btn_view_group',
  view_tournament: 'mob.done.btn_view_tournament',
};

export interface CompletionScreenProps {
  flow?: CompletionFlow;
  rows?: CompletionRow[];
  primary?: CompletionPrimary;
  secondary?: CompletionSecondary;
  /** When set (onboarding overlay), the primary action calls this. */
  onPrimary?: () => void;
  edges?: ScreenEdge;
}

export default function CompletionScreen({
  flow: flowProp,
  rows: rowsProp,
  primary: primaryProp,
  secondary: secondaryProp,
  onPrimary,
  edges = 'both',
}: CompletionScreenProps): React.JSX.Element | null {
  const t = useT();
  const stored = useSyncExternalStore(subscribeCompletion, peekCompletion);
  const navigation = useContext(NavigationContext);
  const allowLeave = useRef(false);
  const left = useRef(false);
  const snapshot = useRef<CompletionRequest | null>(null);

  const request: CompletionRequest | null = flowProp
    ? {
        flow: flowProp,
        rows: rowsProp ?? [],
        primary: primaryProp ?? 'dashboard',
        secondary: secondaryProp,
        onPrimary,
      }
    : stored;

  if (request) {
    snapshot.current = request;
  }
  const data = request ?? snapshot.current;

  const runPrimary = useCallback(() => {
    if (left.current) {
      return;
    }
    left.current = true;
    allowLeave.current = true;
    if (onPrimary) {
      onPrimary();
      return;
    }
    const current = peekCompletion() ?? snapshot.current;
    if (current) {
      leaveCompletion(current, 'primary');
    }
  }, [onPrimary]);

  const runSecondary = useCallback(() => {
    if (left.current) {
      return;
    }
    const current = peekCompletion() ?? snapshot.current;
    if (!current?.secondary) {
      return;
    }
    left.current = true;
    allowLeave.current = true;
    leaveCompletion(current, 'secondary');
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      runPrimary();
      return true;
    });
    return () => subscription.remove();
  }, [runPrimary]);

  useEffect(() => {
    if (!navigation) {
      return undefined;
    }
    return navigation.addListener('beforeRemove', event => {
      if (allowLeave.current) {
        return;
      }
      event.preventDefault();
      runPrimary();
    });
  }, [navigation, runPrimary]);

  if (!data) {
    return null;
  }

  const secondary = data.secondary;

  return (
    <ScreenContainer edges={edges} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <RegistryIcon name="success" size={72} borderRadius={radius.full} />
          <Text style={styles.title} accessibilityRole="header">
            {t(FLOW_TITLE[data.flow])}
          </Text>
          <Text style={styles.subtitle}>{t(FLOW_SUBTITLE[data.flow])}</Text>
        </View>

        {data.rows.length > 0 ? (
          <Card style={styles.card}>
            {data.rows.map((row, index) => (
              <View
                key={`${row.label}-${index}`}
                style={[styles.row, index < data.rows.length - 1 ? styles.rowBorder : null]}
              >
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text style={styles.rowValue}>{row.value}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        <View style={styles.actions}>
          <Button label={t(PRIMARY_LABEL[data.primary])} onPress={runPrimary} />
          {secondary ? (
            <Button
              label={t(SECONDARY_LABEL[secondary.button])}
              variant="secondary"
              onPress={runSecondary}
              style={styles.secondary}
            />
          ) : null}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  card: {
    paddingVertical: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowBorder: {
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
  },
  rowValue: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    flex: 1.4,
    textAlign: 'right',
  },
  actions: {
    marginTop: spacing.lg,
  },
  secondary: {
    marginTop: spacing.sm,
  },
});
