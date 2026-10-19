/**
 * The ONE "+" / "−" control for adding or inviting a person or a group
 * (DES-MEETUP-ADDENDUM-tournament-lifecycle.md AD-19, TL-81, TL-82). No screen
 * draws its own.
 *
 * | State                         | Shows                                    |
 * | Not added                     | "+"  (stage it, or send now)             |
 * | Staged, not yet submitted     | "−"  (removes it; nothing was sent)      |
 * | Invitation sent               | status chip, no glyph                    |
 *
 * `mode="staged"` is for a screen with a submit step: "+" calls `onStage`,
 * "−" calls `onUnstage`, nothing is sent here. `mode="immediate"` is for a
 * screen without one: "+" calls `onSend`; the chip appears only after
 * `onSend` resolves (server confirmed); if it rejects the row returns to "+"
 * with the error label. A second tap while a send is in flight or after it
 * succeeded does nothing. A `sentStatus` from the server (an existing
 * invitation status) shows the chip at once.
 *
 * Accessible names come from the label system. The glyph differs between the
 * two actions (plus vs minus), not only the colour. Touch target >= 44.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useT } from '../labels/LabelsContext';
import { borderWidth, colors, groupView, radius, sizes, spacing, typography } from '../theme/tokens';
import { MinusIcon, PlusIcon } from './icons/ActionIcons';

const CIRCLE = 36;
const GLYPH = 20;

interface CommonProps {
  /** Person or group name, used in the accessible name. */
  name: string;
  disabled?: boolean;
  testID?: string;
  /** Label-system text that replaces the default accessible name (for example for an email row). */
  accessibilityLabelOverride?: string;
  /** Existing server status to show instead of a glyph (for example "Invited", "Accepted"). */
  sentStatus?: string | null;
}

export type AddRemoveControlProps = CommonProps &
  (
    | {
        mode: 'staged';
        staged: boolean;
        onStage: () => void;
        onUnstage: () => void;
      }
    | {
        mode: 'immediate';
        /** Resolve = the server confirmed; reject = failed. */
        onSend: () => Promise<unknown>;
        /** Chip text after a confirmed send. Defaults to the "Invited" label. */
        sentLabel?: string;
      }
  );

export default function AddRemoveControl(props: AddRemoveControlProps): React.JSX.Element {
  const t = useT();
  const { name, disabled = false, testID, sentStatus, accessibilityLabelOverride } = props;
  const [phase, setPhase] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const chip = (text: string): React.JSX.Element => (
    <View style={styles.chip} testID={testID ? `${testID}-status` : 'add-remove-status'}>
      <Text style={styles.chipText}>{text}</Text>
    </View>
  );

  if (sentStatus) {
    return chip(sentStatus);
  }
  if (props.mode === 'immediate' && phase === 'sent') {
    return chip(props.sentLabel ?? t('mob.add_remove.sent'));
  }

  const sending = props.mode === 'immediate' && phase === 'sending';
  const isRemove = props.mode === 'staged' && props.staged;
  const blocked = disabled || sending;

  const press = (): void => {
    if (blocked) {
      return;
    }
    if (props.mode === 'staged') {
      if (props.staged) {
        props.onUnstage();
      } else {
        props.onStage();
      }
      return;
    }
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setFailed(false);
    setPhase('sending');
    let outcome: Promise<unknown>;
    try {
      outcome = Promise.resolve(props.onSend());
    } catch {
      outcome = Promise.reject(new Error('send failed'));
    }
    outcome.then(
      () => {
        // Stays locked: a sent row never sends twice.
        if (mounted.current) {
          setPhase('sent');
        }
      },
      () => {
        inFlight.current = false;
        if (mounted.current) {
          setFailed(true);
          setPhase('idle');
        }
      },
    );
  };

  const label = accessibilityLabelOverride && !sending
    ? accessibilityLabelOverride
    : sending
    ? t('mob.add_remove.sending_a11y', { name })
    : t(isRemove ? 'mob.add_remove.remove_a11y' : 'mob.add_remove.invite_a11y', { name });

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={press}
        disabled={blocked}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: blocked, busy: sending }}
        style={({ pressed }) => [styles.target, pressed && !blocked ? styles.pressed : null]}
        testID={testID ?? 'add-remove-control'}
      >
        <View style={[styles.circle, isRemove ? styles.circleRemove : styles.circleAdd]}>
          {sending ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : isRemove ? (
            <MinusIcon size={GLYPH} color={colors.white} />
          ) : (
            <PlusIcon size={GLYPH} color={colors.white} />
          )}
        </View>
      </Pressable>
      {failed ? (
        <Text style={styles.errorText} accessibilityRole="alert" testID="add-remove-error">
          {t('mob.add_remove.error')}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Entry button that opens a picker: "+" only. The accessible label is the
 * caller's label-system text and keeps the word "Invite" (for example
 * "Invite Group"). Place a visible title beside it; this is not a text button.
 */
export function AddEntryButton({
  label,
  onPress,
  disabled = false,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.target, pressed && !disabled ? styles.pressed : null]}
      testID={testID ?? 'add-entry-button'}
    >
      <View style={[styles.circle, styles.circleAdd]}>
        <PlusIcon size={GLYPH} color={colors.white} />
      </View>
    </Pressable>
  );
}

/** A list row that opens a picker: visible title on the left, "+" on the right. */
export function AddEntryRow({
  title,
  label,
  onPress,
  disabled = false,
  testID,
}: {
  title: string;
  /** Accessible name; keeps the word "Invite" (defaults to the title). */
  label?: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}): React.JSX.Element {
  return (
    <View style={styles.entryRow}>
      <Text style={styles.entryTitle}>{title}</Text>
      <AddEntryButton label={label ?? title} onPress={onPress} disabled={disabled} testID={testID} />
    </View>
  );
}

/** Groups to invite: one row per group, "+" stages it, "−" removes it (screen has a submit step). */
export function GroupInviteList({
  groups,
  selectedIds,
  onToggle,
  disabled = false,
}: {
  groups: readonly { id: string; name: string }[];
  selectedIds: readonly string[];
  onToggle: (groupId: string) => void;
  disabled?: boolean;
}): React.JSX.Element {
  return (
    <View testID="group-invite-list">
      {groups.map(group => (
        <View key={group.id} style={styles.entryRow}>
          <Text style={styles.entryTitle} numberOfLines={1}>
            {group.name}
          </Text>
          <AddRemoveControl
            mode="staged"
            name={group.name}
            staged={selectedIds.includes(group.id)}
            onStage={() => onToggle(group.id)}
            onUnstage={() => onToggle(group.id)}
            disabled={disabled}
            testID={`group-invite-${group.id}`}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: sizes.touchTarget,
  },
  entryTitle: { ...typography.bodyBold, color: colors.textPrimary, flexShrink: 1 },
  wrap: { alignItems: 'flex-end' },
  target: {
    minWidth: sizes.touchTarget,
    minHeight: sizes.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleAdd: { backgroundColor: groupView.blue },
  circleRemove: { backgroundColor: groupView.destructive },
  chip: {
    minHeight: sizes.touchTarget - spacing.md,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    borderColor: groupView.addedChipText,
    backgroundColor: groupView.addedChipBg,
  },
  chipText: { ...typography.caption, color: groupView.addedChipText, fontWeight: '600' },
  errorText: { ...typography.caption, color: colors.error, maxWidth: 160, textAlign: 'right' },
});
