/**
 * Edit Match screen modal (DES-MEETUP-ADDENDUM-VENUE-CATALOGUE; matches boards FXEdit*).
 * Used by tournament organizer/committee to edit match date, start time, venue, and court.
 */

import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import VenuePicker, { type SelectedVenueState } from '../venue/VenuePicker';
import { BackArrowIcon } from '../icons/ActionIcons';
import { useT } from '../../labels/LabelsContext';
import { colors } from '../../theme/tokens';
import type { TournamentFixture } from '../../types/tournament';
import type { OthersVenueInput, VenueItem, VenueSnapshot } from '../../types/venue';

interface EditMatchModalProps {
  visible: boolean;
  onClose: () => void;
  fixture: TournamentFixture | null;
  sportId: string;
  sportDisplayName: string;
  venueCatalogueEnabled: boolean;
  defaultVenue?: SelectedVenueState | null;
  onSave: (updated: {
    scheduled_at?: string;
    court: string;
    venue_id?: string | null;
    venue_snapshot?: VenueSnapshot | null;
    others?: OthersVenueInput;
  }) => void;
}

export default function EditMatchModal({
  visible,
  onClose,
  fixture,
  sportId,
  sportDisplayName,
  venueCatalogueEnabled,
  defaultVenue,
  onSave,
}: EditMatchModalProps): React.JSX.Element {
  const t = useT();
  const [dateText, setDateText] = useState('Sat 14 Nov');
  const [timeText, setTimeText] = useState('9:45 AM');
  const [court, setCourt] = useState('Court 1');
  const [courtError, setCourtError] = useState<string | null>(null);

  const [selectedVenue, setSelectedVenue] = useState<SelectedVenueState | null>(
    defaultVenue ?? {
      venueId: null,
      name: 'Punggol Sports Hall',
      source: 'Others',
      isOthers: true,
    },
  );

  if (!fixture) {
    return <></>;
  }

  const matchTitle = `${fixture.home_team || 'Home'} vs ${fixture.away_team || 'Away'}`;
  const roundLabel = fixture.round || 'Round of 32';

  const handleCourtChange = (val: string) => {
    setCourt(val);
    if (val.trim().toLowerCase() === 'court 2') {
      // Demonstrates court clash warning from FXEditCourt.html
      setCourtError('Court 2 is already used at Sat 9:45 AM. Pick another court or time.');
    } else {
      setCourtError(null);
    }
  };

  const handleSave = () => {
    if (courtError) {
      return;
    }
    onSave({
      court,
      venue_id: selectedVenue?.venueId ?? null,
      venue_snapshot: selectedVenue?.snapshot ?? null,
      others: selectedVenue?.othersInput,
    });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <View style={styles.container}>
        {/* Blue Header matching FXEdit board */}
        <View style={styles.header}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.backButton}
          >
            <BackArrowIcon size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Edit match</Text>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {/* Match Card */}
          <View style={styles.card}>
            <Text style={styles.matchTitle}>{matchTitle}</Text>
            <Text style={styles.roundText}>{roundLabel}</Text>

            {/* Date Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Date</Text>
              <TextInput
                style={styles.input}
                value={dateText}
                onChangeText={setDateText}
                placeholder="Date"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* Start Time Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Start time</Text>
              <TextInput
                style={styles.input}
                value={timeText}
                onChangeText={setTimeText}
                placeholder="Start time"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* Venue Field */}
            {venueCatalogueEnabled ? (
              <VenuePicker
                sportId={sportId}
                sportDisplayName={sportDisplayName}
                selectedVenue={selectedVenue}
                variant="tournament"
                helperText="Change only if the tournament uses another venue."
                onSelectVenue={(v: VenueItem) => {
                  setSelectedVenue({
                    venueId: v.id,
                    name: v.name,
                    address: [v.block, v.street].filter(Boolean).join(' ') || v.street || '',
                    lat: v.lat,
                    lng: v.lng,
                    source: v.source || t('venue.source.catalogue'),
                    isOthers: false,
                  });
                }}
                onSaveOthersVenue={others => {
                  setSelectedVenue({
                    venueId: null,
                    name: others.othersInput.name,
                    address: others.address,
                    lat: others.lat,
                    lng: others.lng,
                    source: 'Others',
                    isOthers: true,
                    geocoding_status: others.geocoding_status,
                    othersInput: others.othersInput,
                  });
                }}
                onClearVenue={() => setSelectedVenue(null)}
              />
            ) : (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Venue</Text>
                <TextInput
                  style={styles.input}
                  value={selectedVenue?.name ?? ''}
                  onChangeText={val =>
                    setSelectedVenue({
                      venueId: null,
                      name: val,
                      source: 'Others',
                      isOthers: true,
                    })
                  }
                  placeholder="Venue"
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={styles.helperText}>
                  Change only if the tournament uses another venue.
                </Text>
              </View>
            )}

            {/* Court Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Court</Text>
              <TextInput
                style={[styles.input, courtError ? styles.inputError : null]}
                value={court}
                onChangeText={handleCourtChange}
                placeholder="Court"
                placeholderTextColor={colors.textMuted}
              />
              {courtError ? (
                <Text style={styles.courtErrorText}>{courtError}</Text>
              ) : null}
            </View>
          </View>
        </ScrollView>

        {/* Bottom Save Bar */}
        <View style={styles.footer}>
          <Pressable
            style={[styles.saveButton, courtError ? styles.saveButtonDisabled : null]}
            onPress={handleSave}
            disabled={Boolean(courtError)}
            accessibilityRole="button"
            accessibilityLabel="Save match"
          >
            <Text style={styles.saveButtonText}>Save</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F6FC',
  },
  header: {
    backgroundColor: '#1F5FE0',
    paddingTop: 10,
    paddingBottom: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontWeight: '800',
    fontSize: 18,
    color: '#FFFFFF',
    flex: 1,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E3EAF7',
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  matchTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F2347',
  },
  roundText: {
    fontSize: 12,
    color: '#566684',
    marginTop: -6,
    marginBottom: 4,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#566684',
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: '#CBD7EE',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#0F2347',
    backgroundColor: '#FFFFFF',
  },
  inputError: {
    borderColor: '#E5484D',
    borderWidth: 1.5,
  },
  courtErrorText: {
    fontSize: 12,
    color: '#B4232A',
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    color: '#566684',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E3EAF7',
  },
  saveButton: {
    height: 50,
    borderRadius: 14,
    backgroundColor: '#1F5FE0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#C9D3E8',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
