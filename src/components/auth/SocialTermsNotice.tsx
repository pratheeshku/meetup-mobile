import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getCachedLegalLinks, getLegalLinks } from '../../api/home';
import { useT } from '../../labels/LabelsContext';
import { colors, spacing, typography } from '../../theme/tokens';
import { toHttpsUrl } from '../../utils/httpsUrl';
import { openLink } from '../../utils/openLink';

/**
 * Terms and Privacy notice under social login buttons (DES-MEETUP-ADDENDUM-social-login AD-9).
 * - "By continuing you agree to the Terms and Conditions and Privacy Policy"
 * - Fetches terms_url and privacy_url from GET /home/legal-links.
 * - Uses cached legal-links response to avoid duplicate requests.
 * - Non-empty URLs render as links; empty or failed fetch renders plain text with no error.
 * - Uses existing label mechanism with the exact same wording as the menu labels.
 */
export default function SocialTermsNotice(): React.JSX.Element {
  const t = useT();
  const [termsUrl, setTermsUrl] = useState<string | null>(null);
  const [privacyUrl, setPrivacyUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const cached = typeof getCachedLegalLinks === 'function' ? await getCachedLegalLinks() : null;
        if (cached && active) {
          setTermsUrl(toHttpsUrl(cached.terms_url));
          setPrivacyUrl(toHttpsUrl(cached.privacy_url));
          return;
        }
        const links = await getLegalLinks();
        if (!active || !links) {
          return;
        }
        setTermsUrl(toHttpsUrl(links.terms_url));
        setPrivacyUrl(toHttpsUrl(links.privacy_url));
      } catch {
        // A failed fetch shows plain text, no error
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleOpenLink = (url: string | null): void => {
    if (!url) {
      return;
    }
    openLink(url, t('mob.errors.open_page_failed'));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.text} accessibilityLabel={t('mob.auth.social_terms_a11y')}>
        {t('mob.auth.social_terms_prefix')}{' '}
        {termsUrl ? (
          <Text
            style={styles.link}
            accessibilityRole="link"
            onPress={() => handleOpenLink(termsUrl)}
          >
            {t('mob.menu.terms')}
          </Text>
        ) : (
          <Text>{t('mob.menu.terms')}</Text>
        )}{' '}
        {t('mob.common.and')}{' '}
        {privacyUrl ? (
          <Text
            style={styles.link}
            accessibilityRole="link"
            onPress={() => handleOpenLink(privacyUrl)}
          >
            {t('mob.menu.privacy')}
          </Text>
        ) : (
          <Text>{t('mob.menu.privacy')}</Text>
        )}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  text: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  link: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
});
