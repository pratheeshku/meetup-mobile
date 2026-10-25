/**
 * Book-a-court block (DES-MEETUP-ADDENDUM-tournament-experience AD-T2; boards HomeBooking, TV2MobOpen,
 * TV2MobClosedOverview, TV2MobDoneOverview). One component for the Home screen and the last block of the tournament
 * Overview. The providers come from `GET /home/court-booking` (admin-managed, in order); an empty list or a failed
 * call renders nothing (no empty card). A booking link opens in the system browser and carries no user data.
 * Theme tokens only; every icon-plus-text row sits in fixed-size boxes.
 */
import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { getCourtBooking } from '../../api/home';
import { useT } from '../../labels/LabelsContext';
import { dash, dashRadius } from '../../theme/dashboardTheme';
import { borderWidth, colors, gradientTokens, radius, spacing, typography } from '../../theme/tokens';
import type { CourtProvider } from '../../types/tournament';
import { toHttpsUrl } from '../../utils/httpsUrl';
import { openLink } from '../../utils/openLink';
import { CalendarIcon, ExternalLinkIcon, InfoIcon } from '../icons/HomeV2Icons';

const TILE = 44;
const BUTTON_WIDTH = 84;
const BUTTON_HEIGHT = 44;
const GLYPH = 16;

/** Fallback-tile colour per row, cycling. Tokens only. The Book button is not part of this: it is one colour for every row (AD-8). */
const TILE_TONES = [gradientTokens.blue.start, gradientTokens.green.start, gradientTokens.orange.start] as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[1][0]).toUpperCase();
}

/** Loads the providers once. `null` while loading or after a failure; the block renders nothing for both. */
export function useCourtProviders(): CourtProvider[] | null {
  const [providers, setProviders] = useState<CourtProvider[] | null>(null);
  useEffect(() => {
    let live = true;
    Promise.resolve()
      .then(() => getCourtBooking())
      .then(items => {
        if (live) {
          setProviders(items);
        }
      })
      .catch(() => {
        if (live) {
          setProviders(null);
        }
      });
    return () => {
      live = false;
    };
  }, []);
  return providers;
}

function ProviderLogo({ provider, tone }: { provider: CourtProvider; tone: string }): React.JSX.Element {
  const t = useT();
  const [failed, setFailed] = useState(false);
  const url = toHttpsUrl(provider.logo_url);
  if (url && !failed) {
    return (
      <Image
        source={{ uri: url }}
        style={styles.logo}
        onError={() => setFailed(true)}
        accessibilityLabel={t('mob.home.court_booking.logo_alt', { name: provider.name })}
        testID="court-provider-logo"
      />
    );
  }
  return (
    <View style={[styles.logo, styles.logoFallback, { backgroundColor: tone }]} testID="court-provider-logo-fallback">
      <Text style={styles.logoInitials}>{initials(provider.name)}</Text>
    </View>
  );
}

export default function CourtBookingBlock({
  providers,
  testID = 'court-booking-block',
}: {
  providers: CourtProvider[] | null;
  testID?: string;
}): React.JSX.Element | null {
  const t = useT();
  if (!providers || providers.length === 0) {
    return null;
  }
  return (
    <View style={styles.card} testID={testID}>
      <View style={styles.header}>
        <View style={styles.headerTile}>
          <CalendarIcon size={24} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title} accessibilityRole="header">
            {t('mob.home.court_booking.title')}
          </Text>
          <Text style={styles.subtitle}>{t('mob.home.court_booking.subtitle')}</Text>
        </View>
      </View>
      {providers.map((provider, index) => {
        const tone = TILE_TONES[index % TILE_TONES.length];
        return (
          <View
            key={provider.id}
            style={[styles.row, index > 0 ? styles.rowDivider : null]}
            testID={`court-provider-${provider.id}`}
          >
            <ProviderLogo provider={provider} tone={tone} />
            <View style={styles.rowText}>
              <Text style={styles.name}>{provider.name}</Text>
              {provider.description ? <Text style={styles.description}>{provider.description}</Text> : null}
            </View>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={t('mob.home.court_booking.book_a11y', { name: provider.name })}
              onPress={() => {
                openLink(provider.booking_url, t('mob.home.court_booking.title'));
              }}
              style={({ pressed }) => [styles.button, styles.buttonCta, pressed ? styles.pressed : null]}
              testID={`court-book-${provider.id}`}
            >
              <Text style={styles.buttonText}>{t('mob.home.court_booking.book')}</Text>
              <View style={styles.glyphBox}>
                <ExternalLinkIcon size={GLYPH} color={colors.white} />
              </View>
            </Pressable>
          </View>
        );
      })}
      <View style={styles.footer}>
        <View style={styles.glyphBox}>
          <InfoIcon size={GLYPH} color={colors.textSecondary} />
        </View>
        <Text style={styles.footerText}>{t('mob.home.court_booking.opens_browser')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: dash.card,
    borderRadius: dashRadius.card,
    borderWidth: borderWidth.thin,
    borderColor: dash.cardBorder,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  headerTile: {
    width: TILE,
    height: TILE,
    borderRadius: radius.md,
    backgroundColor: colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, minWidth: 0, marginLeft: spacing.sm },
  title: { ...typography.h3, color: dash.text },
  subtitle: { ...typography.caption, color: dash.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  rowDivider: { borderTopWidth: borderWidth.thin, borderTopColor: dash.cardBorder },
  logo: { width: TILE, height: TILE, borderRadius: radius.md },
  logoFallback: { alignItems: 'center', justifyContent: 'center' },
  logoInitials: { ...typography.bodyBold, color: colors.white },
  rowText: { flex: 1, minWidth: 0, marginHorizontal: spacing.sm },
  name: { ...typography.bodyBold, color: dash.text },
  description: { ...typography.caption, color: dash.textMuted },
  button: {
    width: BUTTON_WIDTH,
    height: BUTTON_HEIGHT,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonCta: { backgroundColor: colors.ctaBlue },
  pressed: { opacity: 0.85 },
  buttonText: { ...typography.bodyBold, color: colors.white, marginRight: spacing.xs },
  glyphBox: { width: GLYPH + 4, height: GLYPH + 4, alignItems: 'center', justifyContent: 'center' },
  footer: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
  footerText: { ...typography.caption, color: dash.textMuted, flex: 1, marginLeft: spacing.xs },
});
