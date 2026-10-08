/**
 * Create Group / Tournament Team (DES-MEETUP-MOBILE.md §4.4;
 * REQ-MEETUP Addendum B R-200–R-207 for the Team entity).
 *
 * Single screen with a Players Group / Tournament Team toggle at top
 * (default: Players Group). Toggle changes the visible field set and
 * submit target within the same screen — not a screen navigation.
 *
 * Both forms' state is declared unconditionally at this component's top
 * level so toggling back and forth never loses what the user already
 * typed — the same pattern as CreateGameScreen's Casual/Tournament toggle.
 *
 * Players Group → POST /groups  — { name, description? }
 * Tournament Team → POST /teams — { name, sport, visibility }
 *
 * Two distinct endpoints, not a discriminator on one POST.
 * Captain is NOT a form field — backend auto-assigns to the creator.
 * No member-invite step on this screen.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { withCorrelationId } from '../api/correlationId';
import { createGroup, uploadGroupLogo } from '../api/groups';
import { getSports } from '../api/sports';
import { createTeam } from '../api/teams';
import Button from '../components/Button';
import { GroupsIcon, ShieldIcon } from '../components/icons/SharedIcons';
import ErrorView from '../components/ErrorView';
import LoadingView from '../components/LoadingView';
import OptionChips from '../components/OptionChips';
import type { ChipOption } from '../components/OptionChips';
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import TextField from '../components/TextField';
import { getLabel, useLabels } from '../labels/LabelsContext';
import { useFieldChain } from '../hooks/useFieldChain';
import { borderWidth, colors, radius, spacing, typography } from '../theme/tokens';
import type { Sport } from '../types/sport';
import type { TeamVisibility } from '../types/team';
import { goToDashboard } from '../navigation/goToDashboard';
import { getApiErrorMessage } from '../utils/apiError';
import { isPickerCancelled, pickImage, type PickedImage } from '../utils/imagePicker';
import type { GroupsStackParamList } from '../navigation/types';
import { useT } from '../labels/LabelsContext';

type Props = NativeStackScreenProps<GroupsStackParamList, 'CreateGroup'>;

type GroupKind = 'group' | 'team';

const NAME_MAX_LENGTH = 100;

export default function CreateGroupScreen({ navigation }: Props): React.JSX.Element {
  const labels = useLabels();
  const t = useT();
  const tRef = useRef(t);
  tRef.current = t;
  const MODE_OPTIONS: ChipOption<GroupKind>[] = [
    { value: 'group', label: t('mob.create_group.mode_group'), icon: <GroupsIcon size={18} /> },
    { value: 'team', label: t('mob.create_group.mode_team'), icon: <ShieldIcon size={18} /> },
  ];
  const [mode, setMode] = useState<GroupKind>('group');

  // Sports loading — only needed for Tournament Team mode, but loaded
  // on mount (same as CreateGameScreen) so the dropdown is ready when
  // the user toggles.
  const [sports, setSports] = useState<Sport[]>([]);
  const [isLoadingSports, setIsLoadingSports] = useState(true);
  const [sportsError, setSportsError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Players Group fields (GroupCreate).
  const [gName, setGName] = useState('');
  const [gDescription, setGDescription] = useState('');
  const [gLogo, setGLogo] = useState<PickedImage | null>(null);

  // Tournament Team fields (TeamCreate).
  const [tName, setTName] = useState('');
  const [tSport, setTSport] = useState<string | null>(null);
  const [tVisibility, setTVisibility] = useState<TeamVisibility>('public');

  const loadSports = useCallback(async () => {
    setIsLoadingSports(true);
    setSportsError(null);
    try {
      setSports(await getSports());
    } catch {
      setSportsError(tRef.current('mob.common.sports_load_error'));
    } finally {
      setIsLoadingSports(false);
    }
  }, []);

  useEffect(() => {
    loadSports();
  }, [loadSports]);

  const groupChain = useFieldChain(['gName', 'gDescription']);
  const teamChain = useFieldChain(['tName']);

  const handlePickLogoSource = async (source: 'camera' | 'library'): Promise<void> => {
    try {
      const result = await pickImage(source, t('mob.group_detail.crop_title'));
      if (result) {
        setGLogo(result);
      }
    } catch (e) {
      if (!isPickerCancelled(e)) {
        setError(getApiErrorMessage(e, t('mob.profile.photo_upload_error')));
      }
    }
  };

  const handleLogoPress = (): void => {
    const buttons: Array<{ text: string; style?: 'cancel' | 'destructive' | 'default'; onPress?: () => void }> = [
      { text: t('mob.common.cancel'), style: 'cancel' },
      {
        text: t('mob.create_group.take_photo'),
        onPress: () => handlePickLogoSource('camera'),
      },
      {
        text: t('mob.create_group.choose_photo'),
        onPress: () => handlePickLogoSource('library'),
      },
    ];

    if (gLogo) {
      buttons.push({
        text: t('mob.create_group.remove_logo'),
        style: 'destructive',
        onPress: () => setGLogo(null),
      });
    }

    Alert.alert(t('mob.create_group.photo_title'), undefined, buttons);
  };

  // --- Players Group submit ---
  const handleSubmitGroup = async (): Promise<void> => {
    setError(null);

    const trimmedName = gName.trim();
    if (!trimmedName) {
      setError(t('mob.create_group.err_name'));
      groupChain.focus('gName');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await withCorrelationId(async correlationId => {
        const group = await createGroup(
          { name: trimmedName, description: gDescription.trim() },
          { correlationId },
        );

        if (gLogo) {
          await uploadGroupLogo(
            group.id,
            gLogo.path,
            gLogo.filename,
            gLogo.mime,
            { correlationId },
          );
        }

        return group;
      });
      // Step 1 done: open step 2 (invite members). `replace` so Back from
      // step 2 never returns to this form and re-submits the group.
      navigation.replace('InviteMembers', { groupId: created.id });
    } catch (e) {
      setError(getApiErrorMessage(e, t('mob.create_group.err_create')));
      setIsSubmitting(false);
    }
  };

  // --- Tournament Team submit ---
  const handleSubmitTeam = async (): Promise<void> => {
    setError(null);

    const trimmedName = tName.trim();
    if (!trimmedName) {
      setError(t('mob.create_group.err_team_name'));
      teamChain.focus('tName');
      return;
    }
    if (!tSport) {
      setError(t('mob.create_group.err_sport'));
      return;
    }

    setIsSubmitting(true);
    try {
      await withCorrelationId(async correlationId => {
        await createTeam(
          { name: trimmedName, sport: tSport, visibility: tVisibility },
          { correlationId },
        );
      });
      goToDashboard(t('mob.success.team_created'));
    } catch (e) {
      setError(getApiErrorMessage(e, t('mob.create_group.err_team_create')));
      setIsSubmitting(false);
    }
  };

  if (isLoadingSports) {
    return <LoadingView />;
  }

  if (sportsError) {
    return <ErrorView message={sportsError} onRetry={loadSports} />;
  }

  const sportOptions: ChipOption<string>[] = sports.map(item => ({
    value: item.name,
    label: item.display_name,
  }));

  /**
   * Team visibility — `public` or `private` only.
   *
   * ⚠️ Distinct enum from Event visibility (public/invite_only/group)
   * and Tournament visibility (public/invite/group). Words sourced from
   * `GET /api/labels` (`team_visibility.*`) — its own key prefix, not
   * aliased to either existing visibility lookup, and never
   * `group_visibility` (the real backend field is `teams.visibility`).
   */
  const TEAM_VISIBILITY_OPTIONS: ChipOption<TeamVisibility>[] = [
    { value: 'public', label: getLabel(labels, 'team_visibility.public') },
    { value: 'private', label: getLabel(labels, 'team_visibility.private') },
  ];

  return (
    <KeyboardAwareScreen contentContainerStyle={styles.container}>
      <OptionChips options={MODE_OPTIONS} value={mode} onChange={setMode} disabled={isSubmitting} />

      {mode === 'group' ? (
        <>
          <Text style={[styles.label, styles.section]}>{t('mob.create_group.logo_label')}</Text>
          <View style={styles.logoRow}>
            <Pressable
              onPress={handleLogoPress}
              style={styles.logoPickerContainer}
              accessibilityRole="button"
              accessibilityLabel={t('mob.create_group.logo_label')}
              disabled={isSubmitting}
            >
              {gLogo ? (
                <Image source={{ uri: gLogo.path }} style={styles.logoImage} resizeMode="cover" />
              ) : (
                <View style={styles.logoPlaceholder}>
                  <GroupsIcon size={28} />
                </View>
              )}
            </Pressable>

            <View style={styles.logoActions}>
              <Button
                label={gLogo ? t('mob.create_group.change_logo') : t('mob.create_group.add_logo')}
                variant="secondary"
                size="sm"
                onPress={handleLogoPress}
                disabled={isSubmitting}
                style={styles.logoButton}
              />
              {gLogo ? (
                <Button
                  label={t('mob.create_group.remove_logo')}
                  variant="destructive"
                  size="sm"
                  onPress={() => setGLogo(null)}
                  disabled={isSubmitting}
                  style={styles.logoButton}
                />
              ) : null}
            </View>
          </View>

          <Text style={[styles.label, styles.section]}>{t('mob.create_group.name')}</Text>
          <TextField
            style={styles.input}
            {...groupChain.props('gName')}
            placeholder={t('mob.create_group.name_placeholder')}
            value={gName}
            onChangeText={setGName}
            maxLength={NAME_MAX_LENGTH}
            editable={!isSubmitting}
          />

          <Text style={styles.label}>{t('mob.create_group.description')}</Text>
          <TextField
            ref={groupChain.ref('gDescription')}
            style={[styles.input, styles.multiline]}
            placeholder={t('mob.create_group.description_placeholder')}
            value={gDescription}
            onChangeText={setGDescription}
            multiline
            textAlignVertical="top"
            editable={!isSubmitting}
          />

          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <Button label={t('mob.create_group.submit_group')} onPress={handleSubmitGroup} loading={isSubmitting} />
        </>
      ) : (
        <>
          <Text style={[styles.label, styles.section]}>{t('mob.create_group.team_name')}</Text>
          <TextField
            style={styles.input}
            {...teamChain.props('tName')}
            placeholder={t('mob.create_group.team_name_placeholder')}
            value={tName}
            onChangeText={setTName}
            maxLength={NAME_MAX_LENGTH}
            editable={!isSubmitting}
          />

          <Text style={[styles.label, styles.section]}>{t('mob.create_group.sport')}</Text>
          {sportOptions.length === 0 ? (
            <Text style={styles.hint}>{t('mob.common.no_sports')}</Text>
          ) : (
            <OptionChips options={sportOptions} value={tSport} onChange={setTSport} disabled={isSubmitting} />
          )}

          <Text style={[styles.label, styles.section]}>{t('mob.create_group.visibility')}</Text>
          <OptionChips
            options={TEAM_VISIBILITY_OPTIONS}
            value={tVisibility}
            onChange={setTVisibility}
            disabled={isSubmitting}
          />

          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <Button label={t('mob.create_group.submit_team')} onPress={handleSubmitTeam} loading={isSubmitting} />
        </>
      )}
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg },
  label: { ...typography.bodyBold, color: colors.textPrimary, marginBottom: spacing.xs },
  section: { marginTop: spacing.md },
  input: { marginBottom: spacing.md },
  multiline: { minHeight: spacing.xxl * 2 },
  hint: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md },
  error: { ...typography.body, color: colors.error, marginBottom: spacing.md },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  logoPickerContainer: {
    width: 64,
    height: 64,
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
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoActions: {
    flex: 1,
    gap: spacing.xs,
  },
  logoButton: {
    alignSelf: 'flex-start',
  },
});
