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
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { withCorrelationId } from '../api/correlationId';
import { searchUsers } from '../api/users';
import { borderWidth, colors, radius, sizes, spacing, typography } from '../theme/tokens';
import type { UserSearchResult } from '../types/user';
import TextField from './TextField';
import UserAvatar from './UserAvatar';
import type { LabelKey } from '../labels/fallbackLabels';
import { useT } from '../labels/LabelsContext';

const DEBOUNCE_MS = 300;
const AVATAR_SIZE = 40;
const DOT_SIZE = 10;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SuggestionContext = 'players' | 'group_members' | 'team_players';

const HEADING_KEYS: Record<SuggestionContext, LabelKey> = {
  players: 'mob.user_search.heading_players',
  group_members: 'mob.user_search.heading_group_members',
  team_players: 'mob.user_search.heading_team_players',
};

interface UserSearchPickerProps {
  onSelect: (user: UserSearchResult) => void | Promise<void>;
  onSelectEmail?: (email: string) => void;
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
}: UserSearchPickerProps): React.JSX.Element {
  const t = useT();
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
            defaultCache.current = found;
          }
          setResults(found);
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

  const handleSelectEmail = (email: string): void => {
    if (!onSelectEmail) {
      return;
    }
    onSelectEmail(email);
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
    return (
      <Pressable
        key={user.id}
        style={({ pressed }) => [
          styles.resultRow,
          inGroup ? styles.resultRowGroup : null,
          user.pending ? styles.resultRowDisabled : null,
          pressed && !locked ? styles.resultRowPressed : null,
        ]}
        onPress={() => handleSelect(user)}
        disabled={locked}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: locked, busy: busyId === user.id }}
        testID="user-search-row"
      >
        <View style={styles.resultLeft}>
          <UserAvatar
            imageUrl={user.image_url}
            name={user.display_name}
            size={AVATAR_SIZE}
          />
          <View style={styles.resultText}>
            <View style={styles.nicknameRow}>
              <Text style={styles.resultNickname} numberOfLines={1}>
                {user.nickname}
              </Text>
              {chip ? (
                <View style={styles.chip}>
                  <Text style={styles.chipText} numberOfLines={1}>
                    {chip}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.resultDisplayName} numberOfLines={1}>
              {user.display_name}
            </Text>
          </View>
        </View>
        {user.pending ? (
          <Text style={styles.pendingLabel}>{t('mob.user_search.pending')}</Text>
        ) : busyId === user.id ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <View style={[styles.inviteButton, inGroup ? styles.inviteButtonGroup : null]}>
            <Text style={[styles.inviteButtonText, inGroup ? styles.inviteButtonTextGroup : null]}>
              {t('mob.user_search.invite_button')}
            </Text>
          </View>
        )}
      </Pressable>
    );
  };

  const renderHeading = (text: string, inGroup: boolean): React.JSX.Element => (
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

  return (
    <View>
      <TextField
        style={styles.input}
        placeholder={placeholder ?? t('mob.user_search.placeholder')}
        value={query}
        onChangeText={setQuery}
        onFocus={handleFocus}
        editable={!disabled}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel={t('mob.user_search.a11y')}
      />
      {isSearching ? (
        <View style={styles.statusRow}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {showEmpty ? <Text style={styles.emptyText}>{t('mob.user_search.no_matches')}</Text> : null}
      {showEmailAffordance ? (
        <View style={styles.resultsList}>
          <Pressable
            style={({ pressed }) => [
              styles.resultRow,
              pressed ? styles.resultRowPressed : null,
            ]}
            onPress={() => handleSelectEmail(trimmed)}
            accessibilityRole="button"
            accessibilityLabel={t('mob.user_search.invite_email_a11y', { email: trimmed, entity })}
          >
            <View style={styles.resultText}>
              <Text style={styles.emailAffordanceTitle}>
                {t('mob.user_search.invite_email_title', { email: trimmed, entity })}
              </Text>
              <Text style={styles.resultDisplayName}>{t('mob.user_search.invite_email_hint')}</Text>
            </View>
          </Pressable>
        </View>
      ) : null}
      {!isSearching && visibleResults.length > 0 ? (
        <Text style={styles.listTitle} accessibilityRole="header">
          {t(HEADING_KEYS[suggestionContext])}
        </Text>
      ) : null}
      {!isSearching && visibleResults.length > 0 ? (
        <View style={styles.resultsList}>
          {groupRows.length > 0 ? (
            <>
              {renderHeading(t('mob.user_search.heading_in_your_groups'), true)}
              {groupRows.map(user => renderRow(user, true))}
            </>
          ) : null}
          {otherRows.length > 0 ? (
            <>
              {sectioned ? renderHeading(t('mob.user_search.heading_other'), false) : null}
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
  resultRowPressed: { backgroundColor: colors.background },
  resultRowDisabled: { opacity: 0.6 },
  resultLeft: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  resultText: { flexShrink: 1, marginLeft: spacing.md },
  nicknameRow: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  resultNickname: { ...typography.bodyBold, color: colors.textPrimary, flexShrink: 1 },
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
  inviteButton: {
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.track,
  },
  inviteButtonGroup: { backgroundColor: colors.ctaBlue },
  inviteButtonText: { ...typography.caption, color: colors.textSecondary },
  inviteButtonTextGroup: { color: colors.white },
  emailAffordanceTitle: { ...typography.bodyBold, color: colors.primary },
  pendingLabel: { ...typography.caption, color: colors.textMuted },
});
