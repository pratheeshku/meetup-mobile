/**
 * Create Group (DES-MEETUP-MOBILE.md §4.4, §7.3; R-030).
 *
 * Fields mirror the live OpenAPI `GroupCreate` schema exactly: `name`
 * (required, 1–100 chars) and `description` (optional). There is no
 * `members_can_invite` on the create request. On success it pops back to
 * the Groups list with a new `refreshKey`, which makes the list re-fetch.
 * Permission/validity is decided by the backend; the message it returns for
 * a rejected request is shown inline.
 */
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { withCorrelationId } from '../api/correlationId';
import { createGroup } from '../api/groups';
import Button from '../components/Button';
import TextField from '../components/TextField';
import { colors, spacing, typography } from '../theme/tokens';
import { getApiErrorMessage } from '../utils/apiError';
import type { GroupsStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<GroupsStackParamList, 'CreateGroup'>;

const NAME_MAX_LENGTH = 100;

export default function CreateGroupScreen({ navigation }: Props): React.JSX.Element {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (): Promise<void> => {
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Enter a group name.');
      return;
    }

    setIsSubmitting(true);
    try {
      await withCorrelationId(async correlationId => {
        await createGroup(
          { name: trimmedName, description: description.trim() },
          { correlationId },
        );
      });
      navigation.popTo('GroupsList', { refreshKey: Date.now() });
    } catch (e) {
      setError(getApiErrorMessage(e, 'Could not create the group. Please try again.'));
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>Name</Text>
      <TextField
        style={styles.input}
        placeholder="e.g. Sunday Footballers"
        value={name}
        onChangeText={setName}
        maxLength={NAME_MAX_LENGTH}
        editable={!isSubmitting}
      />

      <Text style={styles.label}>Description (optional)</Text>
      <TextField
        style={[styles.input, styles.multiline]}
        placeholder="What is this group about?"
        value={description}
        onChangeText={setDescription}
        multiline
        textAlignVertical="top"
        editable={!isSubmitting}
      />

      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <Button label="Create Group" onPress={handleSubmit} loading={isSubmitting} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg },
  label: { ...typography.bodyBold, color: colors.textPrimary, marginBottom: spacing.xs },
  input: { marginBottom: spacing.md },
  multiline: { minHeight: spacing.xxl * 2 },
  error: { ...typography.body, color: colors.error, marginBottom: spacing.md },
});
