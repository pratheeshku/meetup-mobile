/**
 * Shared invite search (DES-MEETUP-FEEDBACK-001 + architect decisions) — text
 * input and a list below it, used on every screen that searches for a person.
 *
 * Empty text shows the server's default list (up to 10 people who share a
 * group with the caller); typing runs a debounced server search; clearing the
 * text restores the default list at once. The server filters and caps the
 * list at 10: nothing is filtered or paged here (only `excludeUserIds` hides
 * people the caller already chose). Latest request wins.
 *
 * Sections: "In your groups" first, then "Other players", each heading shown
 * only when it has rows. A response without `in_my_groups` (older backend)
 * is one plain list. The group/other difference is carried by the heading and
 * the chip text, not by colour alone.
 *
 * `onSelect` may return a promise: rows are locked until it settles. A
 * `pending` result is shown but not selectable. `refreshToken` triggers a
 * silent refetch (e.g. after the caller added someone). Names, nicknames,
 * group names and search text are never logged.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { withCorrelationId } from '../api/correlationId';
import { searchUsers } from '../api/users';
import { borderWidth, colors, groupView, radius, sizes, spacing, typography } from '../theme/tokens';
import type { UserSearchResult } from '../types/user';
import { SearchIcon } from './icons/ActionIcons';
import AddRemoveControl from './AddRemoveControl';
import PersonNames from './PersonNames';
import UserMenuSheet from './user/UserMenuSheet';
import UserPressable from './user/UserPressable';
import { useUserMenu } from '../hooks/useUserMenu';
import TextField from './TextField';
import UserAvatar from './UserAvatar';
import type { LabelKey } from '../labels/fallbackLabels';
import { useT } from '../labels/LabelsContext';

const DEBOUNCE_MS = 300;
const AVATAR_SIZE = 40;
const INVITE_AVATAR_SIZE = 44;
const DOT_SIZE = 10;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * `classic`: the original boxed list.
 * `invite`: the WhatsApp-style Group invite list (docs/mockups/group-view/3-invite-search.png):
 * rounded search box, uppercase section headings.
 * Both draw the shared "+" / "−" control (AddRemoveControl, AD-19) per row.
 */
export type UserSearchVariant = 'classic' | 'invite';

export type SuggestionContext = 'players' | 'group_members' | 'team_players';

const HEADING_KEYS: Record<SuggestionContext, LabelKey> = {
  players: 'mob.user_search.heading_players',
  group_members: 'mob.user_search.heading_group_members',
  team_players: 'mob.user_search.heading_team_players',
};

interface UserSearchPickerProps {
  onSelect: (user: UserSearchResult) => void | Promise<void>;
  onSelectEmail?: (email: string) => void | Promise<void>;
  entityLabel?: string;
  excludeGroupId?: string;
  excludeEventId?: string;
  excludeTeamId?: string;
  excludeUserIds?: string[];
  placeholder?: string;
  disabled?: boolean;
  /** Picks the first section heading: game/tournament players, group members or team players. */
  suggestionContext?: SuggestionContext;
  /** Change the value to refetch the current list silently. */
  refreshToken?: number;
  /** Optional content rendered directly under the text field, above the results (e.g. who was added). */
  belowInput?: React.ReactNode;
  variant?: UserSearchVariant;
  /**
   * `staged` (default): the host screen has a submit step. "+" calls `onSelect`
   * to stage the person; a staged person (`stagedUserIds`) shows "−", which
   * calls `onUnstage`. `immediate`: the host has no submit step. "+" calls
   * `onSelect`, which must RESOLVE only when the server confirmed and REJECT
   * on failure; the row then shows the status chip or returns to "+" with the
   * error label.
   */
  selectionMode?: 'staged' | 'immediate';
  stagedUserIds?: string[];
  onUnstage?: (user: UserSearchResult) => void;
}

export default function UserSearchPicker({
  onSelect,
  onSelectEmail,
  entityLabel,
  excludeGroupId,
  excludeEventId,
  excludeTeamId,
  excludeUserIds,
  placeholder,
  disabled = false,
  suggestionContext = 'players',
  refreshToken = 0,
  belowInput,
  variant = 'classic',
  selectionMode = 'staged',
  stagedUserIds,
  onUnstage,
}: UserSearchPickerProps): React.JSX.Element {
  const t = useT();
  // Search and suggested-player lists are in no context of the viewer's: long-press on the avatar
  // or name opens View Details (menu with no actions, no card request). Selecting stays on the
  // "+" control of the row.
  const menu = useUserMenu({ context: { type: 'none' } });
  const tRef = useRef(t);
  tRef.current = t;
  const entity = entityLabel ?? t('mob.user_search.entity_group_member');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Only the most recently STARTED search may apply its result, so a slow
  // earlier response can never overwrite a newer one.
  const latestSearch = useRef(0);
  // Last default (empty-text) list, restored immediately when the text is cleared.
  const defaultCache = useRef<UserSearchResult[] | null>(null);
  // Synchronous guard against a second tap in the same frame.
  const selecting = useRef(false);

  // A different search context must not reuse another context's default list.
  useEffect(() => {
    defaultCache.current = null;
  }, [excludeGroupId, excludeEventId, excludeTeamId]);

  useEffect(() => {
    const trimmed = query.trim();
    const isDefault = trimmed.length === 0;
    const thisSearch = ++latestSearch.current;
    setError(null);

    // Silent: the list is already on screen (cached default), so no spinner.
    const silent = isDefault && defaultCache.current !== null;
    if (isDefault && defaultCache.current !== null) {
      setResults(defaultCache.current);
      setHasSearched(true);
      setIsSearching(false);
    } else {
      setIsSearching(true);
    }

    const run = (): void => {
      withCorrelationId(correlationId =>
        searchUsers(
          { q: trimmed, excludeGroupId, excludeEventId, excludeTeamId },
          { correlationId },
        ),
      ).then(
        found => {
          if (thisSearch !== latestSearch.current) {
            return;
          }
          if (isDefault) {
            defaultCache.current = Array.isArray(found) ? found : [];
          }
          setResults(Array.isArray(found) ? found : []);
          setHasSearched(true);
          setIsSearching(false);
        },
        () => {
          if (thisSearch !== latestSearch.current) {
            return;
          }
          if (!silent) {
            setError(tRef.current('mob.user_search.error'));
            setResults([]);
          }
          setIsSearching(false);
        },
      );
    };

    if (isDefault) {
      run();
      return undefined;
    }
    const timer = setTimeout(run, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, excludeGroupId, excludeEventId, excludeTeamId, refreshToken, reloadTick]);

  const resetAfterPick = (): void => {
    setQuery('');
    setError(null);
    setReloadTick(tick => tick + 1);
  };

  const handleSelect = (user: UserSearchResult): void => {
    if (user.pending || selecting.current || disabled) {
      return;
    }
    selecting.current = true;
    setBusyId(user.id);
    const release = (): void => {
      selecting.current = false;
      setBusyId(null);
    };
    let outcome: void | Promise<void>;
    try {
      outcome = onSelect(user);
    } catch (e) {
      release();
      throw e;
    }
    if (outcome && typeof (outcome as Promise<void>).then === 'function') {
      (outcome as Promise<void>).then(release, release);
    } else {
      release();
    }
    resetAfterPick();
  };

  /** Immediate mode: the list is reset only after the server confirmed. */
  const sendImmediate = async (user: UserSearchResult): Promise<void> => {
    if (user.pending || selecting.current || disabled) {
      return;
    }
    selecting.current = true;
    setBusyId(user.id);
    try {
      await onSelect(user);
    } finally {
      selecting.current = false;
      setBusyId(null);
    }
    resetAfterPick();
  };

  const handleSelectEmail = (email: string): void => {
    if (!onSelectEmail) {
      return;
    }
    onSelectEmail(email);
    resetAfterPick();
  };

  const sendEmailImmediate = async (email: string): Promise<void> => {
    if (!onSelectEmail) {
      return;
    }
    await onSelectEmail(email);
    resetAfterPick();
  };

  const handleFocus = (): void => {
    if (query.trim().length === 0) {
      setReloadTick(tick => tick + 1);
    }
  };

  const visibleResults = excludeUserIds?.length
    ? results.filter(user => !excludeUserIds.includes(user.id))
    : results;
  const trimmed = query.trim();
  const isEmail = EMAIL_REGEX.test(trimmed);
  const showEmailAffordance =
    !isSearching && !error && hasSearched && visibleResults.length === 0 && isEmail && Boolean(onSelectEmail);
  const showEmpty =
    !isSearching && !error && hasSearched && visibleResults.length === 0 && !showEmailAffordance;

  const sectioned = visibleResults.some(user => user.has_group_info);
  const groupRows = sectioned ? visibleResults.filter(user => user.in_my_groups) : [];
  const otherRows = sectioned ? visibleResults.filter(user => !user.in_my_groups) : visibleResults;

  const isInvite = variant === 'invite';
  const emailLabel = t('mob.user_search.invite_email_a11y', { email: trimmed, entity });

  const renderRow = (user: UserSearchResult, inGroup: boolean): React.JSX.Element => {
    const count = user.shared_group_count ?? 0;
    const groupName = (user.shared_group ?? '').trim();
    const chip =
      inGroup && groupName
        ? count > 1
          ? t('mob.user_search.chip_more', { group: groupName, count: String(count - 1) })
          : groupName
        : null;
    const label = user.pending
      ? t('mob.user_search.result_pending_a11y', { nickname: user.nickname, name: user.display_name })
      : chip
        ? t('mob.user_search.result_group_a11y', {
            nickname: user.nickname,
            name: user.display_name,
            group: groupName,
          })
        : t('mob.user_search.result_a11y', { nickname: user.nickname, name: user.display_name });
    const locked = user.pending || busyId !== null || disabled;
    const immediate = selectionMode === 'immediate';
    const control = user.pending ? (
      <Text style={styles.pendingLabel}>{t('mob.user_search.pending')}</Text>
    ) : immediate ? (
      <AddRemoveControl
        mode="immediate"
        name={user.display_name}
        onSend={() => sendImmediate(user)}
        disabled={locked}
        testID="user-search-row"
      />
    ) : busyId === user.id ? (
      <ActivityIndicator size="small" color={colors.primary} />
    ) : (
      <AddRemoveControl
        mode="staged"
        name={user.display_name}
        staged={stagedUserIds?.includes(user.id) ?? false}
        onStage={() => handleSelect(user)}
        onUnstage={() => onUnstage?.(user)}
        disabled={locked}
        testID="user-search-row"
      />
    );
    return (
      <View
        key={user.id}
        testID="user-search-row-body"
        style={[
          styles.resultRow,
          isInvite ? styles.resultRowInvite : null,
          inGroup && !isInvite ? styles.resultRowGroup : null,
          user.pending ? styles.resultRowDisabled : null,
        ]}
      >
        <UserPressable
          person={{
            userId: user.id,
            displayName: user.display_name,
            nickname: user.nickname ?? null,
            photoUrl: user.image_url,
          }}
          menu={menu}
          tap="none"
          style={styles.resultLeft}
          accessibilityLabel={label}
        >
          <UserAvatar
            imageUrl={user.image_url}
            name={user.display_name}
            size={isInvite ? INVITE_AVATAR_SIZE : AVATAR_SIZE}
            fallback={isInvite ? 'initials' : 'letter'}
          />
          <View style={styles.resultText}>
            <PersonNames displayName={user.display_name} nickname={user.nickname} />
            {chip && !isInvite ? (
              <View style={styles.chip}>
                <Text style={styles.chipText} numberOfLines={1}>
                  {chip}
                </Text>
              </View>
            ) : null}
          </View>
        </UserPressable>
        {control}
      </View>
    );
  };

  const renderHeading = (text: string, inGroup: boolean): React.JSX.Element =>
    isInvite ? (
      <Text style={styles.inviteHeading} accessibilityRole="header">
        {text}
      </Text>
    ) : (
    <View style={styles.headingRow}>
      <View style={[styles.dot, inGroup ? styles.dotGroup : styles.dotOther]} />
      <Text
        style={[styles.headingText, inGroup ? styles.headingTextGroup : null]}
        accessibilityRole="header"
      >
        {text}
      </Text>
    </View>
  );

  const field = (
    <TextField
      style={isInvite ? styles.inviteInput : styles.input}
      placeholder={placeholder ?? t('mob.user_search.placeholder')}
      value={query}
      onChangeText={setQuery}
      onFocus={handleFocus}
      editable={!disabled}
      autoCapitalize="none"
      autoCorrect={false}
      accessibilityLabel={t('mob.user_search.a11y')}
    />
  );

  const suggestedHeading = t(HEADING_KEYS[suggestionContext]);

  return (
    <View>
      <UserMenuSheet menu={menu} />
      {isInvite ? (
        <View style={styles.inviteSearchWrap}>
          <View style={styles.inviteSearchIcon} pointerEvents="none">
            <SearchIcon size={20} color={groupView.textSecondary} />
          </View>
          {field}
        </View>
      ) : (
        field
      )}
      {belowInput}
      {isSearching ? (
        <View style={styles.statusRow}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {showEmpty ? <Text style={styles.emptyText}>{t('mob.user_search.no_matches')}</Text> : null}
      {showEmailAffordance ? (
        <View style={isInvite ? undefined : styles.resultsList}>
          <View style={[styles.resultRow, isInvite ? styles.resultRowInvite : null]}>
            <View style={styles.resultText}>
              <Text style={styles.emailAffordanceTitle}>
                {t('mob.user_search.invite_email_title', { email: trimmed, entity })}
              </Text>
              <Text style={styles.resultDisplayName}>{t('mob.user_search.invite_email_hint')}</Text>
            </View>
            {selectionMode === 'immediate' ? (
              <AddRemoveControl
                mode="immediate"
                name={trimmed}
                accessibilityLabelOverride={emailLabel}
                onSend={() => sendEmailImmediate(trimmed)}
                disabled={disabled}
                testID="user-search-email-row"
              />
            ) : (
              <AddRemoveControl
                mode="staged"
                name={trimmed}
                accessibilityLabelOverride={emailLabel}
                staged={false}
                onStage={() => handleSelectEmail(trimmed)}
                onUnstage={() => undefined}
                disabled={disabled}
                testID="user-search-email-row"
              />
            )}
          </View>
        </View>
      ) : null}
      {!isInvite && !isSearching && visibleResults.length > 0 ? (
        <Text style={styles.listTitle} accessibilityRole="header">
          {suggestedHeading}
        </Text>
      ) : null}
      {!isSearching && visibleResults.length > 0 ? (
        <View style={isInvite ? undefined : styles.resultsList}>
          {groupRows.length > 0 ? (
            <>
              {renderHeading(isInvite ? suggestedHeading : t('mob.user_search.heading_in_your_groups'), true)}
              {groupRows.map(user => renderRow(user, true))}
            </>
          ) : null}
          {isInvite && groupRows.length > 0 && otherRows.length > 0 ? (
            <View style={styles.inviteSectionGap} />
          ) : null}
          {otherRows.length > 0 ? (
            <>
              {sectioned
                ? renderHeading(t('mob.user_search.heading_other'), false)
                : isInvite
                  ? renderHeading(suggestedHeading, true)
                  : null}
              {otherRows.map(user => renderRow(user, false))}
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { marginBottom: spacing.xs },
  statusRow: { alignItems: 'flex-start', paddingVertical: spacing.sm },
  errorText: { ...typography.body, color: colors.error, paddingVertical: spacing.sm },
  emptyText: { ...typography.body, color: colors.textSecondary, paddingVertical: spacing.sm },
  resultsList: {
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: colors.border,
  },
  listTitle: { ...typography.bodyBold, color: colors.textPrimary, marginTop: spacing.md, marginBottom: spacing.sm },
  headingText: { ...typography.caption, fontWeight: '700', color: colors.textSecondary, marginLeft: spacing.sm },
  headingTextGroup: { color: colors.primaryDark },
  dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2 },
  dotGroup: { backgroundColor: colors.primary },
  dotOther: {
    borderWidth: 2,
    borderColor: colors.textMuted,
    backgroundColor: 'transparent',
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  resultRowGroup: { backgroundColor: colors.primaryLight },
  resultRowDisabled: { opacity: 0.6 },
  resultLeft: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  resultText: { flexShrink: 1, marginLeft: spacing.md },
  resultDisplayName: { ...typography.caption, color: colors.textSecondary },
  chip: {
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    flexShrink: 1,
  },
  chipText: { ...typography.caption, color: colors.primaryDark },
  emailAffordanceTitle: { ...typography.bodyBold, color: colors.primary },
  inviteInput: {
    backgroundColor: groupView.searchBg,
    borderWidth: 0,
    borderRadius: 14,
    paddingLeft: 48,
    minHeight: sizes.touchTarget + 8,
  },
  inviteSearchWrap: { justifyContent: 'center', marginBottom: spacing.sm },
  inviteSearchIcon: { position: 'absolute', left: spacing.md, zIndex: 1 },
  inviteHeading: {
    ...typography.label,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: groupView.textSecondary,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  inviteSectionGap: {
    height: spacing.sm,
    backgroundColor: groupView.sectionBg,
    marginHorizontal: -spacing.md,
  },
  resultRowInvite: {
    paddingHorizontal: 0,
    borderBottomWidth: 0,
    minHeight: sizes.touchTarget + 8,
  },
  pendingLabel: { ...typography.caption, color: colors.textMuted },
});
