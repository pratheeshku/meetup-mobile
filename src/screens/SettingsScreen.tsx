/**
 * Settings screen (Phase 2 revamp, Settings.png).
 *
 * Controls:
 * - NOTIFICATIONS: Push notifications switch, Email notifications switch
 * - HELP: Contact support, Report a problem
 * - ABOUT: Privacy policy, Terms and conditions
 * - DANGER ZONE: Delete account card linking to Phase 1 deletion flow
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  getNotificationSettings,
  parseOwnsGroupsError,
  requestDeletion,
  updateNotificationSettings,
} from '../api/profile';
import { withCorrelationId } from '../api/correlationId';
import appConfig from '../../config/appConfig.json';
import { toHttpsUrl } from '../utils/httpsUrl';
import { openLink } from '../utils/openLink';
import { copyTextToClipboard } from '../utils/shareLink';
import { buildSupportText, getAppVersion } from '../utils/supportInfo';
import { toSupportLink } from '../utils/supportLink';
import { getApiErrorMessage } from '../utils/apiError';
import { BackArrowIcon, TrashIcon } from '../components/icons/ActionIcons';
import {
  ArrowRightIcon,
  BellIcon,
  MailIcon,
  PhoneIcon,
  PinIcon,
  ShieldIcon,
  TargetIcon,
} from '../components/icons/SharedIcons';
import IconBadge from '../components/IconBadge';
import LoadingView from '../components/LoadingView';
import ScreenContainer from '../components/ScreenContainer';
import Toast from '../components/Toast';
import { PA_SPIKE_ENABLED } from '../devspike/spikeFlag';
import { useT } from '../labels/LabelsContext';
import {
  borderWidth,
  colors,
  radius,
  spacing,
  typography,
} from '../theme/tokens';
import type { ProfileStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Settings'>;

export default function SettingsScreen({ navigation }: Props): React.JSX.Element {
  const t = useT();

  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isRequestingDeletion, setIsRequestingDeletion] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const reportFormUrl = toHttpsUrl(appConfig.reportFormUrl);
  const privacyPolicyUrl = toHttpsUrl(appConfig.privacyPolicyUrl);
  const termsOfUseUrl = toHttpsUrl(appConfig.termsOfUseUrl);
  const supportLink = toSupportLink(appConfig.supportContact);

  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      const settings = await getNotificationSettings();
      setPushEnabled(settings.push_enabled);
      setEmailEnabled(settings.email_enabled);
    } catch {
      // Default to true if unconfigured/offline
      setPushEnabled(true);
      setEmailEnabled(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleTogglePush = async (value: boolean): Promise<void> => {
    setPushEnabled(value);
    try {
      await updateNotificationSettings({ push_enabled: value });
    } catch {
      setPushEnabled(!value);
    }
  };

  const { version, build } = getAppVersion();
  const versionLine = t('mob.settings.app_version', { version, build });

  // Long-press: build the support text (server version fetched now, not on open) and copy it.
  const copyingRef = useRef(false);
  const handleCopySupportInfo = async (): Promise<void> => {
    if (copyingRef.current) {
      return;
    }
    copyingRef.current = true;
    try {
      copyTextToClipboard(await buildSupportText());
      setToastMessage(t('mob.settings.support_info_copied'));
    } finally {
      copyingRef.current = false;
    }
  };

  // pa-spike (__DEV__ only): 5 quick taps on the version line open the dev screen.
  const spikeTaps = useRef({ n: 0, t: 0 });
  const handleSpikeTap = (): void => {
    const now = Date.now();
    spikeTaps.current.n = now - spikeTaps.current.t < 800 ? spikeTaps.current.n + 1 : 1;
    spikeTaps.current.t = now;
    if (spikeTaps.current.n >= 5) {
      spikeTaps.current.n = 0;
      navigation.navigate('PaSpike');
    }
  };

  const handleToggleEmail = async (value: boolean): Promise<void> => {
    setEmailEnabled(value);
    try {
      await updateNotificationSettings({ email_enabled: value });
    } catch {
      setEmailEnabled(!value);
    }
  };

  const handleRequestDeletion = async (): Promise<void> => {
    try {
      setIsRequestingDeletion(true);
      await withCorrelationId(async correlationId => {
        await requestDeletion({ correlationId });
      });
      navigation.navigate('AccountDeletionCode');
    } catch (e: any) {
      const ownedGroups = parseOwnsGroupsError(e);
      if (ownedGroups && ownedGroups.length > 0) {
        navigation.navigate('AccountDeletionBlocked', { groups: ownedGroups });
        return;
      }
      Alert.alert(
        t('mob.profile.delete_account'),
        getApiErrorMessage(e, t('mob.profile.delete_start_error')),
      );
    } finally {
      setIsRequestingDeletion(false);
    }
  };

  const handleDeleteAccountPress = (): void => {
    Alert.alert(
      t('mob.profile.delete_title'),
      t('mob.profile.delete_message'),
      [
        { text: t('mob.common.cancel'), style: 'cancel' },
        { text: t('mob.common.delete'), style: 'destructive', onPress: handleRequestDeletion },
      ],
    );
  };

  if (isLoading) {
    return (
      <ScreenContainer edges="top">
        <LoadingView />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges="both" style={styles.screen}>
    <View style={styles.screen}>
      {/* Header bar */}
      <View style={styles.headerBar}>
        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('mob.common.back')}
        >
          <BackArrowIcon size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('mob.settings.title')}</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* NOTIFICATIONS section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>{t('mob.settings.section_notifications')}</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <IconBadge color="amber" size={40} borderRadius={12}>
                <BellIcon size={20} />
              </IconBadge>
              <Text style={styles.rowTitle}>{t('mob.settings.push_notifications')}</Text>
              <Switch
                value={pushEnabled}
                onValueChange={handleTogglePush}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.white}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.row}>
              <IconBadge color="blue" size={40} borderRadius={12}>
                <MailIcon size={20} />
              </IconBadge>
              <Text style={styles.rowTitle}>{t('mob.settings.email_notifications')}</Text>
              <Switch
                value={emailEnabled}
                onValueChange={handleToggleEmail}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.white}
              />
            </View>
          </View>
        </View>

        {/* HELP section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>{t('mob.settings.section_help')}</Text>
          <View style={styles.card}>
            {supportLink ? (
              <>
                <Pressable
                  style={styles.clickableRow}
                  onPress={() => openLink(supportLink, t('mob.errors.open_link_failed'))}
                  accessibilityRole="button"
                  accessibilityLabel={t('mob.settings.contact_support')}
                >
                  <IconBadge color="teal" size={40} borderRadius={12}>
                    <PhoneIcon size={20} />
                  </IconBadge>
                  <Text style={styles.rowTitle}>{t('mob.settings.contact_support')}</Text>
                  <ArrowRightIcon size={18} />
                </Pressable>
                <View style={styles.divider} />
              </>
            ) : null}

            {reportFormUrl ? (
              <Pressable
                style={styles.clickableRow}
                onPress={() => openLink(reportFormUrl, t('mob.errors.open_form_failed'))}
                accessibilityRole="button"
                accessibilityLabel={t('mob.settings.report_problem')}
              >
                <IconBadge color="orange" size={40} borderRadius={12}>
                  <PinIcon size={20} />
                </IconBadge>
                <Text style={styles.rowTitle}>{t('mob.settings.report_problem')}</Text>
                <ArrowRightIcon size={18} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* ABOUT section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>{t('mob.settings.section_about')}</Text>
          <View style={styles.card}>
            {privacyPolicyUrl ? (
              <>
                <Pressable
                  style={styles.clickableRow}
                  onPress={() => openLink(privacyPolicyUrl, t('mob.errors.open_page_failed'))}
                  accessibilityRole="button"
                  accessibilityLabel={t('mob.settings.privacy_policy')}
                >
                  <IconBadge color="blue" size={40} borderRadius={12}>
                    <ShieldIcon size={20} />
                  </IconBadge>
                  <Text style={styles.rowTitle}>{t('mob.settings.privacy_policy')}</Text>
                  <ArrowRightIcon size={18} />
                </Pressable>
                <View style={styles.divider} />
              </>
            ) : null}

            {termsOfUseUrl ? (
              <Pressable
                style={styles.clickableRow}
                onPress={() => openLink(termsOfUseUrl, t('mob.errors.open_page_failed'))}
                accessibilityRole="button"
                accessibilityLabel={t('mob.settings.terms_conditions')}
              >
                <IconBadge color="purple" size={40} borderRadius={12}>
                  <TargetIcon size={20} />
                </IconBadge>
                <Text style={styles.rowTitle}>{t('mob.settings.terms_conditions')}</Text>
                <ArrowRightIcon size={18} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* DANGER ZONE section */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, styles.dangerHeader]}>
            {t('mob.settings.section_danger')}
          </Text>
          <Pressable
            style={styles.dangerCard}
            onPress={handleDeleteAccountPress}
            disabled={isRequestingDeletion}
            accessibilityRole="button"
            accessibilityLabel={t('mob.settings.delete_account')}
          >
            <IconBadge color="red" size={40} borderRadius={12}>
              <TrashIcon size={20} color={colors.white} />
            </IconBadge>
            <View style={styles.dangerTextCol}>
              <Text style={styles.dangerTitle}>{t('mob.settings.delete_account')}</Text>
              <Text style={styles.dangerSubtitle}>{t('mob.settings.delete_account_sub')}</Text>
            </View>
            {isRequestingDeletion ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <ArrowRightIcon size={18} />
            )}
          </Pressable>
        </View>

        {/* App version: long-press copies the support text */}
        <Pressable
          onLongPress={handleCopySupportInfo}
          onPress={PA_SPIKE_ENABLED ? handleSpikeTap : undefined}
          accessibilityRole="text"
          accessibilityLabel={versionLine}
          testID="settings-app-version"
          style={styles.versionWrap}
        >
          <Text style={styles.versionText}>{versionLine}</Text>
        </Pressable>
      </ScrollView>
      <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
    </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
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
  headerTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  section: {
    gap: spacing.xs,
  },
  versionWrap: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  versionText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  sectionHeader: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
    marginLeft: spacing.xs,
    letterSpacing: 0.5,
  },
  dangerHeader: {
    color: colors.error,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    paddingVertical: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  clickableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  rowTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    flex: 1,
    fontSize: 15,
  },
  divider: {
    height: borderWidth.thin,
    backgroundColor: colors.border,
    marginLeft: 68,
  },
  dangerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: borderWidth.thin,
    borderColor: colors.errorLight,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dangerTextCol: {
    flex: 1,
    gap: 2,
  },
  dangerTitle: {
    ...typography.bodyBold,
    color: colors.error,
    fontSize: 15,
  },
  dangerSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
