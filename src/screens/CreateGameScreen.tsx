/**
 * Create Game Wizard (DES-MEETUP-MOBILE.md §4.3 Create Flow Amendment;
 * design-ref-p23/Game1Type.png .. Game6InviteOnly.png, Game5Error.png).
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Geolocation from '@react-native-community/geolocation';

import { getClientConfig, getGameLimits, type GameLimits } from '../api/config';
import { withCorrelationId } from '../api/correlationId';
import { createEvent, inviteEmailToEvent } from '../api/events';
import GameFeeFields, { parseGameFee, type GameFeeConfig } from '../components/GameFeeFields';
import { getMyGroups } from '../api/groups';
import {
  fetchPlaceDetails,
  fetchPlacePredictions,
  reverseGeocodeCoordinates,
  type PlacePrediction,
} from '../api/places';
import { getSports } from '../api/sports';
import { createTournament, getWizardTemplates } from '../api/tournaments';
import { listableTemplates } from '../utils/tournamentWizard';
import VenuePicker, { type SelectedVenueState } from '../components/venue/VenuePicker';
import Button from '../components/Button';
import { iosPickerThemeProps } from '../components/iosPickerTheme';
import AddRemoveControl from '../components/AddRemoveControl';
import UserMenuSheet from '../components/user/UserMenuSheet';
import UserPressable from '../components/user/UserPressable';
import { useUserMenu } from '../hooks/useUserMenu';
import GroupMultiSelect from '../components/GroupMultiSelect';
import GroupNamesRow from '../components/GroupNamesRow';
import DropdownField from '../components/DropdownField';
import IconBadge from '../components/IconBadge';
import {
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
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import NumberField from '../components/NumberField';
import SelectableCard from '../components/SelectableCard';
import WizardFooter from '../components/WizardFooter';
import WizardHeader from '../components/WizardHeader';
import RepeatWeeklyControl from '../components/RepeatWeeklyControl';
import { INITIAL_REPEAT, repeatFields, repeatProblem, type RepeatState } from '../utils/repeatWeekly';
import { formatSeriesDate } from '../utils/seriesDisplay';
import { useT } from '../labels/LabelsContext';
import { getAvatarTint } from '../utils/avatarTint';
import { maxGroupsFor, sortByLastActivity } from '../utils/gameGroups';
import SkillRequirementPicker from '../components/SkillRequirementPicker';
import {
  DEFAULT_SKILL_REQUIREMENT,
  skillRequirementLabelKey,
} from '../utils/skillRequirement';
import { showCompletion } from '../navigation/showCompletion';
import type { CompletionRow } from '../navigation/showCompletion';
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
import { refusalText } from '../utils/refusal';
import UserSearchPicker from '../components/UserSearchPicker';
import UserAvatar from '../components/UserAvatar';
import PersonNames from '../components/PersonNames';
import { addInviteEmail } from '../utils/inviteEmails';
import { formatEventDate, formatEventTimeRange } from '../utils/formatEventDateTime';
import {
  computeEndsAtIso,
  DEFAULT_GAME_DURATION_HOURS,
  GAME_DURATION_HOURS,
} from '../utils/gameDuration';

type Props = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, 'CreateGame'>,
  BottomTabScreenProps<AppTabParamList, 'Home'>
>;

type GameKind = 'game' | 'tournament';

/**
 * Games put Date, Start time and Duration in one row. Below this width, or with a large
 * system font, the row uses the short date ("17 Oct") with no decorative icons so labels
 * and values never wrap or truncate (checked for 360dp / 375pt at font scale 1.3).
 */
export const DATE_ROW_COMPACT_MAX_WIDTH = 420;
export const DATE_ROW_COMPACT_FONT_SCALE = 1.15;
export function isCompactDateRow(width: number, fontScale: number): boolean {
  return width < DATE_ROW_COMPACT_MAX_WIDTH || fontScale > DATE_ROW_COMPACT_FONT_SCALE;
}

export default function CreateGameScreen({ navigation }: Props): React.JSX.Element {
  const t = useT();
  const { width: windowWidth, fontScale } = useWindowDimensions();

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
  const [durationHours, setDurationHours] = useState<number>(DEFAULT_GAME_DURATION_HOURS);
  // Repeat weekly (AD-8): new games only; the screen needs exactly one end rule, the server enforces the limits.
  const [repeat, setRepeat] = useState<RepeatState>(INITIAL_REPEAT);
  const [repeatError, setRepeatError] = useState<string | null>(null);
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
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const maxGroups = maxGroupsFor(gameLimits);
  // A tournament has one group: keep the first when switching over from a multi-group game.
  useEffect(() => {
    if (mode === 'tournament') {
      setSelectedGroupIds(ids => (ids.length > 1 ? ids.slice(0, 1) : ids));
    }
  }, [mode]);
  /** "Group A" for one group, "Group A +2 more" for several. */
  const summariseGroupNames = (names: string[]): string =>
    names.length <= 1
      ? names[0] ?? ''
      : t('mob.create_game.groups_more', { first: names[0], count: names.length - 1 });

  // Step 5: Capacity & Skill
  const [capacity, setCapacity] = useState<number>(4);
  const [isCapacityValid, setIsCapacityValid] = useState<boolean>(true);
  const [skillLevel, setSkillLevel] = useState<EventSkillLevel>(DEFAULT_SKILL_REQUIREMENT);
  // Game fee (teams-payments AD-8): null while the client-config switch is off, and then nothing about a fee is shown or sent.
  const [gameFee, setGameFee] = useState<GameFeeConfig | null>(null);
  const [feeText, setFeeText] = useState('');
  const [payeeNumber, setPayeeNumber] = useState<string | null>(null);
  const [payeeError, setPayeeError] = useState<string | null>(null);

  // Step 6: Invites & Review
  const [invitedPlayers, setInvitedPlayers] = useState<UserSearchResult[]>([]);
  const [invitedEmails, setInvitedEmails] = useState<string[]>([]);

  // Submission & errors
  const [isSubmitting, setIsSubmitting] = useState(false);
  // An invitee chosen here is in no context of the viewer's yet: View Details only, no card request.
  const candidateMenu = useUserMenu({ context: { type: 'none' } });
  const [error, setError] = useState<string | null>(null);

  // Tournament specific state
  const tFormat: TournamentFormat = 'knockout';
  const tParticipation: TournamentParticipationMode = 'individual';

  // Venue catalogue state
  const [venueCatalogueEnabled, setVenueCatalogueEnabled] = useState(false);
  const [catalogueVenue, setCatalogueVenue] = useState<SelectedVenueState | null>(null);

  useEffect(() => {
    getGameLimits().then(setGameLimits).catch(() => {});
    getClientConfig().then(cfg => {
      setMapsApiKey(cfg.google_maps_api_key);
      setVenueCatalogueEnabled(Boolean(cfg.venue_catalogue_enabled));
      setGameFee(cfg.game_fee_enabled ? { currency: cfg.game_fee_currency, maxCents: cfg.game_fee_max_cents } : null);
    }).catch(() => {});
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
        setSelectedGroupIds([sortByLastActivity(res.items)[0].id]);
      } else {
        // No group to share with: start on Public rather than a group game that cannot be created.
        setGVisibility(current => (current === 'group' ? 'public' : current));
      }
    }).catch(() => {});
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

  // Added through the shared UserSearchPicker (one search field for people and emails).
  const addInvitedPlayer = (user: UserSearchResult) => {
    setInvitedPlayers(prev => (prev.some(u => u.id === user.id) ? prev : [...prev, user]));
  };

  const removeInvitedPlayer = (userId: string) => {
    setInvitedPlayers(prev => prev.filter(u => u.id !== userId));
  };

  /** Case-insensitive de-duplication; the address is never logged. */
  const addInvitedEmail = (email: string) => {
    const result = addInviteEmail(invitedEmails, email);
    if (result.ok) {
      setInvitedEmails(result.emails);
    }
  };

  const removeInvitedEmail = (email: string) => {
    setInvitedEmails(prev => prev.filter(item => item !== email));
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

  /**
   * Create tournament entry (AD-20): the wizard opens when `GET /tournaments/v2/templates` lists a groups and
   * knockout format. An empty list, a failed call or a flag that is off leaves the v1 form exactly as it was.
   */
  const entryBusy = useRef(false);
  const openTournamentEntry = async (): Promise<void> => {
    if (entryBusy.current) {
      return;
    }
    entryBusy.current = true;
    try {
      const response = await getWizardTemplates();
      if (listableTemplates(response).length > 0) {
        navigation.navigate('TournamentWizard', { templates: response });
        return;
      }
    } catch {
      // Fall through to the v1 form.
    } finally {
      entryBusy.current = false;
    }
    setMode('tournament');
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
      if (dateValue.getTime() < Date.now()) {
        setError(t('mob.closure.start_in_past'));
        return;
      }
      if (venueCatalogueEnabled && (!catalogueVenue || !catalogueVenue.name)) {
        setError(t('mob.create_game.venue_label'));
        return;
      }
      const repeatProblemKey = mode === 'game' ? repeatProblem(repeat) : null;
      if (repeatProblemKey) {
        setRepeatError(t(repeatProblemKey));
        return;
      }
      setStep(4);
      return;
    }
    if (step === 4) {
      if (gVisibility === 'group' && selectedGroupIds.length === 0) {
        setError(t('mob.create_game.groups_required'));
        return;
      }
      setStep(5);
      return;
    }
    if (step === 5) {
      if (!isCapacityValid || capacity < gameLimits.players_min) {
        return;
      }
      if (mode === 'game' && gameFee) {
        const fee = parseGameFee(feeText, gameFee);
        if (!fee.valid) {
          return;
        }
        // A fee above 0 needs the payment number (the server answers 422 PAYMENT_NUMBER_REQUIRED); the label is the server seed.
        if (fee.cents !== null && fee.cents > 0 && !payeeNumber) {
          setPayeeError(t('mob.reg.err.payment_number_required'));
          return;
        }
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
      const endsAtIso = computeEndsAtIso(dateValue, durationHours);
      const fullVenueName = courtDetails.trim()
        ? `${selectedVenue.name}, ${courtDetails.trim()}`
        : selectedVenue.name;
      const sportName = sports.find(item => item.name === gSport)?.display_name || gSport;
      const submittedWhen = `${formatEventDate(startsAtIso)}, ${formatEventTimeRange(startsAtIso, mode === 'game' ? endsAtIso : null)}`;
      const submittedDate = formatEventDate(startsAtIso);
      const selectedGroupNames = selectedGroupIds
        .map(id => groups.find(item => item.id === id)?.name)
        .filter((name): name is string => Boolean(name));
      const selectedGroupName = selectedGroupNames.length > 0 ? summariseGroupNames(selectedGroupNames) : undefined;
      const skillKey = skillRequirementLabelKey(skillLevel);
      const audienceFor = (kind: 'game' | 'tournament'): string => {
        if (gVisibility === 'group' && selectedGroupName) {
          return selectedGroupName;
        }
        if (kind === 'game') {
          if (gVisibility === 'invite_only') {
            return t('event_visibility.invite_only');
          }
          if (gVisibility === 'group') {
            return t('event_visibility.group');
          }
          return t('event_visibility.public');
        }
        if (gVisibility === 'invite_only') {
          return t('tournament_visibility.invite');
        }
        if (gVisibility === 'group') {
          return t('tournament_visibility.group');
        }
        return t('tournament_visibility.public');
      };

      if (mode === 'game') {
        // The fee and its payee number travel together, only while the switch is on and a fee above 0 is typed.
        const gameFeeFields = (): Pick<CreateEventInput, 'registration_fee_cents' | 'payment_contact_number'> => {
          const fee = parseGameFee(feeText, gameFee);
          return gameFee && fee.valid && fee.cents !== null && fee.cents > 0
            ? { registration_fee_cents: fee.cents, ...(payeeNumber ? { payment_contact_number: payeeNumber } : {}) }
            : {};
        };
        const input: CreateEventInput = {
          title: gTitle.trim(),
          sport: gSport,
          visibility: gVisibility,
          ...(gVisibility === 'group' && selectedGroupIds.length > 0 ? { group_ids: selectedGroupIds } : {}),
          ...(invitedPlayers.length > 0
            ? { invite_user_ids: invitedPlayers.map(p => p.id) }
            : {}),
          skill_level_requirement: skillLevel,
          ...gameFeeFields(),
          ...repeatFields(repeat),
          capacity: capacity,
          starts_at: startsAtIso,
          ends_at: endsAtIso,
          ...(venueCatalogueEnabled && catalogueVenue
            ? catalogueVenue.isOthers && catalogueVenue.othersInput
              ? {
                  others: catalogueVenue.othersInput,
                }
              : {
                  venue_id: catalogueVenue.venueId || undefined,
                }
            : {
                venue_name: fullVenueName,
                venue_address: selectedVenue.address,
                ...(mapsApiKey && selectedVenue.place_id
                  ? {
                      venue_place_id: selectedVenue.place_id,
                      venue_lat: selectedVenue.lat,
                      venue_lng: selectedVenue.lng,
                    }
                  : {}),
              }),
        };

        const emailsToInvite = invitedEmails;
        const failedEmailInvites: string[] = [];
        let emailsInvited = 0;
        const created = await withCorrelationId(async correlationId => {
          const event = await createEvent(input, { correlationId });
          // One call per email, sequential, same correlation id. A failure never
          // rolls back or blocks the created game; it is listed on completion.
          for (const email of emailsToInvite) {
            try {
              await inviteEmailToEvent(event.id, email, { correlationId });
              emailsInvited += 1;
            } catch (e) {
              failedEmailInvites.push(`${email}: ${getApiErrorMessage(e, t('mob.game_detail.invite_error'))}`);
            }
          }
          return event;
        });
        const rows: CompletionRow[] = [
          { label: t('mob.done.f_title'), value: input.title },
          { label: t('mob.done.f_sport'), value: sportName },
          { label: t('mob.done.f_when'), value: submittedWhen },
          { label: t('mob.done.f_venue'), value: fullVenueName },
          { label: t('mob.done.f_audience'), value: audienceFor('game') },
          { label: t('mob.done.f_players'), value: String(capacity) },
          { label: t('mob.done.f_skill'), value: t(skillKey) },
        ];
        if (gVisibility === 'invite_only' || invitedPlayers.length + invitedEmails.length > 0) {
          rows.push({ label: t('mob.done.f_invited'), value: String(invitedPlayers.length) });
          rows.push({ label: t('mob.done.f_invited_email'), value: String(emailsInvited) });
        }
        if (failedEmailInvites.length > 0) {
          rows.push({ label: t('mob.done.f_invite_failed'), value: failedEmailInvites.join('\n') });
        }
        showCompletion({
          flow: 'game_created',
          rows,
          primary: 'dashboard',
          secondary: { button: 'view_game', id: created.id },
        });
      } else {
        const input: CreateTournamentInput = {
          title: gTitle.trim(),
          sport: gSport,
          visibility: (gVisibility === 'invite_only' ? 'invite' : gVisibility) as TournamentVisibility,
          ...(gVisibility === 'group' && selectedGroupIds.length > 0 ? { group_id: selectedGroupIds[0] } : {}),
          participation_mode: tParticipation,
          format: tFormat,
          capacity: capacity,
          starts_at: dateValue.toISOString().slice(0, 10),
          ...(venueCatalogueEnabled && catalogueVenue
            ? catalogueVenue.isOthers && catalogueVenue.othersInput
              ? {
                  others: catalogueVenue.othersInput,
                }
              : {
                  venue_id: catalogueVenue.venueId || undefined,
                }
            : {
                venue_name: fullVenueName,
              }),
        };

        const created = await withCorrelationId(async correlationId =>
          createTournament(input, { correlationId }),
        );
        showCompletion({
          flow: 'tournament_created',
          rows: [
            { label: t('mob.done.f_title'), value: input.title },
            { label: t('mob.done.f_sport'), value: sportName },
            { label: t('mob.done.f_format'), value: t('mob.create_game.format_knockout') },
            { label: t('mob.done.f_participation'), value: t('mob.create_game.participation_individual') },
            { label: t('mob.done.f_date'), value: submittedDate },
            { label: t('mob.done.f_venue'), value: fullVenueName },
            { label: t('mob.done.f_audience'), value: audienceFor('tournament') },
            { label: t('mob.done.f_players'), value: String(capacity) },
          ],
          primary: 'dashboard',
          secondary: { button: 'view_tournament', id: created.id },
        });
      }
    } catch (e) {
      const code = (e as any)?.response?.data?.code;
      const detail = (e as any)?.response?.data?.detail;
      if (code === 'start_in_past' || detail === "Start time can't be in the past") {
        setError(t('mob.closure.start_in_past'));
      } else if (typeof code === 'string' && code.startsWith('SERIES_')) {
        // AD-8: SERIES_END_INVALID and SERIES_LIMIT_EXCEEDED show their own label (never the server text); the control is on step 3.
        setError(null);
        setRepeatError(refusalText(e, t, 'mob.create_game.err_game_create'));
        setStep(3);
      } else if (typeof code === 'string' && (code.startsWith('PAYMENT_') || code === 'FEE_INVALID')) {
        // The game fee and its number: a coded refusal shows its own label (teams-payments AD-1), never the server text.
        setError(refusalText(e, t, 'mob.create_game.err_game_create'));
        setStep(5);
      } else {
        setError(getApiErrorMessage(e, t('mob.create_game.err_game_create')));
      }
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
        onPress={openTournamentEntry}
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
                  if (catalogueVenue && !catalogueVenue.isOthers) {
                    setCatalogueVenue(null);
                  }
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

  const durationOptions = GAME_DURATION_HOURS.map(hours => ({
    value: String(hours),
    label: t(hours === 1 ? 'mob.create_game.duration_hours_one' : 'mob.create_game.duration_hours_other', {
      count: hours,
    }),
  }));

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
    const shortDate = dateValue.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const compactRow = isCompactDateRow(windowWidth, fontScale);

    const isDateInPast = dateValue.getTime() < Date.now();

    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepHeading}>{t('mob.create_game.step_when_where')}</Text>

        <View style={styles.cardContainer}>
          {mode === 'game' ? (
            // Games: Date, Start time and Duration in ONE row (flex 1.35 / 1 / 1).
            <View>
              <View style={styles.row}>
                <TouchableOpacity
                  style={styles.dateField}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text
                    style={styles.fieldLabel}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {t('mob.create_game.date_label')}
                  </Text>
                  <View
                    style={[
                      styles.pickerBox,
                      compactRow && styles.pickerBoxCompact,
                      isDateInPast && styles.pickerBoxError,
                    ]}
                  >
                    {compactRow ? null : <CalendarIcon size={18} />}
                    <Text
                      style={styles.pickerBoxText}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                    >
                      {compactRow ? shortDate : formattedDate}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.halfField}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Text
                    style={styles.fieldLabel}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {t('mob.create_game.start_time_label')}
                  </Text>
                  <View
                    style={[
                      styles.pickerBox,
                      compactRow && styles.pickerBoxCompact,
                      isDateInPast && styles.pickerBoxError,
                    ]}
                  >
                    {compactRow ? null : <ClockIcon size={18} />}
                    <Text
                      style={styles.pickerBoxText}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                    >
                      {formattedTime}
                    </Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.halfField}>
                  <Text
                    style={styles.fieldLabel}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {t('mob.create_game.duration_label')}
                  </Text>
                  <DropdownField
                    options={durationOptions}
                    value={String(durationHours)}
                    onChange={value => setDurationHours(Number(value))}
                    placeholder={t('mob.create_game.duration_label')}
                    accessibilityLabel={t('mob.create_game.duration_label')}
                    style={[styles.durationTrigger, compactRow && styles.durationTriggerCompact]}
                  />
                </View>
              </View>
              {isDateInPast ? (
                <Text style={styles.pastDateErrorText} testID="create-game-past-date-error">
                  {t('mob.closure.start_in_past')}
                </Text>
              ) : null}
            </View>
          ) : (
            // Tournaments keep the two-column row, no duration.
            <View>
              <View style={styles.row}>
                <TouchableOpacity
                  style={styles.halfField}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={styles.fieldLabel}>{t('mob.create_game.date_label')}</Text>
                  <View style={[styles.pickerBox, isDateInPast && styles.pickerBoxError]}>
                    <CalendarIcon size={18} />
                    <Text style={styles.pickerBoxText}>{formattedDate}</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.halfField}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Text style={styles.fieldLabel}>{t('mob.create_game.start_time_label')}</Text>
                  <View style={[styles.pickerBox, isDateInPast && styles.pickerBoxError]}>
                    <ClockIcon size={18} />
                    <Text style={styles.pickerBoxText}>{formattedTime}</Text>
                  </View>
                </TouchableOpacity>
              </View>
              {isDateInPast ? (
                <Text style={styles.pastDateErrorText} testID="create-tournament-past-date-error">
                  {t('mob.closure.start_in_past')}
                </Text>
              ) : null}
            </View>
          )}

          {showDatePicker && (
            <DateTimePicker
              value={dateValue}
              mode="date"
              minimumDate={new Date()}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              {...iosPickerThemeProps()}
              onChange={handleDateChange}
            />
          )}

          {showTimePicker && (
            <DateTimePicker
              value={dateValue}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              {...iosPickerThemeProps()}
              onChange={handleTimeChange}
            />
          )}

          {mode === 'game' ? (
            <RepeatWeeklyControl
              state={repeat}
              onChange={next => {
                setRepeatError(null);
                setRepeat(next);
              }}
              weekday={dateValue.toLocaleDateString('en-US', { weekday: 'long' })}
              error={repeatError}
              disabled={isSubmitting}
            />
          ) : null}

          {venueCatalogueEnabled ? (
            <VenuePicker
              sportId={sports.find(item => item.name === gSport)?.id ?? ''}
              sportDisplayName={sports.find(item => item.name === gSport)?.display_name || gSport}
              selectedVenue={catalogueVenue}
              variant={mode === 'tournament' ? 'tournament' : 'standard'}
              onSelectVenue={venue => {
                const addr =
                  [venue.block, venue.street].filter(Boolean).join(' ') ||
                  venue.street ||
                  '';
                setCatalogueVenue({
                  venueId: venue.id,
                  name: venue.name,
                  address: addr,
                  lat: venue.lat,
                  lng: venue.lng,
                  source: venue.source || t('venue.source.catalogue'),
                  isOthers: false,
                });
                setSelectedVenue({
                  name: venue.name,
                  address: addr,
                  place_id: null,
                  lat: venue.lat ?? null,
                  lng: venue.lng ?? null,
                });
              }}
              onSaveOthersVenue={others => {
                setCatalogueVenue({
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
                setSelectedVenue({
                  name: others.othersInput.name,
                  address: others.address || `Singapore ${others.othersInput.postal_code}`,
                  place_id: null,
                  lat: others.lat ?? null,
                  lng: others.lng ?? null,
                });
              }}
              onClearVenue={() => {
                setCatalogueVenue(null);
                setSelectedVenue({ name: '', address: '', place_id: null, lat: null, lng: null });
              }}
              mapsApiKey={mapsApiKey}
            />
          ) : (
            <>
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
            </>
          )}

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
        onPress={() => {
          setGVisibility('public');
          setSelectedGroupIds([]);
        }}
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
        onPress={() => {
          setGVisibility('invite_only');
          setSelectedGroupIds([]);
        }}
        title={t('mob.create_game.invite_only_title')}
        subtitle={t('mob.create_game.invite_only_desc')}
        leading={
          <IconBadge color="orange" size={48}>
            <LockIcon size={24} />
          </IconBadge>
        }
      />

      <Text style={styles.sectionHeading}>{t('mob.create_game.share_group_section')}</Text>

      <GroupMultiSelect
        groups={groups}
        selectedIds={selectedGroupIds}
        onChange={ids => {
          setSelectedGroupIds(ids);
          if (ids.length > 0) {
            setGVisibility('group');
          }
        }}
        max={mode === 'game' ? maxGroups : 1}
        showRequired={gVisibility === 'group'}
      />
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
          <SkillRequirementPicker value={skillLevel} onChange={setSkillLevel} />
        </View>

        {mode === 'game' && gameFee ? (
          <View style={[styles.cardContainer, { marginTop: spacing.lg }]}>
            <GameFeeFields
              config={gameFee}
              amount={feeText}
              onAmount={text => {
                setFeeText(text);
                setPayeeError(null);
              }}
              onNumber={e164 => {
                setPayeeNumber(e164);
                setPayeeError(null);
              }}
              numberError={payeeError}
            />
          </View>
        ) : null}
      </View>
    );
  };

  // Step 6: Review & Invite
  const renderStep6 = () => {
    const isInviteOnly = gVisibility === 'invite_only';
    const invitedCount = invitedPlayers.length + invitedEmails.length;
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
    const selectedGroupNames = selectedGroupIds
      .map(id => groups.find(g => g.id === id)?.name)
      .filter((name): name is string => Boolean(name));
    const selectedGroupLabel =
      selectedGroupNames.length > 0 ? summariseGroupNames(selectedGroupNames) : undefined;

    // Everyone added so far (players and emails): directly under the picker's text box.
    const inviteeChips = (
      <>
          {invitedPlayers.length + invitedEmails.length > 0 ? (
            <View style={styles.inviteeList} testID="invitee-list">
              {invitedPlayers.map(person => {
                return (
                  <View key={`p-${person.id}`} style={styles.inviteeChip}>
                    <UserPressable
                      person={{
                        userId: person.id,
                        displayName: person.display_name,
                        nickname: person.nickname ?? null,
                        photoUrl: person.image_url,
                      }}
                      menu={candidateMenu}
                      style={styles.inviteePerson}
                    >
                      <UserAvatar
                        imageUrl={person.image_url}
                        name={person.display_name}
                        size={32}
                        fallback="initials"
                      />
                      <View style={styles.inviteeNames}>
                        <PersonNames displayName={person.display_name} nickname={person.nickname} />
                      </View>
                    </UserPressable>
                    <AddRemoveControl
                      mode="staged"
                      staged
                      name={person.display_name}
                      onStage={noop}
                      onUnstage={() => removeInvitedPlayer(person.id)}
                    />
                  </View>
                );
              })}
              {invitedEmails.map(email => {
                const tint = getAvatarTint(email);
                return (
                  <View key={`e-${email.toLowerCase()}`} style={styles.inviteeChip}>
                    <View style={[styles.inviteeAvatar, { backgroundColor: tint.bg }]}>
                      <Text style={[styles.inviteeAvatarText, { color: tint.text }]}>
                        {email.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.inviteeName} numberOfLines={1}>
                      {email}
                    </Text>
                    <AddRemoveControl
                      mode="staged"
                      staged
                      name={email}
                      onStage={noop}
                      onUnstage={() => removeInvitedEmail(email)}
                    />
                  </View>
                );
              })}
            </View>
          ) : null}
      </>
    );

    return (
      <View style={styles.stepContent}>
        {/* Invite UI for every game type (public, group, invite-only). */}
        <>
        <View style={styles.stepHeaderRow}>
          <Text style={styles.stepHeading}>
            {t('mob.create_game.invite_players')}{' '}
            <Text style={styles.optionalSubtitle}>{t('mob.create_game.optional_parentheses')}</Text>
          </Text>
        </View>

        <UserSearchPicker
          onSelect={addInvitedPlayer}
          onSelectEmail={addInvitedEmail}
          entityLabel={t('mob.user_search.entity_player')}
          excludeUserIds={invitedPlayers.map(person => person.id)}
          placeholder={t('mob.create_game.search_players_placeholder')}
          disabled={isSubmitting}
          belowInput={inviteeChips}
        />
        </>

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
                {t(skillRequirementLabelKey(skillLevel))}
              </Text>
            </View>
          </View>

          <View style={styles.reviewDetailRow}>
            <View style={[styles.reviewIconCircle, { backgroundColor: colors.primary }]}>
              <ClockIcon size={16} />
            </View>
            <Text style={styles.reviewDetailText}>
              {mode === 'game'
                ? `${formattedDate}, ${formatEventTimeRange(
                    dateValue.toISOString(),
                    computeEndsAtIso(dateValue, durationHours),
                  )}`
                : `${formattedDate}, ${formattedTime}`}
            </Text>
          </View>

          {mode === 'game' && repeat.on && repeatProblem(repeat) === null ? (
            <Text style={styles.reviewSeriesLine} testID="review-repeat">
              {t('web.series.review_line', {
                every: Number(repeat.every) === 1 ? t('web.series.every_one') : t('web.series.every_many', { n: Number(repeat.every) }),
                end:
                  repeat.end === 'count'
                    ? t('web.series.end_after', { total: Number(repeat.count) })
                    : t('web.series.end_on', { date: formatSeriesDate(repeat.endDate) }),
              })}
            </Text>
          ) : null}

          <View style={styles.reviewDetailRow}>
            <View style={[styles.reviewIconCircle, { backgroundColor: colors.accent }]}>
              <PinIcon size={16} />
            </View>
            <Text style={styles.reviewDetailText}>
              {selectedVenue.name}
              {courtDetails.trim() ? `, ${courtDetails.trim()}` : ''}
            </Text>
          </View>

          {gVisibility === 'group' ? <GroupNamesRow names={selectedGroupNames} /> : null}

          <View style={styles.reviewDetailRow}>
            <View style={[styles.reviewIconCircle, { backgroundColor: colors.success }]}>
              <PeopleIcon size={16} />
            </View>
            <Text style={styles.reviewDetailText}>
              {gVisibility === 'group' && selectedGroupLabel
                ? invitedCount > 0
                  ? t('mob.create_game.review_players_group_invited', {
                      count: capacity,
                      group: selectedGroupLabel,
                      invited: invitedCount,
                    })
                  : t('mob.create_game.review_players_group', { count: capacity, group: selectedGroupLabel })
                : isInviteOnly
                ? t('mob.create_game.review_players_invite', { count: capacity, invited: invitedCount })
                : invitedCount > 0
                ? t('mob.create_game.review_players_public_invited', { count: capacity, invited: invitedCount })
                : t('mob.create_game.review_players_public', { count: capacity })}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const isStep4Disabled = step === 4 && gVisibility === 'group' && selectedGroupIds.length === 0;
  const isStep5Disabled =
    step === 5 &&
    (!isCapacityValid || capacity < gameLimits.players_min || (mode === 'game' && gameFee !== null && !parseGameFee(feeText, gameFee).valid));

  return (
    <View style={styles.screen}>
      <UserMenuSheet menu={candidateMenu} />
      <WizardHeader
        title={step === 1 ? t('mob.create_game.wizard_title_create') : t('mob.create_game.wizard_title_create_game')}
        currentStep={step}
        totalSteps={6}
        onBack={step > 1 ? handleBack : undefined}
        onClose={step === 1 ? handleBack : undefined}
      />

      <KeyboardAwareScreen
        contentContainerStyle={styles.scrollContent}
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
      </KeyboardAwareScreen>

      {step === 6 ? (
        <View style={styles.footerContainer}>
          <Button
            label={t('mob.create_game.submit_game')}
            variant="cta"
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting}
          />
        </View>
      ) : (
        <WizardFooter
          nextLabel={t('mob.wizard.next')}
          onNext={handleNext}
          nextDisabled={isStep4Disabled || isStep5Disabled}
        />
      )}
    </View>
  );
}

/** A staged invitee is already added: its control only offers "−". */
const noop = (): void => undefined;

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
  dateField: {
    flex: 1.35,
  },
  pickerBoxCompact: {
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  durationTrigger: {
    minHeight: 44,
    marginBottom: 0,
  },
  durationTriggerCompact: {
    paddingHorizontal: spacing.sm,
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
  pickerBoxError: {
    borderColor: colors.error,
    borderWidth: borderWidth.medium,
  },
  pastDateErrorText: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
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
  inviteeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  inviteeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    maxWidth: '100%',
    paddingLeft: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
  },
  inviteeAvatar: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteeAvatarText: {
    ...typography.caption,
    fontWeight: '700',
  },
  inviteePerson: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  inviteeNames: { flexShrink: 1, marginHorizontal: spacing.sm },
  inviteeName: {
    ...typography.caption,
    color: colors.textPrimary,
    marginHorizontal: spacing.sm,
    flexShrink: 1,
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
  reviewSeriesLine: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm },
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
  errorText: {
    ...typography.caption,
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
