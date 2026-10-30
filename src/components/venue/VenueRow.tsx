/**
 * Venue row and bottom sheet of the game and tournament detail
 * (DES-MEETUP-ADDENDUM-game-view-redesign GV-2, AD-5; board docs/design/game-view-redesign/popups, A).
 *
 * The row replaces the boxed `VenueDetailCard` in the Details card: pin icon, venue name in the
 * link colour, chevron. A tap opens a bottom sheet that hosts the existing `VenueDetailCard`
 * content (address, map pin, photos strip, organizer photo actions, unchanged) plus
 * "Open in Google Maps" and "Copy address". Venue data and photo behaviour are not touched here.
 */
import React, { useContext, useState } from 'react';
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { useT } from '../../labels/LabelsContext';
import {
  borderWidth,
  colors,
  radius,
  sizes,
  spacing,
  typography,
} from '../../theme/tokens';
import type { VenueSnapshot } from '../../types/venue';
import { buildGoogleMapsUrl } from '../../utils/mapsUrl';
import { copyTextToClipboard } from '../../utils/shareLink';
import { CrossIcon, ChevronRightIcon } from '../icons/ActionIcons';
import { PinIcon } from '../icons/SharedIcons';
import Toast from '../Toast';
import VenueDetailCard from './VenueDetailCard';

interface VenueRowProps {
  snapshot?: VenueSnapshot | null;
  /** Name (and address) text of a venue without a snapshot. */
  fallbackText?: string;
  /** Legacy venue columns of the payload, used for the maps link when the snapshot lacks them. */
  venueName?: string | null;
  venueAddress?: string | null;
  venueLat?: number | null;
  venueLng?: number | null;
  venuePlaceId?: string | null;
  mapsApiKey?: string | null;
  eventId?: string;
  tournamentId?: string;
  isOrganiser?: boolean;
  /** List rows (tournament-registration AD-7): the full address shows under the venue name. */
  showAddress?: boolean;
}

const ICON_BOX = 32;
/** List rows (team-screens-remarks AD-6, TS-13): the address wraps up to this many lines before it is truncated. */
const ADDRESS_LINES = 3;

export default function VenueRow({
  snapshot,
  fallbackText,
  venueName,
  venueAddress,
  venueLat,
  venueLng,
  venuePlaceId,
  mapsApiKey,
  eventId,
  tournamentId,
  isOrganiser = false,
  showAddress = false,
}: VenueRowProps): React.JSX.Element {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const insets = useContext(SafeAreaInsetsContext);

  const name =
    snapshot?.name || venueName || fallbackText || t('mob.gv.venue_title');
  const address =
    snapshot?.address ||
    [snapshot?.block, snapshot?.street].filter(Boolean).join(' ') ||
    venueAddress ||
    '';
  const mapsUrl = buildGoogleMapsUrl({
    lat: snapshot?.lat ?? venueLat,
    lng: snapshot?.lng ?? venueLng,
    placeId: venuePlaceId,
    name,
    address,
  });

  const openMaps = (): void => {
    if (mapsUrl) {
      Linking.openURL(mapsUrl).catch(() => undefined);
    }
  };

  const copyAddress = (): void => {
    copyTextToClipboard(address || name);
    setNotice(t('mob.gv.address_copied'));
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('mob.gv.venue_title')}: ${name}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
        testID="venue-row"
      >
        <View style={styles.pinBox}>
          <PinIcon size={18} />
        </View>
        {showAddress && address ? (
          <View style={styles.nameColumn}>
            <Text style={styles.nameInColumn} numberOfLines={2}>
              {name}
            </Text>
            <Text style={styles.address} numberOfLines={ADDRESS_LINES} testID="venue-row-address">
              {address}
            </Text>
          </View>
        ) : (
          <Text style={styles.name} numberOfLines={2}>
            {name}
          </Text>
        )}
        <ChevronRightIcon size={18} color={colors.textMuted} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setOpen(false)}
            accessibilityRole="button"
            accessibilityLabel={t('mob.common.close')}
          />
          <View
            style={[
              styles.sheet,
              { paddingBottom: spacing.md + (insets?.bottom ?? 0) },
            ]}
            testID="venue-sheet"
          >
            <View style={styles.grabber} />
            <View style={styles.headerRow}>
              <Text style={styles.caption} accessibilityRole="header">
                {t('mob.gv.venue_title')}
              </Text>
              <Pressable
                onPress={() => setOpen(false)}
                style={styles.closeTarget}
                accessibilityRole="button"
                accessibilityLabel={t('mob.common.close')}
                testID="venue-sheet-close"
              >
                <CrossIcon size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
              <VenueDetailCard
                variant="sheet"
                snapshot={snapshot}
                fallbackText={fallbackText}
                courtDetails={null}
                mapsApiKey={mapsApiKey}
                eventId={eventId}
                tournamentId={tournamentId}
                isOrganiser={isOrganiser}
              />
            </ScrollView>
            <View style={styles.buttons}>
              <Pressable
                onPress={openMaps}
                disabled={!mapsUrl}
                style={[
                  styles.primaryButton,
                  !mapsUrl ? styles.disabled : null,
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('mob.gv.open_in_maps')}
                testID="venue-open-maps"
              >
                <Text style={styles.primaryText}>
                  {t('mob.gv.open_in_maps')}
                </Text>
              </Pressable>
              <Pressable
                onPress={copyAddress}
                style={styles.secondaryButton}
                accessibilityRole="button"
                accessibilityLabel={t('mob.gv.copy_address')}
                testID="venue-copy-address"
              >
                <Text style={styles.secondaryText}>
                  {t('mob.gv.copy_address')}
                </Text>
              </Pressable>
            </View>
          </View>
          <Toast message={notice} onDismiss={() => setNotice(null)} />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: sizes.touchTarget,
    paddingVertical: spacing.xs,
  },
  pressed: { opacity: 0.8 },
  pinBox: {
    width: ICON_BOX,
    height: ICON_BOX,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  name: {
    ...typography.bodyBold,
    color: colors.primary,
    flex: 1,
    marginRight: spacing.sm,
  },
  // minWidth 0: the column takes all the width right of the pin and wraps its text, so a long name or address is never pushed out or cut short.
  nameColumn: { flex: 1, minWidth: 0, marginRight: spacing.sm },
  nameInColumn: { ...typography.bodyBold, color: colors.primary },
  address: { ...typography.caption, color: colors.textSecondary },
  backdrop: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    maxHeight: '90%',
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  caption: {
    ...typography.label,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  closeTarget: {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flexGrow: 0 },
  buttons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  primaryButton: {
    flex: 1,
    minHeight: sizes.touchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.ctaBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { ...typography.bodyBold, color: colors.white },
  secondaryButton: {
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { ...typography.bodyBold, color: colors.textPrimary },
  disabled: { opacity: 0.5 },
});
