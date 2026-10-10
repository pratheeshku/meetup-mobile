/**
 * Create Game Wizard (DES-MEETUP-MOBILE.md §4.3 Create Flow Amendment;
 * design-ref-p23/Game1Type.png .. Game6InviteOnly.png, Game5Error.png).
 */
import React, { useEffect, useState } from 'react';
import {
  Image,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Geolocation from '@react-native-community/geolocation';

import { getClientConfig, getGameLimits, type GameLimits } from '../api/config';
import { withCorrelationId } from '../api/correlationId';
import { createEvent } from '../api/events';
import { getMyGroups } from '../api/groups';
import {
  fetchPlaceDetails,
  fetchPlacePredictions,
  reverseGeocodeCoordinates,
  type PlacePrediction,
} from '../api/places';
import { getSports } from '../api/sports';
import { createTournament } from '../api/tournaments';
import { searchUsers } from '../api/users';
import Button from '../components/Button';
import IconBadge from '../components/IconBadge';
import {
  CheckIcon,
  CrossIcon,
  SearchIcon,
} from '../components/icons/ActionIcons';
import { SportIcon } from '../components/icons/DashboardIcons';
import InlineError from '../components/InlineError';
import { sportPalette } from '../sports/style';
import {
  CalendarIcon,
  ClockIcon,
  GlobeIcon,
  LockIcon,
  PeopleIcon,
  PinIcon,
  TargetIcon,
  TrophyIcon,
} from '../components/icons/SharedIcons';
import NumberField from '../components/NumberField';
import SelectableCard from '../components/SelectableCard';
import WizardFooter from '../components/WizardFooter';
import WizardHeader from '../components/WizardHeader';
import { useT } from '../labels/LabelsContext';
import { goToDashboard } from '../navigation/goToDashboard';
import type { AppTabParamList, HomeStackParamList } from '../navigation/types';
import {
  borderWidth,
  colors,
  radius,
  spacing,
  typography,
} from '../theme/tokens';
import type { CreateEventInput, EventSkillLevel, EventVisibility } from '../types/event';
import type { Group } from '../types/group';
import type { Sport } from '../types/sport';
import type {
  CreateTournamentInput,
  TournamentFormat,
  TournamentParticipationMode,
  TournamentVisibility,
} from '../types/tournament';
import type { UserSearchResult } from '../types/user';
import { getApiErrorMessage } from '../utils/apiError';

type Props = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, 'CreateGame'>,
  BottomTabScreenProps<AppTabParamList, 'Home'>
>;

type GameKind = 'game' | 'tournament';

const AVATAR_TINTS = [
  { bg: colors.avatarTint1, text: colors.avatarTintText1 },
  { bg: colors.avatarTint2, text: colors.avatarTintText2 },
  { bg: colors.avatarTint3, text: colors.avatarTintText3 },
  { bg: colors.avatarTint4, text: colors.avatarTintText4 },
  { bg: colors.avatarTint5, text: colors.avatarTintText5 },
];

function getAvatarTint(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return AVATAR_TINTS[Math.abs(hash) % AVATAR_TINTS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  }
  return (name.trim().slice(0, 2) || '?').toUpperCase();
}

export default function CreateGameScreen({ navigation }: Props): React.JSX.Element {
  const t = useT();

  // Wizard state
  const [step, setStep] = useState<number>(1);
  const [mode, setMode] = useState<GameKind>('game');

  // Config and limits
  const [gameLimits, setGameLimits] = useState<GameLimits>({ players_min: 2, players_max: 100 });
  const [mapsApiKey, setMapsApiKey] = useState<string | null>(null);

  // Sports and groups
  const [sports, setSports] = useState<Sport[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  // Step 2: Sport & Title
  const [gSport, setGSport] = useState<string>('');
  const [sportsError, setSportsError] = useState(false);
  const [gTitle, setGTitle] = useState<string>('Sunday Doubles');

  // Step 3: When & Where
  const [dateValue, setDateValue] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(19, 30, 0, 0);
    return d;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [venueQuery, setVenueQuery] = useState('Community Hall');
  const [venuePredictions, setVenuePredictions] = useState<PlacePrediction[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<{
    name: string;
    address: string;
    place_id?: string | null;
    lat?: number | null;
    lng?: number | null;
  }>({
    name: 'Community Hall',
    address: 'Punggol, Singapore',
    place_id: null,
    lat: null,
    lng: null,
  });
  const [courtDetails, setCourtDetails] = useState('Court 2');

  // Step 4: Who can play
  const [gVisibility, setGVisibility] = useState<EventVisibility>('group');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Step 5: Capacity & Skill
  const [capacity, setCapacity] = useState<number>(4);
  const [isCapacityValid, setIsCapacityValid] = useState<boolean>(true);
  const [skillLevel, setSkillLevel] = useState<EventSkillLevel>('intermediate');

  // Step 6: Invites & Review
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');
  const [playerSuggestions, setPlayerSuggestions] = useState<UserSearchResult[]>([]);
  const [invitedPlayers, setInvitedPlayers] = useState<UserSearchResult[]>([]);

  // Submission & errors
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tournament specific state
  const tFormat: TournamentFormat = 'knockout';
  const tParticipation: TournamentParticipationMode = 'individual';

  useEffect(() => {
    getGameLimits().then(setGameLimits).catch(() => {});
    getClientConfig().then(cfg => setMapsApiKey(cfg.google_maps_api_key)).catch(() => {});
    getSports()
      .then(list => {
        setSports(list);
        setSportsError(false);
        setGSport(current => current || list[0]?.name || '');
      })
      .catch(() => setSportsError(true));
    getMyGroups().then(res => {
      setGroups(res.items);
      if (res.items.length > 0) {
        setSelectedGroupId(res.items[0].id);
      }
    }).catch(() => {});
    searchUsers({ q: '' }).then(setPlayerSuggestions).catch(() => {});
  }, []);

  const handleVenueSearch = async (text: string) => {
    setVenueQuery(text);
    if (!text.trim()) {
      setVenuePredictions([]);
      return;
    }
    const preds = await fetchPlacePredictions(text, mapsApiKey);
    setVenuePredictions(preds);
  };

  const handleSelectPrediction = async (p: PlacePrediction) => {
    const venueName = p.main_text ?? p.description;
    const venueAddress = p.secondary_text ?? p.description;
    setSelectedVenue({
      name: venueName,
      address: venueAddress,
      place_id: p.place_id,
      lat: null,
      lng: null,
    });
    setVenueQuery(venueName);
    setVenuePredictions([]);

    if (p.place_id && mapsApiKey) {
      const details = await fetchPlaceDetails(p.place_id, mapsApiKey);
      if (details) {
        setSelectedVenue(prev => ({
          ...prev,
          name: details.name || venueName,
          address: details.formatted_address || venueAddress,
          place_id: details.place_id,
          lat: details.lat,
          lng: details.lng,
        }));
      }
    }
  };

  const handleUseCurrentLocation = async () => {
    setError(null);
    if (!mapsApiKey) {
      setError(t('mob.create_game.err_location_failed'));
      return;
    }

    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: t('mob.create_game.permission_rationale_title'),
            message: t('mob.create_game.permission_rationale_msg'),
            buttonPositive: t('mob.notification_action.ok'),
            buttonNegative: t('mob.common.cancel'),
          },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          setError(t('mob.create_game.err_location_permission'));
          return;
        }
      } catch {
        setError(t('mob.create_game.err_location_permission'));
        return;
      }
    }

    Geolocation.getCurrentPosition(
      async pos => {
        const details = await reverseGeocodeCoordinates(
          pos.coords.latitude,
          pos.coords.longitude,
          mapsApiKey,
        );
        if (details) {
          setSelectedVenue({
            name: details.name,
            address: details.formatted_address,
            place_id: details.place_id,
            lat: details.lat,
            lng: details.lng,
          });
          setVenueQuery(details.name);
          setVenuePredictions([]);
        } else {
          setError(t('mob.create_game.err_location_failed'));
        }
      },
      () => {
        setError(t('mob.create_game.err_location_failed'));
      },
      {
        timeout: 10000,
        enableHighAccuracy: false,
      },
    );
  };

  const handlePlayerSearch = async (text: string) => {
    setPlayerSearchQuery(text);
    try {
      const results = await searchUsers({ q: text });
      setPlayerSuggestions(results);
    } catch {}
  };

  const toggleInvitePlayer = (user: UserSearchResult) => {
    setInvitedPlayers(prev => {
      if (prev.some(u => u.id === user.id)) {
        return prev.filter(u => u.id !== user.id);
      }
      return [...prev, user];
    });
  };

  const handleDateChange = (_e: DateTimePickerEvent, selected?: Date) => {
    setShowDatePicker(false);
    if (selected) {
      const newD = new Date(dateValue);
      newD.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      setDateValue(newD);
    }
  };

  const handleTimeChange = (_e: DateTimePickerEvent, selected?: Date) => {
    setShowTimePicker(false);
    if (selected) {
      const newD = new Date(dateValue);
      newD.setHours(selected.getHours(), selected.getMinutes());
      setDateValue(newD);
    }
  };

  const handleNext = () => {
    setError(null);
    if (step === 1) {
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!gTitle.trim()) {
        setError(t('mob.create_game.err_game_title'));
        return;
      }
      setStep(3);
      return;
    }
    if (step === 3) {
      setStep(4);
      return;
    }
    if (step === 4) {
      setStep(5);
      return;
    }
    if (step === 5) {
      if (!isCapacityValid || capacity < gameLimits.players_min) {
        return;
      }
      setStep(6);
      return;
    }
  };

  const handleBack = () => {
    setError(null);
    if (step > 1) {
      setStep(step - 1);
    } else {
      navigation.goBack();
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const startsAtIso = dateValue.toISOString();
      const fullVenueName = courtDetails.trim()
        ? `${selectedVenue.name}, ${courtDetails.trim()}`
        : selectedVenue.name;

      if (mode === 'game') {
        if (gVisibility === 'invite_only' && invitedPlayers.length < 1) {
          setError(t('mob.create_game.step_invite_required'));
          setIsSubmitting(false);
          return;
        }

        const input: CreateEventInput = {
          title: gTitle.trim(),
          sport: gSport,
          visibility: gVisibility,
          ...(gVisibility === 'group' && selectedGroupId ? { group_ids: [selectedGroupId] } : {}),
          ...(gVisibility === 'invite_only'
            ? { invite_user_ids: invitedPlayers.map(p => p.id) }
            : {}),
          skill_level_requirement: skillLevel,
          capacity: capacity,
          starts_at: startsAtIso,
          ends_at: null,
          venue_name: fullVenueName,
          venue_address: selectedVenue.address,
          ...(mapsApiKey && selectedVenue.place_id
            ? {
                venue_place_id: selectedVenue.place_id,
                venue_lat: selectedVenue.lat,
                venue_lng: selectedVenue.lng,
              }
            : {}),
        };

        await withCorrelationId(async correlationId => {
          await createEvent(input, { correlationId });
        });
        goToDashboard(t('mob.success.game_created'));
      } else {
        const input: CreateTournamentInput = {
          title: gTitle.trim(),
          sport: gSport,
          visibility: (gVisibility === 'invite_only' ? 'invite' : gVisibility) as TournamentVisibility,
          ...(gVisibility === 'group' && selectedGroupId ? { group_id: selectedGroupId } : {}),
          participation_mode: tParticipation,
          format: tFormat,
          capacity: capacity,
          starts_at: dateValue.toISOString().slice(0, 10),
          venue_name: fullVenueName,
        };

        await withCorrelationId(async correlationId => {
          await createTournament(input, { correlationId });
        });
        goToDashboard(t('mob.success.tournament_created'));
      }
    } catch (e) {
      setError(getApiErrorMessage(e, t('mob.create_game.err_game_create')));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 1: What are you creating?
  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepHeading}>{t('mob.create_game.step_what')}</Text>

      <SelectableCard
        selected={mode === 'game'}
        onPress={() => setMode('game')}
        title={t('mob.create_game.step_type_game_title')}
        subtitle={t('mob.create_game.step_type_game_desc')}
        leading={
          <IconBadge color="green" size={48}>
            <PeopleIcon size={24} />
          </IconBadge>
        }
      />

      <SelectableCard
        selected={mode === 'tournament'}
        onPress={() => setMode('tournament')}
        title={t('mob.create_game.step_type_tournament_title')}
        subtitle={t('mob.create_game.step_type_tournament_desc')}
        leading={
          <IconBadge color="amber" size={48}>
            <TrophyIcon size={24} />
          </IconBadge>
        }
      />
    </View>
  );

  // Step 2: Pick a sport
  const reloadSports = (): void => {
    setSportsError(false);
    getSports()
      .then(list => {
        setSports(list);
        setSportsError(false);
        setGSport(current => current || list[0]?.name || '');
      })
      .catch(() => setSportsError(true));
  };

  const renderStep2 = () => {
    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepHeading}>{t('mob.create_game.step_sport')}</Text>

        <View style={styles.sportsGrid}>
          {sports.map(item => {
            const isSelected = gSport === item.name;
            const palette = sportPalette(item.color);
            return (
              <TouchableOpacity
                key={item.name}
                style={[styles.sportTile, isSelected && { borderColor: palette.tint, backgroundColor: palette.chip }]}
                onPress={() => {
                  setGSport(item.name);
                  if (gTitle === 'Sunday Doubles' || gTitle.includes('Game')) {
                    setGTitle(`${item.display_name} Game`);
                  }
                }}
              >
                <View style={[styles.sportIconCircle, { backgroundColor: isSelected ? palette.tint : palette.chip }]}>
                  <SportIcon iconKey={item.icon_key} size={36} />
                </View>
                <Text style={styles.sportTileText}>{item.display_name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.cardContainer}>
          <Text style={styles.inputCardLabel}>{t('mob.create_game.game_title_label')}</Text>
          <TextInput
            style={styles.cardTextInput}
            value={gTitle}
            onChangeText={setGTitle}
            placeholder={t('mob.create_game.title_placeholder')}
            placeholderTextColor={colors.textMuted}
          />
        </View>
      </View>
    );
  };

  // Step 3: When and where?
  const renderStep3 = () => {
    const formattedDate = dateValue.toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    const formattedTime = dateValue.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepHeading}>{t('mob.create_game.step_when_where')}</Text>

        <View style={styles.cardContainer}>
          <View style={styles.row}>
            <TouchableOpacity
              style={styles.halfField}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.fieldLabel}>{t('mob.create_game.date_label')}</Text>
              <View style={styles.pickerBox}>
                <CalendarIcon size={18} />
                <Text style={styles.pickerBoxText}>{formattedDate}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.halfField}
              onPress={() => setShowTimePicker(true)}
            >
              <Text style={styles.fieldLabel}>{t('mob.create_game.start_time_label')}</Text>
              <View style={styles.pickerBox}>
                <ClockIcon size={18} />
                <Text style={styles.pickerBoxText}>{formattedTime}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={dateValue}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
            />
          )}

          {showTimePicker && (
            <DateTimePicker
              value={dateValue}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleTimeChange}
            />
          )}

          <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>
            {t('mob.create_game.venue_label')}
          </Text>
          <View style={styles.searchBox}>
            <SearchIcon size={18} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={venueQuery}
              onChangeText={handleVenueSearch}
              placeholder={t('mob.create_game.venue_search_placeholder')}
              placeholderTextColor={colors.textMuted}
            />
            {venueQuery ? (
              <TouchableOpacity onPress={() => handleVenueSearch('')}>
                <CrossIcon size={16} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          {venuePredictions.length > 0 ? (
            <View style={styles.predictionsList}>
              {venuePredictions.map(p => (
                <TouchableOpacity
                  key={p.place_id}
                  style={styles.predictionRow}
                  onPress={() => handleSelectPrediction(p)}
                >
                  <Text style={styles.predictionMain}>{p.main_text}</Text>
                  {p.secondary_text ? (
                    <Text style={styles.predictionSecondary}>{p.secondary_text}</Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.currentLocationRow}
            onPress={handleUseCurrentLocation}
          >
            <TargetIcon size={18} />
            <Text style={styles.currentLocationText}>
              {t('mob.create_game.use_current_location')}
            </Text>
          </TouchableOpacity>

          {mapsApiKey && selectedVenue.lat != null && selectedVenue.lng != null ? (
            <View style={styles.mapPreviewBox}>
              <Image
                style={styles.mapImage}
                source={{
                  uri: `https://maps.googleapis.com/maps/api/staticmap?center=${selectedVenue.lat},${selectedVenue.lng}&zoom=15&size=600x300&markers=color:red%7C${selectedVenue.lat},${selectedVenue.lng}&key=${mapsApiKey}`,
                }}
                resizeMode="cover"
              />
            </View>
          ) : null}

          {/* Selected Location Row */}
          <View style={styles.selectedLocationRow}>
            <View style={styles.pinBadge}>
              <PinIcon size={20} />
            </View>
            <View style={styles.locationTextContainer}>
              <Text style={styles.locationName}>{selectedVenue.name}</Text>
              <Text style={styles.locationAddress}>{selectedVenue.address}</Text>
            </View>
          </View>

          <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>
            {t('mob.create_game.court_details_label')}
          </Text>
          <TextInput
            style={styles.courtInput}
            value={courtDetails}
            onChangeText={setCourtDetails}
            placeholder={t('mob.create_game.court_details_placeholder')}
            placeholderTextColor={colors.textMuted}
          />
        </View>
      </View>
    );
  };

  // Step 4: Who can play?
  const renderStep4 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepHeading}>{t('mob.create_game.step_who')}</Text>

      <SelectableCard
        selected={gVisibility === 'public'}
        onPress={() => setGVisibility('public')}
        title={t('mob.create_game.public_title')}
        subtitle={t('mob.create_game.public_desc')}
        leading={
          <IconBadge color="green" size={48}>
            <GlobeIcon size={24} />
          </IconBadge>
        }
      />

      <SelectableCard
        selected={gVisibility === 'invite_only'}
        onPress={() => setGVisibility('invite_only')}
        title={t('mob.create_game.invite_only_title')}
        subtitle={t('mob.create_game.invite_only_desc')}
        leading={
          <IconBadge color="orange" size={48}>
            <LockIcon size={24} />
          </IconBadge>
        }
      />

      <Text style={styles.sectionHeading}>{t('mob.create_game.share_group_section')}</Text>

      {groups.map(grp => {
        const isSelected = gVisibility === 'group' && selectedGroupId === grp.id;
        const tint = getAvatarTint(grp.name);
        return (
          <TouchableOpacity
            key={grp.id}
            style={[styles.groupCard, isSelected && styles.groupCardSelected]}
            onPress={() => {
              setGVisibility('group');
              setSelectedGroupId(grp.id);
            }}
          >
            <View style={[styles.groupAvatar, { backgroundColor: tint.bg }]}>
              <Text style={[styles.groupAvatarText, { color: tint.text }]}>
                {getInitials(grp.name)}
              </Text>
            </View>

            <View style={styles.groupInfo}>
              <Text style={styles.groupName}>{grp.name}</Text>
              <Text style={styles.groupMembers}>
                {t('mob.create_game.group_members_count', { count: grp.member_count ?? 0 })}
              </Text>
            </View>

            <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
              {isSelected ? <CheckIcon size={14} color={colors.white} /> : null}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // Step 5: Players and skill level
  const renderStep5 = () => {
    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepHeading}>{t('mob.create_game.step_players_skill')}</Text>

        <View style={styles.cardContainer}>
          <Text style={styles.inputCardLabel}>{t('mob.create_game.players_needed')}</Text>
          <NumberField
            value={capacity}
            onChangeValue={(val, valid) => {
              if (val !== null) setCapacity(val);
              setIsCapacityValid(valid);
            }}
            min={gameLimits.players_min}
            max={gameLimits.players_max}
            showStepper
          />
        </View>

        <View style={[styles.cardContainer, { marginTop: spacing.lg }]}>
          <Text style={styles.inputCardLabel}>{t('mob.create_game.skill_level_label')}</Text>
          <View style={styles.skillPillRow}>
            {(['beginner', 'intermediate', 'expert'] as EventSkillLevel[]).map(lvl => {
              const isSelected = skillLevel === lvl;
              const label =
                lvl === 'beginner'
                  ? 'Beginner'
                  : lvl === 'intermediate'
                  ? 'Intermediate'
                  : 'Advanced';
              return (
                <TouchableOpacity
                  key={lvl}
                  style={[styles.skillPill, isSelected && styles.skillPillSelected]}
                  onPress={() => setSkillLevel(lvl)}
                >
                  <Text
                    style={[styles.skillPillText, isSelected && styles.skillPillTextSelected]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  // Step 6: Review & Invite
  const renderStep6 = () => {
    const isInviteOnly = gVisibility === 'invite_only';
    const formattedDate = dateValue.toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    const formattedTime = dateValue.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    const selectedGroup = groups.find(g => g.id === selectedGroupId);

    return (
      <View style={styles.stepContent}>
        <View style={styles.stepHeaderRow}>
          <Text style={styles.stepHeading}>
            {isInviteOnly ? (
              <>
                {t('mob.create_game.who_invited')}{' '}
                <Text style={styles.requiredSubtitle}>{t('mob.create_game.at_least_one')}</Text>
              </>
            ) : (
              <>
                {t('mob.create_game.invite_players')}{' '}
                <Text style={styles.optionalSubtitle}>{t('mob.create_game.optional_parentheses')}</Text>
              </>
            )}
          </Text>
        </View>

        <View style={styles.searchBox}>
          <SearchIcon size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={playerSearchQuery}
            onChangeText={handlePlayerSearch}
            placeholder={t('mob.create_game.search_players_placeholder')}
            placeholderTextColor={colors.textMuted}
          />
        </View>

        {playerSuggestions.length > 0 ? (
          <View style={[styles.cardContainer, styles.playerSuggestionsCard]}>
            {playerSuggestions.slice(0, 4).map((user, idx) => {
              const isInvited = invitedPlayers.some(u => u.id === user.id);
              const tint = getAvatarTint(user.display_name);
              const isLast = idx === Math.min(playerSuggestions.length, 4) - 1;
              return (
                <View
                  key={user.id}
                  style={[styles.playerRow, !isLast && styles.playerRowBorder]}
                >
                  <View style={[styles.avatarCircle, { backgroundColor: tint.bg }]}>
                    <Text style={[styles.avatarText, { color: tint.text }]}>
                      {getInitials(user.display_name)}
                    </Text>
                  </View>

                  <Text style={styles.playerName}>{user.display_name}</Text>

                  <TouchableOpacity
                    style={[styles.inviteToggleBtn, isInvited && styles.inviteToggleBtnActive]}
                    onPress={() => toggleInvitePlayer(user)}
                  >
                    {isInvited ? (
                      <CheckIcon size={16} color={colors.white} />
                    ) : (
                      <Text style={styles.inviteTogglePlus}>+</Text>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Review Card */}
        <View style={[styles.cardContainer, { marginTop: spacing.lg }]}>
          <Text style={styles.reviewHeaderTitle}>{t('mob.create_game.review_header')}</Text>

          <View style={styles.reviewMainRow}>
            <View style={styles.reviewSportBadge}>
              <SportIcon iconKey={sports.find(item => item.name === gSport)?.icon_key} size={28} />
            </View>
            <View style={styles.reviewMainText}>
              <Text style={styles.reviewGameTitle}>{gTitle}</Text>
              <Text style={styles.reviewGameSubtitle}>
                {gSport.charAt(0).toUpperCase() + gSport.slice(1)} ·{' '}
                {skillLevel.charAt(0).toUpperCase() + skillLevel.slice(1)}
              </Text>
            </View>
          </View>

          <View style={styles.reviewDetailRow}>
            <View style={[styles.reviewIconCircle, { backgroundColor: colors.primary }]}>
              <ClockIcon size={16} />
            </View>
            <Text style={styles.reviewDetailText}>
              {formattedDate}, {formattedTime}
            </Text>
          </View>

          <View style={styles.reviewDetailRow}>
            <View style={[styles.reviewIconCircle, { backgroundColor: colors.accent }]}>
              <PinIcon size={16} />
            </View>
            <Text style={styles.reviewDetailText}>
              {selectedVenue.name}
              {courtDetails.trim() ? `, ${courtDetails.trim()}` : ''}
            </Text>
          </View>

          <View style={styles.reviewDetailRow}>
            <View style={[styles.reviewIconCircle, { backgroundColor: colors.success }]}>
              <PeopleIcon size={16} />
            </View>
            <Text style={styles.reviewDetailText}>
              {gVisibility === 'group' && selectedGroup
                ? t('mob.create_game.review_players_group', { count: capacity, group: selectedGroup.name })
                : isInviteOnly
                ? t('mob.create_game.review_players_invite', { count: capacity, invited: invitedPlayers.length })
                : t('mob.create_game.review_players_public', { count: capacity })}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const isStep5Disabled = step === 5 && (!isCapacityValid || capacity < gameLimits.players_min);
  const isStep6Disabled = step === 6 && gVisibility === 'invite_only' && invitedPlayers.length < 1;

  return (
    <View style={styles.screen}>
      <WizardHeader
        title={step === 1 ? t('mob.create_game.wizard_title_create') : t('mob.create_game.wizard_title_create_game')}
        currentStep={step}
        totalSteps={6}
        onBack={step > 1 ? handleBack : undefined}
        onClose={step === 1 ? handleBack : undefined}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {sportsError ? (
          <InlineError message={t('mob.common.sports_load_error')} onRetry={reloadSports} />
        ) : null}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
        {step === 5 && renderStep5()}
        {step === 6 && renderStep6()}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>

      {step === 6 ? (
        <View style={styles.footerContainer}>
          <Button
            label={t('mob.create_game.submit_game')}
            variant="cta"
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={isStep6Disabled || isSubmitting}
          />
        </View>
      ) : (
        <WizardFooter
          nextLabel={t('mob.wizard.next')}
          onNext={handleNext}
          nextDisabled={isStep5Disabled}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  stepContent: {
    flex: 1,
  },
  stepHeading: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  stepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.lg,
  },
  optionalSubtitle: {
    ...typography.body,
    color: colors.textMuted,
  },
  requiredSubtitle: {
    ...typography.body,
    color: colors.accent,
  },
  sectionHeading: {
    ...typography.label,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    letterSpacing: 0.5,
  },
  sportsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  sportTile: {
    width: '30%',
    aspectRatio: 0.95,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
  },
  sportTileSelected: {
    borderColor: colors.primary,
    borderWidth: borderWidth.thick,
  },
  sportIconCircle: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  sportTileText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  cardContainer: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    padding: spacing.md,
  },
  inputCardLabel: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  cardTextInput: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfField: {
    flex: 1,
  },
  fieldLabel: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  pickerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    minHeight: 44,
  },
  pickerBoxText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: borderWidth.thick,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 48,
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  predictionsList: {
    marginTop: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  predictionRow: {
    padding: spacing.sm,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: colors.border,
  },
  predictionMain: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  predictionSecondary: {
    ...typography.caption,
    color: colors.textMuted,
  },
  currentLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.md,
  },
  currentLocationText: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  mapPreviewBox: {
    height: 140,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  mapImage: {
    width: '100%',
    height: '100%',
  },
  selectedLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  pinBadge: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationTextContainer: {
    flex: 1,
  },
  locationName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  locationAddress: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  courtInput: {
    ...typography.body,
    color: colors.textPrimary,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  groupCardSelected: {
    borderColor: colors.primary,
    borderWidth: borderWidth.thick,
  },
  groupAvatar: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupAvatarText: {
    ...typography.bodyBold,
  },
  groupInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  groupName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  groupMembers: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  radioCircle: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    borderWidth: borderWidth.thick,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  skillPillRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  skillPill: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skillPillSelected: {
    backgroundColor: colors.primary,
  },
  skillPillText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  skillPillTextSelected: {
    color: colors.white,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  playerRowBorder: {
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: colors.border,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.bodyBold,
  },
  playerName: {
    flex: 1,
    marginLeft: spacing.md,
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  inviteToggleBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteToggleBtnActive: {
    backgroundColor: colors.primary,
  },
  inviteTogglePlus: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 20,
  },
  reviewHeaderTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  reviewMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  reviewSportBadge: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  reviewMainText: {
    flex: 1,
  },
  reviewGameTitle: {
    ...typography.bodyBold,
    fontSize: 17,
    color: colors.textPrimary,
  },
  reviewGameSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  reviewDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  reviewIconCircle: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewDetailText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  footerContainer: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: borderWidth.thin,
    borderTopColor: colors.border,
  },
  playerSuggestionsCard: {
    marginTop: spacing.md,
    padding: 0,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
