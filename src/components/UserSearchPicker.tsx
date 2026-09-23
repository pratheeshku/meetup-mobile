/**
 * Reusable user-search picker (BUG-M01) — text input, debounced query
 * against `GET /users/search`, dropdown of matches, `onSelect(user)`.
 *
 * Generic and props-driven on purpose: the three `exclude*Id` props map
 * 1:1 onto the endpoint's own `exclude_group_id`/`exclude_event_id`/
 * `exclude_team_id` query params (see `api/users.ts`), so a future Team
 * invite flow reuses this component unchanged by passing `excludeTeamId`
 * instead of `excludeGroupId` — no group-specific logic lives here. The
 * caller owns what happens on selection (e.g. `GroupDetailScreen` calls
 * `inviteMember(groupId, user.id)`); this component only finds the user.
 *
 * A `pending` result (an outstanding invite already exists for that user
 * in this context — real backend behaviour, not invented) is shown but
 * not selectable, so the caller can't fire off a redundant invite.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { withCorrelationId } from '../api/correlationId';
import { searchUsers } from '../api/users';
import { borderWidth, colors, radius, spacing, typography } from '../theme/tokens';
import type { UserSearchResult } from '../types/user';
import TextField from './TextField';

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

interface UserSearchPickerProps {
  onSelect: (user: UserSearchResult) => void;
  excludeGroupId?: string;
  excludeEventId?: string;
  excludeTeamId?: string;
  placeholder?: string;
  disabled?: boolean;
}

export default function UserSearchPicker({
  onSelect,
  excludeGroupId,
  excludeEventId,
  excludeTeamId,
  placeholder = 'Search by name or nickname...',
  disabled = false,
}: UserSearchPickerProps): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Only the most recently STARTED search may apply its result, so a slow
  // earlier response can never overwrite a newer one (same guard pattern
  // as `useForceUpdate`'s `latestCheck`).
  const latestSearch = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      latestSearch.current += 1;
      setIsSearching(false);
      setError(null);
      setResults([]);
      setHasSearched(false);
      return;
    }

    const thisSearch = ++latestSearch.current;
    setIsSearching(true);
    setError(null);

    const timer = setTimeout(() => {
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
          setResults(found);
          setHasSearched(true);
          setIsSearching(false);
        },
        () => {
          if (thisSearch !== latestSearch.current) {
            return;
          }
          setError('Could not search for users. Please try again.');
          setResults([]);
          setIsSearching(false);
        },
      );
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, excludeGroupId, excludeEventId, excludeTeamId]);

  const handleSelect = (user: UserSearchResult): void => {
    if (user.pending) {
      return;
    }
    onSelect(user);
    latestSearch.current += 1;
    setQuery('');
    setResults([]);
    setHasSearched(false);
    setError(null);
  };

  const showEmpty = !isSearching && !error && hasSearched && results.length === 0;

  return (
    <View>
      <TextField
        style={styles.input}
        placeholder={placeholder}
        value={query}
        onChangeText={setQuery}
        editable={!disabled}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="Search users"
      />
      {isSearching ? (
        <View style={styles.statusRow}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {showEmpty ? <Text style={styles.emptyText}>No users found.</Text> : null}
      {!isSearching && results.length > 0 ? (
        <View style={styles.resultsList}>
          {results.map(user => (
            <Pressable
              key={user.id}
              style={({ pressed }) => [
                styles.resultRow,
                user.pending ? styles.resultRowDisabled : null,
                pressed && !user.pending ? styles.resultRowPressed : null,
              ]}
              onPress={() => handleSelect(user)}
              disabled={user.pending}
              accessibilityRole="button"
              accessibilityLabel={
                user.pending
                  ? `${user.nickname}, ${user.display_name}, already invited`
                  : `${user.nickname}, ${user.display_name}`
              }
              accessibilityState={{ disabled: user.pending }}
            >
              <View style={styles.resultText}>
                <Text style={styles.resultNickname}>{user.nickname}</Text>
                <Text style={styles.resultDisplayName}>{user.display_name}</Text>
              </View>
              {user.pending ? <Text style={styles.pendingLabel}>Pending</Text> : null}
            </Pressable>
          ))}
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
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  resultRowPressed: { backgroundColor: colors.background },
  resultRowDisabled: { opacity: 0.6 },
  resultText: { flexShrink: 1 },
  resultNickname: { ...typography.bodyBold, color: colors.textPrimary },
  resultDisplayName: { ...typography.caption, color: colors.textSecondary },
  pendingLabel: { ...typography.caption, color: colors.textMuted },
});
