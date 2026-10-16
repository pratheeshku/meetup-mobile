/**
 * Venue Picker component for Create game and Edit game (DES-MEETUP-ADDENDUM-VENUE-CATALOGUE).
 * Matches visual boards: Game3When, EditGame2.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { getVenues } from '../../api/venues';
import { SearchIcon, CrossIcon } from '../icons/ActionIcons';
import {
  VenueChevronDownIcon,
  VenuePinBadgeIcon,
  VenuePlusIcon,
} from './VenueIcons';
import OthersVenueModal from './OthersVenueModal';
import { useT } from '../../labels/LabelsContext';
import { colors, radius, spacing } from '../../theme/tokens';
import type { OthersVenueInput, VenueItem, VenueSnapshot } from '../../types/venue';

export interface SelectedVenueState {
  venueId?: string | null;
  name: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  source?: string;
  isOthers?: boolean;
  geocoding_status?: 'pending' | 'resolved' | 'failed' | null;
  snapshot?: VenueSnapshot | null;
  othersInput?: OthersVenueInput;
}

interface VenuePickerProps {
  sportId: string;
  sportDisplayName: string;
  selectedVenue: SelectedVenueState | null;
  onSelectVenue: (venue: VenueItem) => void;
  onSelectOthers?: () => void;
  onSaveOthersVenue?: (othersVenue: {
    othersInput: OthersVenueInput;
    venueItem: VenueItem;
    address?: string;
    lat?: number | null;
    lng?: number | null;
    geocoding_status: 'pending' | 'resolved' | 'failed';
  }) => void;
  onClearVenue?: () => void;
  mapsApiKey?: string | null;
  variant?: 'standard' | 'tournament';
  helperText?: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function VenuePicker({
  sportId,
  sportDisplayName,
  selectedVenue,
  onSelectVenue,
  onSelectOthers,
  onSaveOthersVenue,
  onClearVenue,
  mapsApiKey,
  variant = 'standard',
  helperText,
}: VenuePickerProps): React.JSX.Element {
  const t = useT();
  const [isOpen, setIsOpen] = useState(!selectedVenue || !selectedVenue.name);
  const [isOthersModalOpen, setIsOthersModalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [venues, setVenues] = useState<VenueItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sportChangeNotice, setSportChangeNotice] = useState<string | null>(null);

  const [loadError, setLoadError] = useState<string | null>(null);

  const prevSportRef = useRef(sportId);

  // When sport changes after catalogue venue was selected, clear venue (Others survives)
  useEffect(() => {
    if (prevSportRef.current && prevSportRef.current !== sportId) {
      if (selectedVenue && !selectedVenue.isOthers) {
        onClearVenue?.();
        setIsOpen(true);
        setSportChangeNotice(t('venue.reselect_prompt'));
      }
    }
    prevSportRef.current = sportId;
  }, [sportId, selectedVenue, onClearVenue, t]);

  const sportIdValid = UUID_PATTERN.test(sportId);

  const fetchVenues = useCallback(
    async (searchText: string, cursor?: string, isAppend = false) => {
      setLoadError(null);
      if (!UUID_PATTERN.test(sportId)) {
        setVenues([]);
        setNextCursor(null);
        return;
      }
      if (!isAppend) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      try {
        const res = await getVenues({
          sport_id: sportId,
          q: searchText,
          cursor,
        });
        if (isAppend) {
          setVenues(prev => [...prev, ...res.items]);
        } else {
          setVenues(res.items);
        }
        setNextCursor(res.next_cursor ?? null);
      } catch {
        if (!isAppend) {
          setVenues([]);
        }
        setLoadError('Unable to load venues. Please try again.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [sportId],
  );

  useEffect(() => {
    if (isOpen) {
      fetchVenues(query);
    }
  }, [isOpen, sportId, query, fetchVenues]);

  const handleSelect = (item: VenueItem) => {
    setSportChangeNotice(null);
    onSelectVenue(item);
    setIsOpen(false);
  };

  const handleOpenPicker = () => {
    setSportChangeNotice(null);
    setIsOpen(true);
  };

  const handlePressOthers = () => {
    onSelectOthers?.();
    setIsOthersModalOpen(true);
  };

  const handleSaveOthers = (res: {
    othersInput: OthersVenueInput;
    venueItem: VenueItem;
    address?: string;
    lat?: number | null;
    lng?: number | null;
    geocoding_status: 'pending' | 'resolved' | 'failed';
  }) => {
    if (onSaveOthersVenue) {
      onSaveOthersVenue(res);
    } else {
      onSelectVenue(res.venueItem);
    }
    setIsOpen(false);
  };

  const handleLoadMore = () => {
    if (nextCursor && !loading && !loadingMore) {
      fetchVenues(query, nextCursor, true);
    }
  };

  const catalogueSourceLabel = t('venue.source.catalogue');
  const userSourceLabel = t('venue.source.user');

  return (
    <View style={styles.container}>
      <Text style={styles.fieldLabel}>{t('mob.create_game.venue_label')}</Text>

      {sportChangeNotice ? (
        <Text style={styles.noticeText}>{sportChangeNotice}</Text>
      ) : null}

      {!isOpen && selectedVenue && selectedVenue.name ? (
        variant === 'tournament' ? (
          /* Tournament Selected State (TournSched & FXEdit boards: 46px compact field) */
          <View style={styles.tournamentSelectedWrapper}>
            <Pressable
              style={styles.tournamentSelectedBox}
              onPress={handleOpenPicker}
              accessibilityRole="button"
              accessibilityLabel={`${selectedVenue.name}, ${selectedVenue.address || ''}`}
            >
              <Text style={styles.tournamentVenueName} numberOfLines={1}>
                {selectedVenue.name}
              </Text>
              <View style={styles.sourceTag}>
                <Text style={styles.sourceTagText}>
                  {selectedVenue.isOthers ? userSourceLabel : catalogueSourceLabel}
                </Text>
              </View>
              <VenueChevronDownIcon size={16} color={colors.venueOthersIcon} />
            </Pressable>
            {helperText ? (
              <Text style={styles.helperText}>{helperText}</Text>
            ) : null}
          </View>
        ) : (
          /* Standard Selected State (EditGame2 board with Map Card) */
          <View style={styles.selectedWrapper}>
            <Pressable
              style={styles.selectedBox}
              onPress={handleOpenPicker}
              accessibilityRole="button"
              accessibilityLabel={`${selectedVenue.name}, ${selectedVenue.address || ''}`}
            >
              <View style={styles.selectedInfo}>
                <Text style={styles.selectedName} numberOfLines={1}>
                  {selectedVenue.name}
                </Text>
                {selectedVenue.address ? (
                  <Text style={styles.selectedAddress} numberOfLines={1}>
                    {selectedVenue.address}
                  </Text>
                ) : null}
              </View>
              <View style={styles.sourceTag}>
                <Text style={styles.sourceTagText}>
                  {selectedVenue.isOthers ? userSourceLabel : catalogueSourceLabel}
                </Text>
              </View>
              <VenueChevronDownIcon size={16} color={colors.venueOthersIcon} />
            </Pressable>

            {/* Map Card */}
            {selectedVenue.lat != null && selectedVenue.lng != null ? (
              <View style={styles.mapCard}>
                {mapsApiKey ? (
                  <Image
                    style={styles.mapImage}
                    source={{
                      uri: `https://maps.googleapis.com/maps/api/staticmap?center=${selectedVenue.lat},${selectedVenue.lng}&zoom=15&size=600x300&markers=color:red%7C${selectedVenue.lat},${selectedVenue.lng}&key=${mapsApiKey}`,
                    }}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.mapPattern}>
                    <View style={styles.mapPatternPatch1} />
                    <View style={styles.mapPatternPatch2} />
                    <View style={styles.mapPatternRoadH} />
                    <View style={styles.mapPatternRoadV} />
                    <View style={styles.mapPinPlacement}>
                      <VenuePinBadgeIcon size={28} color={colors.venuePinIcon} />
                    </View>
                  </View>
                )}
                <View style={styles.pinCaptionBox}>
                  <Text style={styles.pinCaptionText}>{t('venue.pin_caption')}</Text>
                </View>
              </View>
            ) : selectedVenue.geocoding_status === 'pending' ? (
              <View style={styles.pendingGeocodeBox}>
                <Text style={styles.pendingGeocodeText}>
                  {t('venue.address_lookup_pending')}
                </Text>
              </View>
            ) : null}
          </View>
        )
      ) : (
        /* Open / Search State (Game3When board) */
        <View style={styles.searchWrapper}>
          <View style={styles.searchBox}>
            <SearchIcon size={18} color={colors.primary} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder={t('venue.search_placeholder')}
              placeholderTextColor={colors.textMuted}
              autoFocus={!selectedVenue?.name}
            />
            {query ? (
              <Pressable
                onPress={() => setQuery('')}
                accessibilityRole="button"
                accessibilityLabel={t('venue.clear_search')}
              >
                <CrossIcon size={16} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>

          <Text style={styles.showingText}>
            {t('venue.showing_for_sport', { sport: sportDisplayName })}
          </Text>

          <View style={styles.listContainer}>
            {!sportIdValid ? (
              <View style={styles.loadingBox}>
                <Text style={styles.errorText}>{t('venue.choose_sport_first')}</Text>
              </View>
            ) : loadError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{loadError}</Text>
                <Pressable
                  style={styles.retryButton}
                  onPress={() => fetchVenues(query)}
                  accessibilityRole="button"
                  accessibilityLabel={t('venue.retry_loading_venues')}
                >
                  <Text style={styles.retryButtonText}>{t('venue.retry')}</Text>
                </Pressable>
              </View>
            ) : loading && venues.length === 0 ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : (
              <FlatList
                data={venues}
                keyExtractor={item => item.id}
                scrollEnabled={venues.length > 4}
                style={styles.flatList}
                renderItem={({ item }) => {
                  const address = [item.block, item.street]
                    .filter(Boolean)
                    .join(' ') || item.street || '';
                  return (
                    <Pressable
                      style={styles.venueRow}
                      onPress={() => handleSelect(item)}
                      accessibilityRole="button"
                      accessibilityLabel={item.name}
                    >
                      <View style={styles.pinBadge}>
                        <VenuePinBadgeIcon size={18} color={colors.venuePinIcon} />
                      </View>
                      <View style={styles.venueRowContent}>
                        <Text style={styles.venueRowName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        {address ? (
                          <Text style={styles.venueRowAddress} numberOfLines={1}>
                            {address}
                          </Text>
                        ) : null}
                      </View>
                      <View style={styles.sourceTag}>
                        <Text style={styles.sourceTagText}>
                          {catalogueSourceLabel}
                        </Text>
                      </View>
                    </Pressable>
                  );
                }}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={
                  <>
                    {loadingMore ? (
                      <View style={styles.loadingMoreBox}>
                        <ActivityIndicator size="small" color={colors.primary} />
                      </View>
                    ) : null}
                    {/* Last row is ALWAYS Others */}
                    <Pressable
                      style={styles.othersRow}
                      onPress={handlePressOthers}
                      accessibilityRole="button"
                      accessibilityLabel={t('venue.source.user')}
                    >
                      <View style={styles.othersIconBadge}>
                        <VenuePlusIcon size={18} color={colors.venueOthersIcon} />
                      </View>
                      <View style={styles.venueRowContent}>
                        <Text style={styles.venueRowName}>{userSourceLabel}</Text>
                        <Text style={styles.venueRowAddress}>
                          {t('venue.not_listed_subtitle')}
                        </Text>
                      </View>
                    </Pressable>
                  </>
                }
              />
            )}
          </View>
        </View>
      )}

      <OthersVenueModal
        visible={isOthersModalOpen}
        onClose={() => setIsOthersModalOpen(false)}
        onSaveOthers={handleSaveOthers}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  noticeText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.warning,
    marginBottom: 6,
  },
  selectedWrapper: {
    gap: 12,
  },
  tournamentSelectedWrapper: {
    gap: 6,
  },
  tournamentSelectedBox: {
    height: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
  },
  tournamentVenueName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  helperText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  selectedBox: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.surface,
  },
  selectedInfo: {
    flex: 1,
    minWidth: 0,
  },
  selectedName: {
    fontWeight: '700',
    fontSize: 14.5,
    color: colors.textPrimary,
  },
  selectedAddress: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sourceTag: {
    backgroundColor: colors.venueTagBg,
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  sourceTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.venueTagText,
  },
  mapCard: {
    height: 150,
    borderRadius: 14,
    backgroundColor: '#E9EFF6',
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.venueCardBorder,
  },
  mapImage: {
    width: '100%',
    height: '100%',
  },
  mapPattern: {
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: '#E9EFF6',
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
  mapPatternRoadH: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 62,
    height: 12,
    backgroundColor: colors.white,
  },
  mapPatternRoadV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 120,
    width: 10,
    backgroundColor: colors.white,
  },
  mapPinPlacement: {
    position: 'absolute',
    left: 115,
    top: 40,
  },
  pinCaptionBox: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    backgroundColor: colors.mapCaptionBg,
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  pinCaptionText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.mapCaptionText,
  },
  pendingGeocodeBox: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.venueOthersBg,
    borderWidth: 1,
    borderColor: colors.venueCardBorder,
  },
  pendingGeocodeText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  searchWrapper: {
    gap: 6,
  },
  searchBox: {
    height: 50,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  showingText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  listContainer: {
    borderWidth: 1,
    borderColor: colors.venueCardBorder,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    maxHeight: 280,
  },
  flatList: {
    flexGrow: 0,
  },
  loadingBox: {
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingMoreBox: {
    padding: spacing.sm,
    alignItems: 'center',
  },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.venueRowDivider,
  },
  pinBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.venuePinBg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  venueRowContent: {
    flex: 1,
    minWidth: 0,
  },
  venueRowName: {
    fontWeight: '700',
    fontSize: 14.5,
    color: colors.textPrimary,
  },
  venueRowAddress: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  othersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.venueOthersBg,
  },
  othersIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.venueOthersIconBg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  errorBox: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    color: colors.error,
    textAlign: 'center',
  },
  retryButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  retryButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
