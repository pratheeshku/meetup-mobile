import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Button from '../Button';
import DropdownField, { type DropdownOption } from '../DropdownField';
import ScreenContainer from '../ScreenContainer';
import SegmentedSwitch from '../SegmentedSwitch';
import UserAvatar from '../UserAvatar';
import { CheckIcon, CrossIcon } from '../icons/ActionIcons';
import { useT } from '../../labels/LabelsContext';
import { borderWidth, colors, radius, sizes, spacing, typography } from '../../theme/tokens';

export interface CandidateItem {
  id: string;
  displayName: string;
  photoUrl?: string | null;
}

export interface ClosureModalProps {
  visible: boolean;
  onClose: () => void;
  entityType?: 'event' | 'tournament';
  candidates: CandidateItem[];
  initialOutcome?: string | null;
  initialAttendeeIds?: string[];
  initialWinnerId?: string | null;
  initialRunnerUpId?: string | null;
  expectedVersion: number;
  onSubmit: (payload: {
    outcome: 'completed' | 'not_held';
    attendeeIds: string[];
    winnerId: string | null;
    runnerUpId: string | null;
    expectedVersion: number;
  }) => Promise<void>;
  isSubmitting?: boolean;
  error?: string | null;
}

export default function ClosureModal({
  visible,
  onClose,
  entityType: _entityType = 'event',
  candidates,
  initialOutcome,
  initialAttendeeIds,
  initialWinnerId,
  initialRunnerUpId,
  expectedVersion,
  onSubmit,
  isSubmitting = false,
  error,
}: ClosureModalProps): React.JSX.Element {
  const t = useT();

  const [outcome, setOutcome] = useState<'completed' | 'not_held'>('completed');
  const [tickedIds, setTickedIds] = useState<string[]>([]);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [runnerUpId, setRunnerUpId] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);

  // Initialize form when opened or when candidates/initial values change
  useEffect(() => {
    if (visible) {
      setOutcome(initialOutcome === 'not_held' ? 'not_held' : 'completed');
      if (initialAttendeeIds && initialAttendeeIds.length > 0) {
        setTickedIds(initialAttendeeIds);
      } else {
        // Default: all candidates ticked
        setTickedIds(candidates.map(c => c.id));
      }
      setWinnerId(initialWinnerId ?? null);
      setRunnerUpId(initialRunnerUpId ?? null);
      setClientError(null);
    }
  }, [visible, candidates, initialOutcome, initialAttendeeIds, initialWinnerId, initialRunnerUpId]);

  const toggleCandidate = (id: string) => {
    setClientError(null);
    setTickedIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      // If removed person was winner or runner-up, reset selection
      if (!next.includes(id)) {
        if (winnerId === id) {
          setWinnerId(null);
        }
        if (runnerUpId === id) {
          setRunnerUpId(null);
        }
      }
      // If fewer than 2 people left, clear runner-up
      if (next.length < 2) {
        setRunnerUpId(null);
      }
      return next;
    });
  };

  const outcomeOptions = useMemo<ReadonlyArray<{ value: 'completed' | 'not_held'; label: string }>>(
    () => [
      { value: 'completed', label: t('mob.closure.outcome.played') },
      { value: 'not_held', label: t('mob.closure.outcome.not_held') },
    ],
    [t],
  );

  const winnerOptions: DropdownOption[] = useMemo(() => {
    return candidates
      .filter(c => tickedIds.includes(c.id))
      .map(c => ({
        value: c.id,
        label: c.displayName,
      }));
  }, [candidates, tickedIds]);

  const runnerUpOptions: DropdownOption[] = useMemo(() => {
    return candidates
      .filter(c => tickedIds.includes(c.id) && c.id !== winnerId)
      .map(c => ({
        value: c.id,
        label: c.displayName,
      }));
  }, [candidates, tickedIds, winnerId]);

  const handleSave = async () => {
    setClientError(null);
    if (outcome === 'completed') {
      if (tickedIds.length === 0) {
        setClientError(t('mob.closure.who_played'));
        return;
      }
      if (!winnerId) {
        setClientError(t('mob.closure.select_winner'));
        return;
      }
      if (tickedIds.length >= 2 && !runnerUpId) {
        setClientError(t('mob.closure.select_runner_up'));
        return;
      }
    }

    await onSubmit({
      outcome,
      attendeeIds: outcome === 'completed' ? tickedIds : [],
      winnerId: outcome === 'completed' ? winnerId : null,
      runnerUpId: outcome === 'completed' ? runnerUpId : null,
      expectedVersion,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <ScreenContainer edges="bottom" fill={false} style={styles.bottomSheetSafe}>
          <View style={styles.sheetContainer}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>{t('mob.closure.title')}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('mob.common.close')}
                onPress={onClose}
                style={styles.closeBtn}
                testID="closure-close-button"
              >
                <CrossIcon size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
              {/* Question: Was it played? */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>{t('mob.closure.was_it_played')}</Text>
                <SegmentedSwitch
                  options={outcomeOptions}
                  value={outcome}
                  onChange={val => {
                    setOutcome(val);
                    setClientError(null);
                  }}
                />
              </View>

              {outcome === 'completed' ? (
                <>
                  {/* Who played? */}
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>{t('mob.closure.who_played')}</Text>
                    {candidates.length === 0 ? (
                      <Text style={styles.emptyCandidatesText}>{t('mob.closure.attendees')}</Text>
                    ) : (
                      candidates.map(candidate => {
                        const isTicked = tickedIds.includes(candidate.id);
                        return (
                          <Pressable
                            key={candidate.id}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: isTicked }}
                            accessibilityLabel={candidate.displayName}
                            onPress={() => toggleCandidate(candidate.id)}
                            style={styles.candidateRow}
                            testID={`candidate-${candidate.id}`}
                          >
                            <View style={[styles.checkbox, isTicked && styles.checkboxTicked]}>
                              {isTicked ? <CheckIcon size={14} color={colors.white} /> : null}
                            </View>
                            <UserAvatar
                              imageUrl={candidate.photoUrl}
                              name={candidate.displayName}
                              size={32}
                              fallback="initials"
                            />
                            <Text style={styles.candidateName}>{candidate.displayName}</Text>
                          </Pressable>
                        );
                      })
                    )}
                  </View>

                  {/* Winner dropdown */}
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>{t('mob.closure.winner')}</Text>
                    <DropdownField
                      options={winnerOptions}
                      value={winnerId}
                      onChange={val => {
                        setWinnerId(val);
                        if (runnerUpId === val) {
                          setRunnerUpId(null);
                        }
                        setClientError(null);
                      }}
                      placeholder={t('mob.closure.select_winner')}
                      accessibilityLabel={t('mob.closure.winner')}
                      disabled={winnerOptions.length === 0}
                    />
                  </View>

                  {/* Runner-up dropdown (required with 2+ players) */}
                  {tickedIds.length >= 2 ? (
                    <View style={styles.section}>
                      <Text style={styles.sectionLabel}>{t('mob.closure.runner_up_required')}</Text>
                      <DropdownField
                        options={runnerUpOptions}
                        value={runnerUpId}
                        onChange={val => {
                          setRunnerUpId(val);
                          setClientError(null);
                        }}
                        placeholder={t('mob.closure.select_runner_up')}
                        accessibilityLabel={t('mob.closure.runner_up')}
                        disabled={runnerUpOptions.length === 0}
                      />
                    </View>
                  ) : null}
                </>
              ) : null}

              {clientError ? (
                <Text style={styles.errorText} testID="closure-client-error">
                  {clientError}
                </Text>
              ) : null}

              {error ? (
                <Text style={styles.errorText} testID="closure-server-error">
                  {error}
                </Text>
              ) : null}

              <View style={styles.actionsRow}>
                <Button
                  label={t('mob.closure.save')}
                  variant="primary"
                  onPress={handleSave}
                  loading={isSubmitting}
                  style={styles.actionButton}
                  testID="closure-save-button"
                />
                <Button
                  label={t('mob.common.close')}
                  variant="secondary"
                  onPress={onClose}
                  disabled={isSubmitting}
                  style={styles.actionButton}
                  testID="closure-cancel-button"
                />
              </View>
            </ScrollView>
          </View>
        </ScreenContainer>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  bottomSheetSafe: {
    maxHeight: '90%',
  },
  sheetContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  closeBtn: {
    minWidth: sizes.touchTarget,
    minHeight: sizes.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: spacing.md,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionLabel: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    minHeight: sizes.touchTarget,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: radius.sm,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    backgroundColor: colors.surface,
  },
  checkboxTicked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  candidateName: {
    ...typography.body,
    color: colors.textPrimary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  emptyCandidatesText: {
    ...typography.body,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    marginBottom: spacing.sm,
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
});
