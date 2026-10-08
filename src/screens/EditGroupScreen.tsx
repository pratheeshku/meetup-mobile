import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { withCorrelationId } from '../api/correlationId';
import {
  deleteGroupLogo,
  getGroup,
  updateGroup,
  uploadGroupLogo,
} from '../api/groups';
import Button from '../components/Button';
import Card from '../components/Card';
import ErrorView from '../components/ErrorView';
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import LoadingView from '../components/LoadingView';
import TextField from '../components/TextField';
import { useT } from '../labels/LabelsContext';
import type { GroupsStackParamList } from '../navigation/types';
import { borderWidth, colors, radius, spacing, typography } from '../theme/tokens';
import { getApiErrorMessage } from '../utils/apiError';
import { isPickerCancelled, pickImage, type PickedImage } from '../utils/imagePicker';

type Props = NativeStackScreenProps<GroupsStackParamList, 'EditGroup'>;

const NAME_MAX_LENGTH = 100;

export default function EditGroupScreen({ navigation, route }: Props): React.JSX.Element {
  const { groupId } = route.params;
  const t = useT();

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(null);
  const [newLogo, setNewLogo] = useState<PickedImage | null>(null);
  const [isLogoRemoved, setIsLogoRemoved] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadGroupData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await getGroup(groupId);
      setName(data.name);
      setDescription(data.description ?? '');
      setCurrentLogoUrl(data.logo_url ?? null);
    } catch {
      setLoadError(t('mob.group_detail.load_error'));
    } finally {
      setIsLoading(false);
    }
  }, [groupId, t]);

  useEffect(() => {
    loadGroupData();
  }, [loadGroupData]);

  const handlePickSource = async (source: 'camera' | 'library'): Promise<void> => {
    try {
      const result = await pickImage(source, t('mob.group_detail.crop_title'));
      if (result) {
        setNewLogo(result);
        setIsLogoRemoved(false);
      }
    } catch (e) {
      if (!isPickerCancelled(e)) {
        setSaveError(getApiErrorMessage(e, t('mob.profile.photo_upload_error')));
      }
    }
  };

  const handleLogoPress = (): void => {
    const hasLogo = Boolean(newLogo?.path || (!isLogoRemoved && currentLogoUrl));
    const buttons: Array<{ text: string; style?: 'cancel' | 'destructive' | 'default'; onPress?: () => void }> = [
      { text: t('mob.common.cancel'), style: 'cancel' },
      {
        text: t('mob.create_group.take_photo'),
        onPress: () => handlePickSource('camera'),
      },
      {
        text: t('mob.create_group.choose_photo'),
        onPress: () => handlePickSource('library'),
      },
    ];

    if (hasLogo) {
      buttons.push({
        text: t('mob.edit_group.remove_logo'),
        style: 'destructive',
        onPress: () => {
          setNewLogo(null);
          setIsLogoRemoved(true);
        },
      });
    }

    Alert.alert(t('mob.create_group.photo_title'), undefined, buttons);
  };

  const handleSave = async (): Promise<void> => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setSaveError(t('mob.edit_group.err_name'));
      return;
    }

    setSaveError(null);
    setIsSaving(true);
    try {
      await withCorrelationId(async correlationId => {
        // 1. Update name and description
        await updateGroup(
          groupId,
          { name: trimmedName, description: description.trim() },
          { correlationId },
        );

        // 2. Handle logo changes
        if (newLogo) {
          await uploadGroupLogo(
            groupId,
            newLogo.path,
            newLogo.filename,
            newLogo.mime,
            { correlationId },
          );
        } else if (isLogoRemoved && currentLogoUrl) {
          await deleteGroupLogo(groupId, { correlationId });
        }
      });

      navigation.goBack();
    } catch (e) {
      setSaveError(getApiErrorMessage(e, t('mob.edit_group.err_update')));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <LoadingView />;
  }

  if (loadError) {
    return <ErrorView message={loadError} onRetry={loadGroupData} />;
  }

  const effectiveLogoUri = newLogo?.path ?? (!isLogoRemoved ? currentLogoUrl : null);
  const initials = (name.trim().charAt(0) || '?').toUpperCase();

  return (
    <KeyboardAwareScreen contentContainerStyle={styles.container}>
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>{t('mob.edit_group.logo_label')}</Text>

        <View style={styles.logoRow}>
          <Pressable
            onPress={handleLogoPress}
            style={styles.logoPickerContainer}
            accessibilityRole="button"
            accessibilityLabel={t('mob.edit_group.logo_label')}
            disabled={isSaving}
          >
            {effectiveLogoUri ? (
              <Image source={{ uri: effectiveLogoUri }} style={styles.logoImage} resizeMode="cover" />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoPlaceholderText}>{initials}</Text>
              </View>
            )}
          </Pressable>

          <View style={styles.logoActions}>
            <Button
              label={t('mob.edit_group.change_logo')}
              variant="secondary"
              size="sm"
              onPress={handleLogoPress}
              disabled={isSaving}
              style={styles.logoButton}
            />
            {effectiveLogoUri ? (
              <Button
                label={t('mob.edit_group.remove_logo')}
                variant="destructive"
                size="sm"
                onPress={() => {
                  setNewLogo(null);
                  setIsLogoRemoved(true);
                }}
                disabled={isSaving}
                style={styles.logoButton}
              />
            ) : null}
          </View>
        </View>

        <Text style={styles.label}>{t('mob.edit_group.name')}</Text>
        <TextField
          value={name}
          onChangeText={setName}
          placeholder={t('mob.edit_group.name_placeholder')}
          maxLength={NAME_MAX_LENGTH}
          editable={!isSaving}
          style={styles.input}
        />

        <Text style={styles.label}>{t('mob.edit_group.description')}</Text>
        <TextField
          value={description}
          onChangeText={setDescription}
          placeholder={t('mob.edit_group.description_placeholder')}
          multiline
          textAlignVertical="top"
          editable={!isSaving}
          style={[styles.input, styles.multilineInput]}
        />

        {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}

        <View style={styles.footerButtons}>
          <Button
            label={t('mob.edit_group.save_btn')}
            variant="primary"
            onPress={handleSave}
            loading={isSaving}
            disabled={isSaving}
            style={styles.saveButton}
          />
          <Button
            label={t('mob.common.cancel')}
            variant="secondary"
            onPress={() => navigation.goBack()}
            disabled={isSaving}
            style={styles.cancelButton}
          />
        </View>
      </Card>
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  card: {
    padding: spacing.md,
  },
  sectionTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  logoPickerContainer: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    marginRight: spacing.md,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  logoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoPlaceholderText: {
    ...typography.h2,
    color: colors.primary,
  },
  logoActions: {
    flex: 1,
    gap: spacing.xs,
  },
  logoButton: {
    alignSelf: 'flex-start',
  },
  label: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  input: {
    marginBottom: spacing.sm,
  },
  multilineInput: {
    minHeight: 100,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    marginBottom: spacing.md,
  },
  footerButtons: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  saveButton: {
    width: '100%',
  },
  cancelButton: {
    width: '100%',
  },
});
