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
import UserAvatar from './UserAvatar';
import { focusRingStyle, useAccessibilityFocus } from '../hooks/useAccessibilityFocus';

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
        /** Accessible name of the button ("Register Mei Lin"); defaults to the invite wording. */
        actionLabel?: string;
        /** The text under the row for a refusal of THIS row; defaults to the generic "Could not send the invitation" text. */
        errorText?: (error: unknown) => string | null;
      }
  );

export default function AddRemoveControl(props: AddRemoveControlProps): React.JSX.Element {
  const t = useT();
  const { name, disabled = false, testID, sentStatus, accessibilityLabelOverride } = props;
  const [phase, setPhase] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [failed, setFailed] = useState<string | boolean>(false);
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
      reason => {
        inFlight.current = false;
        if (mounted.current) {
          setFailed((props.mode === 'immediate' && props.errorText?.(reason)) || true);
          setPhase('idle');
        }
      },
    );
  };

  const label = accessibilityLabelOverride && !sending
    ? accessibilityLabelOverride
    : sending
    ? t('mob.add_remove.sending_a11y', { name })
    : props.mode === 'immediate' && props.actionLabel
    ? props.actionLabel
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
          {typeof failed === 'string' ? failed : t('mob.add_remove.error')}
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
  focusToken,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
  /** A new non-zero value moves focus here (ring and screen reader) without pressing it (te-a4). */
  focusToken?: number;
}): React.JSX.Element {
  const focus = useAccessibilityFocus(focusToken);
  return (
    <Pressable
      ref={focus.ref}
      onBlur={focus.clear}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.target, pressed && !disabled ? styles.pressed : null, focus.ringed ? focusRingStyle : null]}
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
  focusToken,
}: {
  title: string;
  /** Accessible name; keeps the word "Invite" (defaults to the title). */
  label?: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
  focusToken?: number;
}): React.JSX.Element {
  return (
    <View style={styles.entryRow}>
      <Text style={styles.entryTitle}>{title}</Text>
      <AddEntryButton label={label ?? title} onPress={onPress} disabled={disabled} testID={testID} focusToken={focusToken} />
    </View>
  );
}

/**
 * Groups to invite: one row per group, "+" stages it, "−" removes it (screen has a submit step).
 *
 * With `sectionLabels` (game-view-redesign GV-5, invite picker board) the rows are grouped
 * Selected / Available / Already in this game (GV-P1): a staged group moves up to Selected with
 * "−", a group in `alreadyIds` shows `alreadyLabel` instead of a glyph. Without it the flat list is
 * unchanged.
 */
/** A group row of the invite picker. `logo_url` is what the group feeds already return. */
export interface GroupInviteRow {
  id: string;
  name: string;
  logo_url?: string | null;
  /** From the group feed; null or absent when the server did not say. */
  member_count?: number | null;
}

const GROUP_AVATAR = 36;

export function GroupInviteList({
  groups,
  selectedIds,
  onToggle,
  disabled = false,
  alreadyIds = [],
  alreadyLabel,
  sectionLabels,
  disabledIds = [],
  showMemberCount = false,
}: {
  groups: readonly GroupInviteRow[];
  selectedIds: readonly string[];
  onToggle: (groupId: string) => void;
  disabled?: boolean;
  alreadyIds?: readonly string[];
  /** Status chip text of a group already in the game. */
  alreadyLabel?: string;
  sectionLabels?: { selected: string; available: string; alreadyIn: string };
  /** Rows whose "+" is off (for example at a cap); a staged row keeps its "−". */
  disabledIds?: readonly string[];
  /** "Group name (10 members)" (te-a4, AD-T13); a group without a count shows its name only. */
  showMemberCount?: boolean;
}): React.JSX.Element {
  const t = useT();
  const rowTitle = (group: GroupInviteRow): string => {
    if (!showMemberCount || group.member_count === null || group.member_count === undefined) {
      return group.name;
    }
    return group.member_count === 1
      ? t('mob.tw.group_row_one', { name: group.name })
      : t('mob.tw.group_row_many', { name: group.name, count: group.member_count });
  };
  const renderRow = (group: GroupInviteRow, already: boolean): React.JSX.Element => (
    <View key={group.id} style={styles.entryRow}>
      <View style={styles.entryMain}>
        {/* Same logo the Groups list shows (te-a1, AD-T11): the shared avatar, initials when there is none. */}
        <View style={styles.groupAvatarBox}>
          <UserAvatar imageUrl={group.logo_url} name={group.name} size={GROUP_AVATAR} fallback="initials" />
        </View>
        <Text style={styles.entryTitle} numberOfLines={1} testID={`group-invite-title-${group.id}`}>
          {rowTitle(group)}
        </Text>
      </View>
      <AddRemoveControl
        mode="staged"
        name={group.name}
        staged={selectedIds.includes(group.id)}
        onStage={() => onToggle(group.id)}
        onUnstage={() => onToggle(group.id)}
        disabled={disabled || (disabledIds.includes(group.id) && !selectedIds.includes(group.id))}
        sentStatus={already ? alreadyLabel ?? null : null}
        testID={`group-invite-${group.id}`}
      />
    </View>
  );

  if (!sectionLabels) {
    return <View testID="group-invite-list">{groups.map(group => renderRow(group, false))}</View>;
  }

  const already = groups.filter(group => alreadyIds.includes(group.id));
  const open = groups.filter(group => !alreadyIds.includes(group.id));
  const selected = open.filter(group => selectedIds.includes(group.id));
  const available = open.filter(group => !selectedIds.includes(group.id));
  const heading = (text: string, testID: string): React.JSX.Element => (
    <Text style={styles.sectionHeading} accessibilityRole="header" testID={testID}>
      {text}
    </Text>
  );
  return (
    <View testID="group-invite-list">
      {selected.length > 0 ? (
        <>
          {heading(sectionLabels.selected, 'group-invite-heading-selected')}
          {selected.map(group => renderRow(group, false))}
        </>
      ) : null}
      {available.length > 0 ? (
        <>
          {heading(sectionLabels.available, 'group-invite-heading-available')}
          {available.map(group => renderRow(group, false))}
        </>
      ) : null}
      {already.length > 0 ? (
        <>
          {heading(sectionLabels.alreadyIn, 'group-invite-heading-already')}
          {already.map(group => renderRow(group, true))}
        </>
      ) : null}
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
  entryMain: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 },
  groupAvatarBox: { width: GROUP_AVATAR, height: GROUP_AVATAR, marginRight: spacing.sm },
  entryTitle: { ...typography.bodyBold, color: colors.textPrimary, flexShrink: 1 },
  sectionHeading: {
    ...typography.label,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: groupView.textSecondary,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
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
