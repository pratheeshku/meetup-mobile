/**
 * VenueDetailCard component for GameDetail and TournamentDetail.
 * Matches visual board: GameDetail.html (DES-MEETUP-ADDENDUM-VENUE-CATALOGUE).
 *
 * Implements:
 * - vc-m-detail: Reads venue from venue_snapshot (name, address, map pin when coordinates exist,
 *   information link when present, listed hours). Fallback to legacy venue text when snapshot missing.
 *   Shows "Venue photos" strip (display only, no attribution, signed fresh URLs).
 * - vc-m-photos: Organizer / committee "Add venue photos" entry, ownership confirmation statement,
 *   JPEG/PNG/WebP validation, server rejection display, viewer Report action, and organizer Delete.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  deleteVenueImage,
  getVenue,
  reportVenueImage,
  uploadGameVenueImage,
  uploadTournamentVenueImage,
} from '../../api/venues';
import { CrossIcon } from '../icons/ActionIcons';
import { PinIcon } from '../icons/SharedIcons';
import { VenuePinBadgeIcon, VenuePlusIcon } from './VenueIcons';
import { logMapFailureOnce } from './logMapFailure';
import { useT } from '../../labels/LabelsContext';
import { colors, spacing, typography } from '../../theme/tokens';
import {
  VENUE_ORGANIZER_PHOTOS_ENABLED,
  type VenueImage,
  type VenueSnapshot,
} from '../../types/venue';

export { VENUE_ORGANIZER_PHOTOS_ENABLED };

interface VenueDetailCardProps {
  snapshot?: VenueSnapshot | null;
  fallbackText?: string;
  courtDetails?: string | null;
  mapsApiKey?: string | null;
  eventId?: string;
  tournamentId?: string;
  venueId?: string | null;
  isOrganiser?: boolean;
  /**
   * `sheet` (game-view-redesign GV-2): the card is hosted in the venue bottom sheet, so the name
   * and address are the sheet's heading instead of a boxed row. Data and photo behaviour are the same.
   */
  variant?: 'card' | 'sheet';
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function VenueDetailCard({
  snapshot,
  fallbackText,
  courtDetails,
  mapsApiKey,
  eventId,
  tournamentId,
  venueId,
  isOrganiser = false,
  variant = 'card',
}: VenueDetailCardProps): React.JSX.Element {
  const t = useT();
  const [photos, setPhotos] = useState<VenueImage[]>([]);
  const [failedMapUri, setFailedMapUri] = useState<string | null>(null);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<VenueImage | null>(null);

  // Upload state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadUrl, setUploadUrl] = useState('');
  const [uploadType] = useState('image/jpeg');
  const [acceptedStatement, setAcceptedStatement] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Report state
  const [reportedMessage, setReportedMessage] = useState<string | null>(null);

  const [photoLoadError, setPhotoLoadError] = useState<string | null>(null);

  // Load photos (fresh signed URLs on each load, never cached)
  const loadPhotos = useCallback(async () => {
    if (venueId) {
      setLoadingPhotos(true);
      setPhotoLoadError(null);
      try {
        const res = await getVenue(venueId);
        if (res.images) {
          setPhotos(res.images);
        }
      } catch {
        setPhotoLoadError('Unable to load photos');
      } finally {
        setLoadingPhotos(false);
      }
    }
  }, [venueId]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  const venueName = snapshot?.name || fallbackText || 'Venue';
  const venueAddress =
    snapshot?.address ||
    [snapshot?.block, snapshot?.street].filter(Boolean).join(' ') ||
    '';
  const fullDisplayName = courtDetails
    ? `${venueName}, ${courtDetails}`
    : venueName;

  const handleOpenLink = async (url: string) => {
    try {
      if (/^https?:\/\//i.test(url)) {
        await Linking.openURL(url);
      }
    } catch {
      // Ignore URL open errors
    }
  };

  const handleUpload = async () => {
    setUploadError(null);
    if (!uploadUrl.trim()) {
      setUploadError('Please provide an image URL');
      return;
    }
    if (!ACCEPTED_TYPES.includes(uploadType)) {
      setUploadError('Only JPEG, PNG, and WebP images are accepted');
      return;
    }
    if (!acceptedStatement) {
      setUploadError('You must confirm ownership before uploading');
      return;
    }

    setUploading(true);
    try {
      const file = {
        uri: uploadUrl.trim(),
        type: uploadType,
        name: `photo-${Date.now()}.${uploadType.split('/')[1] || 'jpg'}`,
      };
      let newImage: VenueImage;
      if (eventId) {
        newImage = await uploadGameVenueImage(eventId, file, true);
      } else if (tournamentId) {
        newImage = await uploadTournamentVenueImage(tournamentId, file, true);
      } else {
        throw new Error('No target event or tournament');
      }

      // Prepend organizer's own photo
      setPhotos(prev => [newImage, ...prev]);
      setIsUploadModalOpen(false);
      setUploadUrl('');
      setAcceptedStatement(false);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Server rejected the image. Please check size and format.';
      setUploadError(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async (photo: VenueImage) => {
    try {
      await deleteVenueImage(photo.id);
      setPhotos(prev => prev.filter(p => p.id !== photo.id));
      setSelectedPhoto(null);
    } catch {
      Alert.alert(t('venue.error'), t('venue.photo_delete_failed'));
    }
  };

  const handleReportPhoto = async (photo: VenueImage) => {
    try {
      await reportVenueImage(photo.id, 'Reported by user');
      setReportedMessage('Photo reported. Our moderation team will review it.');
    } catch {
      Alert.alert(t('venue.error'), t('venue.photo_report_failed'));
    }
  };
  // URL format and key handling unchanged; the key must never be logged.
  const staticMapUri = `https://maps.googleapis.com/maps/api/staticmap?center=${snapshot?.lat},${snapshot?.lng}&zoom=15&size=600x300&markers=color:red%7C${snapshot?.lat},${snapshot?.lng}&key=${mapsApiKey}`;

  return (
    <View style={styles.cardContainer}>
      {/* Venue Info Row (matching GameDetail board) */}
      <View style={variant === 'sheet' ? styles.sheetInfoRow : styles.venueRow}>
        {variant === 'sheet' ? null : (
          <View style={styles.pinIconBox}>
            <PinIcon size={16} />
          </View>
        )}
        <View style={styles.venueInfo}>
          <Text style={variant === 'sheet' ? styles.sheetTitle : styles.venueTitle}>{fullDisplayName}</Text>
          {venueAddress ? (
            <Text style={variant === 'sheet' ? styles.sheetAddress : styles.venueAddress}>{venueAddress}</Text>
          ) : null}
          {snapshot?.operating_hours ? (
            <Text style={styles.listedHoursText}>
              {t('venue.listed_hours')}{' '}
              {typeof snapshot.operating_hours === 'string'
                ? snapshot.operating_hours
                : JSON.stringify(snapshot.operating_hours)}
            </Text>
          ) : null}
          {snapshot?.info_url ? (
            <Pressable
              onPress={() => handleOpenLink(snapshot.info_url!)}
              accessibilityRole="link"
            >
              <Text style={styles.linkText}>{t('venue.more_information')}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Map Card if Coordinates exist */}
      {snapshot?.lat != null && snapshot?.lng != null ? (
        <View style={styles.mapCard}>
          {mapsApiKey && failedMapUri !== staticMapUri ? (
            <Image
              style={styles.mapImage}
              source={{ uri: staticMapUri }}
              resizeMode="cover"
              onError={() => {
                logMapFailureOnce();
                setFailedMapUri(staticMapUri);
              }}
            />
          ) : (
            <View style={styles.mapPattern} testID="venue-map-placeholder">
              <View style={styles.mapPatternPatch1} />
              <View style={styles.mapPatternPatch2} />
              <View style={styles.mapPinPlacement}>
                <VenuePinBadgeIcon size={28} color={colors.venuePinIcon} />
              </View>
            </View>
          )}
          <View style={styles.pinCaptionBox}>
            <Text style={styles.pinCaptionText}>{t('venue.pin_caption')}</Text>
          </View>
        </View>
      ) : null}

      {/* Venue Photos Strip (GameDetail.html) */}
      {(photos.length > 0 || (VENUE_ORGANIZER_PHOTOS_ENABLED && isOrganiser)) && (
        <View style={styles.photosCard}>
          <View style={styles.photosHeader}>
            <Text style={styles.photosTitle}>{t('venue.photos_title')}</Text>
            {venueAddress ? (
              <Text style={styles.photosSubtitle}>{venueAddress}</Text>
            ) : null}
          </View>

          {photoLoadError ? (
            <View style={styles.photoErrorBox}>
              <Text style={styles.photoErrorText}>{photoLoadError}</Text>
              <Pressable
                style={styles.photoRetryBtn}
                onPress={loadPhotos}
                accessibilityRole="button"
                accessibilityLabel={t('venue.retry_loading_photos')}
              >
                <Text style={styles.photoRetryText}>{t('venue.retry')}</Text>
              </Pressable>
            </View>
          ) : loadingPhotos ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : photos.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photoStrip}
            >
              {photos.map(photo => (
                <Pressable
                  key={photo.id}
                  style={styles.photoThumb}
                  onPress={() => {
                    setReportedMessage(null);
                    setSelectedPhoto(photo);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('venue.view_photo')}
                >
                  <Image
                    source={{ uri: photo.url }}
                    style={styles.photoImage}
                    resizeMode="cover"
                  />
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.noPhotosText}>{t('venue.no_photos')}</Text>
          )}

          {/* Organizer Add Photos entry point (vc-m-photos) */}
          {VENUE_ORGANIZER_PHOTOS_ENABLED && isOrganiser ? (
            <Pressable
              style={styles.addPhotosRow}
              onPress={() => setIsUploadModalOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t('venue.add_photos')}
            >
              <VenuePlusIcon size={16} color={colors.primary} />
              <Text style={styles.addPhotosText}>{t('venue.add_photos')}</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      {/* Photo Viewer Modal with Report & Delete */}
      <Modal
        visible={Boolean(selectedPhoto)}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedPhoto(null)}
      >
        <View style={styles.photoModalBackdrop}>
          <View style={styles.photoModalContent}>
            <Pressable
              style={styles.modalCloseButton}
              onPress={() => setSelectedPhoto(null)}
              accessibilityRole="button"
              accessibilityLabel={t('venue.close')}
            >
              <CrossIcon size={22} color="#FFFFFF" />
            </Pressable>

            {selectedPhoto ? (
              <Image
                source={{ uri: selectedPhoto.url }}
                style={styles.fullImage}
                resizeMode="contain"
              />
            ) : null}

            {reportedMessage ? (
              <View style={styles.reportSuccessBox}>
                <Text style={styles.reportSuccessText}>{reportedMessage}</Text>
              </View>
            ) : (
              <View style={styles.photoActionsRow}>
                {VENUE_ORGANIZER_PHOTOS_ENABLED && selectedPhoto ? (
                  <Pressable
                    style={styles.reportButton}
                    onPress={() => handleReportPhoto(selectedPhoto)}
                    accessibilityRole="button"
                    accessibilityLabel={t('venue.report_photo')}
                  >
                    <Text style={styles.reportButtonText}>{t('venue.report')}</Text>
                  </Pressable>
                ) : null}

                {VENUE_ORGANIZER_PHOTOS_ENABLED && isOrganiser && selectedPhoto ? (
                  <Pressable
                    style={styles.deletePhotoButton}
                    onPress={() => handleDeletePhoto(selectedPhoto)}
                    accessibilityRole="button"
                    accessibilityLabel={t('venue.delete_photo')}
                  >
                    <Text style={styles.deletePhotoText}>{t('venue.delete')}</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Upload Photo Modal */}
      <Modal
        visible={VENUE_ORGANIZER_PHOTOS_ENABLED && isUploadModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsUploadModalOpen(false)}
      >
        <View style={styles.uploadModalBackdrop}>
          <View style={styles.uploadModalCard}>
            <View style={styles.uploadModalHeader}>
              <Text style={styles.uploadModalTitle}>{t('venue.add_photo_title')}</Text>
              <Pressable
                onPress={() => setIsUploadModalOpen(false)}
                accessibilityRole="button"
                accessibilityLabel={t('venue.close')}
              >
                <CrossIcon size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <Text style={styles.inputLabel}>{t('venue.image_url_label')}</Text>
            <TextInput
              style={styles.textInput}
              value={uploadUrl}
              onChangeText={setUploadUrl}
              placeholder="https://example.com/venue.jpg"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="url"
            />

            {/* Ownership confirmation statement */}
            <Pressable
              style={styles.ownershipRow}
              onPress={() => setAcceptedStatement(prev => !prev)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: acceptedStatement }}
            >
              <View
                style={[
                  styles.checkbox,
                  acceptedStatement && styles.checkboxChecked,
                ]}
              >
                {acceptedStatement ? <Text style={styles.checkMark}>✓</Text> : null}
              </View>
              <Text style={styles.ownershipText}>
                {t('venue.ownership_statement')}
              </Text>
            </Pressable>

            {uploadError ? (
              <Text style={styles.uploadErrorText}>{uploadError}</Text>
            ) : null}

            <View style={styles.uploadButtonRow}>
              <Pressable
                style={[
                  styles.uploadConfirmButton,
                  (!acceptedStatement || uploading) && styles.uploadButtonDisabled,
                ]}
                onPress={handleUpload}
                disabled={!acceptedStatement || uploading}
                accessibilityRole="button"
                accessibilityLabel={t('venue.confirm_upload')}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.uploadConfirmText}>{t('venue.upload_photo')}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    gap: 12,
  },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E3EAF7',
    borderRadius: 18,
    padding: 14,
  },
  pinIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#E5484D',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  venueInfo: {
    flex: 1,
  },
  sheetInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sheetTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  sheetAddress: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  venueTitle: {
    fontSize: 14.5,
    fontWeight: '600',
    color: '#0F2347',
  },
  venueAddress: {
    fontSize: 12,
    color: '#566684',
    marginTop: 2,
  },
  listedHoursText: {
    fontSize: 12,
    color: '#566684',
    marginTop: 2,
  },
  linkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F5FE0',
    marginTop: 4,
  },
  mapCard: {
    height: 150,
    borderRadius: 14,
    backgroundColor: '#E9EFF6',
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D6E0EF',
  },
  mapImage: {
    width: '100%',
    height: '100%',
  },
  mapPattern: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E9EFF6',
    position: 'relative',
  },
  mapPatternPatch1: {
    position: 'absolute',
    left: -20,
    top: 70,
    width: 200,
    height: 90,
    borderRadius: 30,
    backgroundColor: '#D5ECD9',
  },
  mapPatternPatch2: {
    position: 'absolute',
    right: -30,
    top: -20,
    width: 150,
    height: 70,
    borderRadius: 30,
    backgroundColor: '#CFE4F7',
  },
  mapPinPlacement: {
    position: 'absolute',
    left: '50%',
    top: '30%',
    marginLeft: -14,
  },
  pinCaptionBox: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pinCaptionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#33426A',
  },
  photosCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E3EAF7',
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  photosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  photosTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F2347',
    flex: 1,
  },
  photosSubtitle: {
    fontSize: 12,
    color: '#566684',
  },
  photoStrip: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  photoThumb: {
    width: 96,
    height: 72,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#E9EFF6',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  noPhotosText: {
    fontSize: 13,
    color: '#566684',
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  addPhotosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 4,
  },
  addPhotosText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F5FE0',
  },
  photoModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  photoModalContent: {
    width: '100%',
    maxHeight: '80%',
    alignItems: 'center',
    gap: 16,
  },
  modalCloseButton: {
    alignSelf: 'flex-end',
    padding: 8,
  },
  fullImage: {
    width: '100%',
    height: 320,
    borderRadius: 12,
  },
  photoActionsRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  reportButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  reportButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  deletePhotoButton: {
    backgroundColor: '#E5484D',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  deletePhotoText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  reportSuccessBox: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  reportSuccessText: {
    color: '#0F2347',
    fontSize: 13,
    fontWeight: '600',
  },
  uploadModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  uploadModalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    gap: 12,
  },
  uploadModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  uploadModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F2347',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#566684',
  },
  textInput: {
    height: 44,
    borderWidth: 1,
    borderColor: '#CBD7EE',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#0F2347',
  },
  ownershipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    borderColor: '#CBD7EE',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#1F5FE0',
    borderColor: '#1F5FE0',
  },
  checkMark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  ownershipText: {
    flex: 1,
    fontSize: 12,
    color: '#0F2347',
    lineHeight: 16,
  },
  uploadErrorText: {
    fontSize: 12,
    color: '#E5484D',
    fontWeight: '500',
  },
  uploadButtonRow: {
    marginTop: 6,
  },
  uploadConfirmButton: {
    height: 46,
    borderRadius: 12,
    backgroundColor: '#1F5FE0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadButtonDisabled: {
    backgroundColor: '#CBD7EE',
  },
  uploadConfirmText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  photoErrorBox: {
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  photoErrorText: {
    fontSize: 12,
    color: colors.error,
  },
  photoRetryBtn: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  photoRetryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
