/**
 * Others Venue entry form (DES-MEETUP-ADDENDUM-VENUE-CATALOGUE §4, §5; task vc-m-others).
 * Minimal UI using existing tokens, chip components, and cards.
 * Validates:
 * - Name (required)
 * - Postal code (required, exactly 6 digits, validated on blur and save)
 * - Facility types (multi-select chips)
 * - Operating hours (optional)
 * - Information link (optional, http(s) only)
 */

import React, { useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { getPostalVenue } from '../../api/venues';
import Button from '../Button';
import { CrossIcon } from '../icons/ActionIcons';
import { colors, radius, spacing } from '../../theme/tokens';
import type { OthersVenueInput, VenueItem } from '../../types/venue';

interface OthersVenueModalProps {
  visible: boolean;
  onClose: () => void;
  onSaveOthers: (othersVenue: {
    othersInput: OthersVenueInput;
    venueItem: VenueItem;
    address?: string;
    lat?: number | null;
    lng?: number | null;
    geocoding_status: 'pending' | 'resolved' | 'failed';
  }) => void;
}

const COMMON_FACILITIES = [
  'Badminton Court',
  'Tennis Court',
  'Football Field',
  'Basketball Court',
  'Squash Court',
  'Swimming Pool',
  'Gym',
  'Table Tennis',
  'Futsal Court',
  'Volleyball Court',
];

export default function OthersVenueModal({
  visible,
  onClose,
  onSaveOthers,
}: OthersVenueModalProps): React.JSX.Element {
  const [name, setName] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [facilities, setFacilities] = useState<string[]>([]);
  const [operatingHours, setOperatingHours] = useState('');
  const [infoUrl, setInfoUrl] = useState('');

  const [nameError, setNameError] = useState<string | null>(null);
  const [postalError, setPostalError] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  const nameRef = useRef(name);
  nameRef.current = name;
  const postalCodeRef = useRef(postalCode);
  postalCodeRef.current = postalCode;
  const infoUrlRef = useRef(infoUrl);
  infoUrlRef.current = infoUrl;

  const validatePostal = (code: string): boolean => {
    const trimmed = code.trim();
    if (!trimmed) {
      setPostalError('Postal code is required');
      return false;
    }
    if (!/^\d{6}$/.test(trimmed)) {
      setPostalError('Postal code must be exactly 6 digits');
      return false;
    }
    setPostalError(null);
    return true;
  };

  const validateName = (val: string): boolean => {
    if (!val.trim()) {
      setNameError('Venue name is required');
      return false;
    }
    setNameError(null);
    return true;
  };

  const validateUrl = (url: string): boolean => {
    const trimmed = url.trim();
    if (!trimmed) {
      setUrlError(null);
      return true;
    }
    if (!/^https?:\/\//i.test(trimmed)) {
      setUrlError('URL must begin with http:// or https://');
      return false;
    }
    setUrlError(null);
    return true;
  };

  const toggleFacility = (facility: string) => {
    setFacilities(prev =>
      prev.includes(facility)
        ? prev.filter(f => f !== facility)
        : [...prev, facility],
    );
  };

  const handleSave = async () => {
    const isNameValid = validateName(name);
    const isPostalValid = validatePostal(postalCode);
    const isUrlValid = validateUrl(infoUrl);

    if (!isNameValid || !isPostalValid || !isUrlValid) {
      return;
    }

    setResolving(true);
    const trimmedPostal = postalCode.trim();
    const trimmedName = name.trim();

    try {
      const lookup = await getPostalVenue(trimmedPostal);
      const othersInput: OthersVenueInput = {
        name: trimmedName,
        postal_code: trimmedPostal,
        facilities: facilities.length > 0 ? facilities : undefined,
        operating_hours: operatingHours.trim() || undefined,
        info_url: infoUrl.trim() || undefined,
      };

      const resolvedAddress =
        lookup.address ||
        [lookup.block, lookup.street].filter(Boolean).join(' ') ||
        `Singapore ${trimmedPostal}`;

      const venueItem: VenueItem = {
        id: `others-${Date.now()}`,
        provider: 'user',
        provider_venue_key: `user:${trimmedPostal}:${trimmedName}`,
        name: trimmedName,
        block: lookup.block ?? null,
        street: lookup.street ?? null,
        postal_code: trimmedPostal,
        lat: lookup.lat ?? null,
        lng: lookup.lng ?? null,
        facilities: facilities.length > 0 ? facilities : null,
        operating_hours: operatingHours.trim() || null,
        info_url: infoUrl.trim() || null,
        booking_url: null,
        status: 'active',
        source: 'Others',
      };

      onSaveOthers({
        othersInput,
        venueItem,
        address: resolvedAddress,
        lat: lookup.lat ?? null,
        lng: lookup.lng ?? null,
        geocoding_status: lookup.geocoding_status || 'pending',
      });

      // Reset
      setName('');
      setPostalCode('');
      setFacilities([]);
      setOperatingHours('');
      setInfoUrl('');
      onClose();
    } catch {
      // Offline or network error: save as pending geocoding status
      const othersInput: OthersVenueInput = {
        name: trimmedName,
        postal_code: trimmedPostal,
        facilities: facilities.length > 0 ? facilities : undefined,
        operating_hours: operatingHours.trim() || undefined,
        info_url: infoUrl.trim() || undefined,
      };

      const venueItem: VenueItem = {
        id: `others-${Date.now()}`,
        provider: 'user',
        provider_venue_key: `user:${trimmedPostal}:${trimmedName}`,
        name: trimmedName,
        block: null,
        street: null,
        postal_code: trimmedPostal,
        lat: null,
        lng: null,
        facilities: facilities.length > 0 ? facilities : null,
        operating_hours: operatingHours.trim() || null,
        info_url: infoUrl.trim() || null,
        booking_url: null,
        status: 'active',
        source: 'Others',
      };

      onSaveOthers({
        othersInput,
        venueItem,
        address: `Singapore ${trimmedPostal}`,
        lat: null,
        lng: null,
        geocoding_status: 'pending',
      });
      onClose();
    } finally {
      setResolving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={styles.modalTitle}>Enter Other Venue</Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <CrossIcon size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={styles.scrollBody} keyboardShouldPersistTaps="handled">
            {/* Venue Name */}
            <Text style={styles.fieldLabel}>Venue name *</Text>
            <TextInput
              style={[styles.input, nameError && styles.inputError]}
              value={name}
              onChangeText={val => {
                nameRef.current = val;
                setName(val);
                if (nameError) validateName(val);
              }}
              onBlur={() => validateName(nameRef.current)}
              placeholder="e.g. Club House Hall"
              placeholderTextColor={colors.textMuted}
            />
            {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}

            {/* Postal Code */}
            <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>
              Postal code * (6 digits)
            </Text>
            <TextInput
              style={[styles.input, postalError && styles.inputError]}
              value={postalCode}
              onChangeText={val => {
                postalCodeRef.current = val;
                setPostalCode(val);
                if (postalError) validatePostal(val);
              }}
              onBlur={() => validatePostal(postalCodeRef.current)}
              placeholder="e.g. 579780"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={6}
            />
            {postalError ? (
              <Text style={styles.errorText}>{postalError}</Text>
            ) : null}

            {/* Facility Types Multi-select Chips */}
            <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>
              Facility types
            </Text>
            <View style={styles.chipsContainer}>
              {COMMON_FACILITIES.map(facility => {
                const isSelected = facilities.includes(facility);
                return (
                  <Pressable
                    key={facility}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => toggleFacility(facility)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        isSelected && styles.chipTextSelected,
                      ]}
                    >
                      {facility}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Operating Hours */}
            <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>
              Operating hours (optional)
            </Text>
            <TextInput
              style={styles.input}
              value={operatingHours}
              onChangeText={setOperatingHours}
              placeholder="e.g. Mon-Fri 08:00 - 22:00"
              placeholderTextColor={colors.textMuted}
            />

            {/* Info URL */}
            <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>
              Information link (optional)
            </Text>
            <TextInput
              style={[styles.input, urlError && styles.inputError]}
              value={infoUrl}
              onChangeText={val => {
                infoUrlRef.current = val;
                setInfoUrl(val);
                if (urlError) validateUrl(val);
              }}
              onBlur={() => validateUrl(infoUrlRef.current)}
              placeholder="https://example.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="url"
              autoCapitalize="none"
            />
            {urlError ? <Text style={styles.errorText}>{urlError}</Text> : null}

            <View style={styles.buttonRow}>
              <Button
                label={resolving ? 'Looking up...' : 'Save Venue'}
                onPress={handleSave}
                loading={resolving}
                disabled={resolving}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: 'center',
    padding: spacing.md,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    maxHeight: '85%',
    padding: spacing.md,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  scrollBody: {
    marginTop: spacing.sm,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    fontSize: 11,
    color: colors.error,
    marginTop: 2,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  buttonRow: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
});
