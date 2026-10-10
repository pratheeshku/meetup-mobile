/**
 * Edit skill levels. Every active sport from `GET /admin/sports/public`,
 * in admin order. A level is saved only when one is chosen; Clear removes
 * a level that was already stored.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { deleteSkillLevel, getSkillLevels, updateSkillLevel } from '../api/profile';
import { getSports } from '../api/sports';
import { BackArrowIcon } from '../components/icons/ActionIcons';
import { SportIcon } from '../components/icons/DashboardIcons';
import ErrorView from '../components/ErrorView';
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import LoadingView from '../components/LoadingView';
import ScreenContainer from '../components/ScreenContainer';
import { levelLabelKey, SKILL_LEVEL_ORDER } from '../components/skills/levels';
import { getLabel, useLabels, useT } from '../labels/LabelsContext';
import { findSport, rememberSportsCatalog } from '../sports/catalog';
import { sportPalette } from '../sports/style';
import { borderWidth, colors, radius, spacing, typography } from '../theme/tokens';
import type { Sport } from '../types/sport';
import type { SkillLevelValue } from '../types/user';
import type { ProfileStackParamList } from '../navigation/types';
import { getApiErrorMessage } from '../utils/apiError';

type Props = NativeStackScreenProps<ProfileStackParamList, 'EditSkillLevels'>;

const SEGMENT_MIN_HEIGHT = 44;

function SkillLevelRow({
  sport,
  level,
  onChange,
  onClear,
}: {
  sport: Sport;
  level: SkillLevelValue | null;
  onChange: (level: SkillLevelValue) => void;
  onClear: () => void;
}): React.JSX.Element {
  const t = useT();
  const labels = useLabels();
  const palette = sportPalette(sport.color);

  return (
    <View style={styles.rowCard}>
      <View style={styles.rowHeader}>
        <View style={[styles.iconCircle, { backgroundColor: palette.chip, shadowColor: palette.shadow }]}>
          <SportIcon iconKey={sport.icon_key} size={20} />
        </View>
        <Text style={styles.sportName} numberOfLines={1}>
          {sport.display_name}
        </Text>
        {level ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${sport.display_name} ${t('mob.profile.skill_clear')}`}
            onPress={onClear}
            style={styles.clearButton}
          >
            <Text style={styles.clearText}>{t('mob.profile.skill_clear')}</Text>
          </Pressable>
        ) : (
          <Text style={styles.notSet}>{t('mob.profile.skill_not_set')}</Text>
        )}
      </View>
      <View style={styles.segments} accessibilityRole="radiogroup">
        {SKILL_LEVEL_ORDER.map(option => {
          const selected = level === option;
          const label = getLabel(labels, levelLabelKey(option));
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityLabel={`${sport.display_name}, ${label}`}
              accessibilityState={{ selected, checked: selected }}
              onPress={() => onChange(option)}
              style={[styles.segment, selected && styles.segmentSelected]}
            >
              <Text style={[styles.segmentText, selected && styles.segmentTextSelected]} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function EditSkillLevelsScreen({ navigation }: Props): React.JSX.Element {
  const t = useT();
  const [sports, setSports] = useState<Sport[]>([]);
  const [levels, setLevels] = useState<Record<string, SkillLevelValue | null>>({});
  const [initial, setInitial] = useState<Record<string, SkillLevelValue | null>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const [list, saved] = await Promise.all([getSports(), getSkillLevels()]);
      rememberSportsCatalog(list);
      const next: Record<string, SkillLevelValue | null> = {};
      for (const sport of list) {
        next[sport.name] = null;
      }
      for (const skill of saved) {
        const match = findSport(list, skill.sport);
        if (match) {
          next[match.name] = skill.skill_level;
        }
      }
      setSports(list);
      setLevels(next);
      setInitial(next);
    } catch {
      setLoadError(t('mob.common.sports_load_error'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const onDone = async (): Promise<void> => {
    try {
      setIsSaving(true);
      setSaveError(null);
      for (const sport of sports) {
        const next = levels[sport.name] ?? null;
        const previous = initial[sport.name] ?? null;
        if (next && next !== previous) {
          try {
            await updateSkillLevel(sport.name, next);
          } catch (error) {
            setSaveError(getApiErrorMessage(error, t('mob.profile.skill_save_error')));
            return;
          }
        } else if (!next && previous) {
          try {
            await deleteSkillLevel(sport.name);
          } catch (error) {
            setSaveError(getApiErrorMessage(error, t('mob.profile.skill_remove_error')));
            return;
          }
        }
      }
      navigation.goBack();
    } catch (error) {
      setSaveError(getApiErrorMessage(error, t('mob.profile.skill_save_error')));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer edges="top">
        <LoadingView />
      </ScreenContainer>
    );
  }

  if (loadError) {
    return (
      <ScreenContainer edges="top">
        <ErrorView message={loadError} onRetry={load} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges="top" style={styles.screen}>
    <View style={styles.screen}>
      <View style={styles.headerBar}>
        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('mob.common.back')}
        >
          <BackArrowIcon size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('mob.profile.skill_levels_title')}</Text>
      </View>

      <KeyboardAwareScreen contentContainerStyle={styles.scrollContent}>
        <Text style={styles.intro}>{t('mob.profile.skill_levels_intro')}</Text>
        {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}
        {sports.length === 0 ? (
          <Text style={styles.intro}>{t('mob.common.no_sports')}</Text>
        ) : (
          sports.map(sport => (
            <SkillLevelRow
              key={sport.name}
              sport={sport}
              level={levels[sport.name] ?? null}
              onChange={level => setLevels(current => ({ ...current, [sport.name]: level }))}
              onClear={() => setLevels(current => ({ ...current, [sport.name]: null }))}
            />
          ))
        )}
      </KeyboardAwareScreen>

      <View style={styles.footer}>
        <Pressable
          style={[styles.doneButton, isSaving && styles.doneDisabled]}
          onPress={onDone}
          disabled={isSaving}
          accessibilityRole="button"
          accessibilityLabel={t('mob.common.done')}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.doneText}>{t('mob.common.done')}</Text>
          )}
        </Pressable>
      </View>
    </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl },
  intro: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
  saveError: { ...typography.caption, color: colors.error, marginBottom: spacing.md },
  rowCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  rowHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  sportName: { ...typography.bodyBold, color: colors.textPrimary, flex: 1, fontSize: 16 },
  clearButton: { minHeight: SEGMENT_MIN_HEIGHT, justifyContent: 'center', paddingHorizontal: spacing.sm },
  clearText: { ...typography.bodyBold, color: colors.primary },
  notSet: { ...typography.caption, color: colors.textMuted },
  segments: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: 3,
  },
  segment: {
    flex: 1,
    minHeight: SEGMENT_MIN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
  },
  segmentSelected: { backgroundColor: colors.primary },
  segmentText: { ...typography.caption, color: colors.textSecondary, fontWeight: '600', textAlign: 'center' },
  segmentTextSelected: { color: colors.white, fontWeight: '700' },
  footer: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: borderWidth.thin,
    borderTopColor: colors.border,
  },
  doneButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    minHeight: SEGMENT_MIN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneDisabled: { opacity: 0.7 },
  doneText: { ...typography.button, color: colors.white },
});
