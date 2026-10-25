/**
 * Event Detail screen (DES-MEETUP-MOBILE.md §4.3; design-ref-p23/GameDetail.png,
 * EditGame.png..EditGame4.png, DeleteGame.png).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Geolocation from '@react-native-community/geolocation';

import {
  cancelEvent,
  declineEvent,
  getEvent,
  getEventClosure,
  getEventParticipants,
  getEventInvitations,
  getEventResponses,
  inviteEmailToEvent,
  inviteGroupToEvent,
  inviteUserToEvent,
  putEventClosure,
  respondToEventInvitation,
  rsvpEvent,
  updateEvent,
  withdrawEvent,
} from '../api/events';
import {
  fetchPlaceDetails,
  fetchPlacePredictions,
  reverseGeocodeCoordinates,
  type PlacePrediction,
} from '../api/places';
import { getClientConfig, getGameLimits } from '../api/config';
import { getMyGroups } from '../api/groups';
import { withCorrelationId } from '../api/correlationId';
import { useAuth } from '../auth/AuthContext';
import Button from '../components/Button';
import { iosPickerThemeProps } from '../components/iosPickerTheme';
import Card from '../components/Card';
import ErrorView from '../components/ErrorView';
import GroupMultiSelect from '../components/GroupMultiSelect';
import UserAvatar from '../components/UserAvatar';
import LoadingView from '../components/LoadingView';
import ShareActionSheet from '../components/ShareActionSheet';
import Toast from '../components/Toast';
import { useAppShare } from '../hooks/useAppShare';
import VenuePicker, { type SelectedVenueState } from '../components/venue/VenuePicker';
import VenueRow from '../components/venue/VenueRow';
import InviteTypeRow from '../components/invite/InviteTypeRow';
import InviteCard from '../components/invite/InviteCard';
import InvitePicker, { type InviteSendResult, type InviteTab } from '../components/invite/InvitePicker';
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import NumberField from '../components/NumberField';
import ScreenContainer from '../components/ScreenContainer';
import WizardFooter from '../components/WizardFooter';
import WizardHeader from '../components/WizardHeader';
import {
  BackArrowIcon,
  CrossIcon,
  EditIcon,
  LockIcon,
  SearchIcon,
  TrashIcon,
} from '../components/icons/ActionIcons';
import { SportIcon } from '../components/icons/DashboardIcons';
import { useSportRecord, useSportVisual } from '../sports/catalog';
import {
  CalendarIcon,
  ClockIcon,
  LinkIcon,
  PinIcon,
  TargetIcon,
} from '../components/icons/SharedIcons';
import { useT } from '../labels/LabelsContext';
import LifecycleStatusChip from '../components/LifecycleStatusChip';
import ResponsesSection from '../components/responses/ResponsesSection';
import ClosureSummaryCard from '../components/closure/ClosureSummaryCard';
import ClosureModal, { type CandidateItem } from '../components/closure/ClosureModal';
import SkillRequirementPicker from '../components/SkillRequirementPicker';
import {
  DEFAULT_SKILL_REQUIREMENT,
  skillRequirementLabelKey,
  toSkillRequirement,
} from '../utils/skillRequirement';
import { showCompletion } from '../navigation/showCompletion';
import type { CompletionRow } from '../navigation/showCompletion';
import type { HomeStackParamList } from '../navigation/types';
import {
  borderWidth,
  colors,
  radius,
  sizes,
  spacing,
  typography,
} from '../theme/tokens';
import type {
  ClosureResponse,
  Event,
  EventInvitation,
  EventParticipant,
  EventSkillLevel,
  ResponsesResponse,
  UpdateEventInput,
} from '../types/event';
import type { Group } from '../types/group';
import { getApiErrorMessage, isNotFoundError } from '../utils/apiError';
import { useRefetchOnFocus } from '../hooks/useRefetchOnFocus';
import { useUnavailableScreen } from '../hooks/useUnavailableScreen';
import { useUserMenu } from '../hooks/useUserMenu';
import type { AlreadyInPerson } from '../components/UserSearchPicker';
import UserMenuSheet from '../components/user/UserMenuSheet';
import UserPressable from '../components/user/UserPressable';
import { formatEventDate, formatEventTimeRange } from '../utils/formatEventDateTime';
import { groupFromGame, maxGroupsFor } from '../utils/gameGroups';
import { displayStatusOf, isOrganiserOf } from '../utils/gameLists';
import { stripIconGlyphs, useSportDisplayName } from '../utils/labels';

type Props = NativeStackScreenProps<HomeStackParamList, 'EventDetail'>;

const PLAYER_AVATAR_SIZE = 44;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  }
  return (name.trim().slice(0, 2) || '?').toUpperCase();
}

export default function EventDetailScreen({ navigation, route }: Props): React.JSX.Element {
  const { eventId } = route.params;
  const { user } = useAuth();
  const t = useT();
  const [event, setEvent] = useState<Event | null>(null);
  const sportVisual = useSportVisual(event?.sport);

  const [participants, setParticipants] = useState<EventParticipant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const unavailable = useUnavailableScreen(navigation);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Share + invite state
  const share = useAppShare();
  // The invite picker (GV-5): which tab it opens on, `null` = closed.
  const [pickerTab, setPickerTab] = useState<InviteTab | null>(null);
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);

  // Delete modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Closure state
  const [closure, setClosure] = useState<ClosureResponse | null>(null);
  const [isClosureModalOpen, setIsClosureModalOpen] = useState(false);
  const [isClosureSubmitting, setIsClosureSubmitting] = useState(false);
  const [closureError, setClosureError] = useState<string | null>(null);

  // Organizer responses state (dr-mobile / DES-MEETUP-ADDENDUM-decline-response AD-5)
  const [responses, setResponses] = useState<ResponsesResponse | null>(null);
  const [invitations, setInvitations] = useState<EventInvitation[] | null>(null);

  const closureCandidates: CandidateItem[] = useMemo(() => {
    if (closure?.candidates && closure.candidates.length > 0) {
      return closure.candidates.map(c => ({
        id: c.user_id ?? '',
        displayName: c.display_name,
        photoUrl: c.photo_url,
      }));
    }
    return participants
      .filter(p => p.status === 'going')
      .map(p => ({
        id: p.user_id,
        displayName: p.user_display_name || p.user_nickname || 'Player',
        photoUrl: p.user_photo_url ?? null,
      }));
  }, [closure?.candidates, participants]);

  // Edit wizard state
  const [isEditing, setIsEditing] = useState(false);
  const [editStep, setEditStep] = useState(1);
  const [editTitle, setEditTitle] = useState('');
  const [editDateValue, setEditDateValue] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [editVenueQuery, setEditVenueQuery] = useState('');
  const [venuePredictions, setVenuePredictions] = useState<PlacePrediction[]>([]);
  const [editSelectedVenue, setEditSelectedVenue] = useState<{
    name: string;
    address: string;
    place_id?: string | null;
    lat?: number | null;
    lng?: number | null;
  }>({ name: '', address: '', place_id: null, lat: null, lng: null });
  const [editCourtDetails, setEditCourtDetails] = useState('');
  const [editCapacity, setEditCapacity] = useState(4);
  const [isCapacityValid, setIsCapacityValid] = useState(true);
  const [editSkillLevel, setEditSkillLevel] = useState<EventSkillLevel>(DEFAULT_SKILL_REQUIREMENT);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [mapsApiKey, setMapsApiKey] = useState<string | null>(null);
  const [venueCatalogueEnabled, setVenueCatalogueEnabled] = useState(false);
  const [editCatalogueVenue, setEditCatalogueVenue] = useState<SelectedVenueState | null>(null);
  // Group games: the groups the game is shared with (edited as a full list).
  const [editGroupIds, setEditGroupIds] = useState<string[]>([]);
  const [editGroupOptions, setEditGroupOptions] = useState<Group[]>([]);
  const [maxGroups, setMaxGroups] = useState(maxGroupsFor(null));

  /**
   * Loads the game AND its participants together. `silent` (after Join/Leave)
   * keeps the screen on screen instead of flashing the loading view, and keeps the
   * previous participants if only that call fails.
   */
  const loadEvent = useCallback(
    async (silent: boolean = false) => {
      if (!silent) {
        setIsLoading(true);
        setLoadError(null);
      }
      try {
        const [data, parts, closureData, responsesData, invitationsData] = await Promise.all([
          getEvent(eventId),
          getEventParticipants(eventId).catch(() => null),
          typeof getEventClosure === 'function'
            ? getEventClosure(eventId).catch(() => null)
            : Promise.resolve(null),
          typeof getEventResponses === 'function'
            ? getEventResponses(eventId).catch(() => null)
            : Promise.resolve(null),
          typeof getEventInvitations === 'function'
            ? getEventInvitations(eventId).catch(() => null)
            : Promise.resolve(null),
        ]);
        setEvent(data);
        if (Array.isArray(parts)) {
          setParticipants(parts);
        } else if (!silent) {
          setParticipants([]);
        }
        if (closureData) {
          setClosure(closureData);
        }
        if (responsesData && responsesData.accepted) {
          setResponses(responsesData);
        } else {
          setResponses(null);
        }
        setInvitations(Array.isArray(invitationsData) ? invitationsData : null);
      } catch (error) {
        // The server answers 404 for a game that is gone or no longer visible to this user
        // (AC-11): close the screen with the neutral message, once.
        if (isNotFoundError(error)) {
          unavailable.onNotFound();
        } else if (!silent) {
          setLoadError(t('mob.game_detail.load_error'));
        }
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [eventId, t, unavailable],
  );

  // Fetch on every focus and app foreground, including a push or deep link that opens a game
  // already on the stack (AC-10). The first load shows the loading view; later ones refresh in place.
  const loadedIdRef = useRef<string | null>(null);
  useRefetchOnFocus(
    navigation,
    useCallback(() => {
      const silent = loadedIdRef.current === eventId;
      if (!silent) {
        unavailable.reset();
      }
      loadedIdRef.current = eventId;
      loadEvent(silent);
    }, [loadEvent, eventId, unavailable]),
    eventId,
  );

  // Player menu: actions come from the server (card endpoint); the host only refetches.
  const playerMenu = useUserMenu({
    context: { type: 'game', id: eventId },
    currentUserId: user?.id,
    onChanged: () => loadEvent(true),
  });

  useEffect(() => {
    getClientConfig().then(cfg => {
      setMapsApiKey(cfg.google_maps_api_key);
      setVenueCatalogueEnabled(Boolean(cfg.venue_catalogue_enabled));
    }).catch(() => {});
  }, []);

  const sportLabel = useSportDisplayName(event?.sport ?? '');
  const sportRecord = useSportRecord(event?.sport ?? '');
  const isOrganiser = event ? isOrganiserOf(event, user?.id) : false;

  // Organiser action: invite groups / players through the picker (GV-5, AD-4). The picker loops these
  // existing calls once per staged entry.
  const inviteSenders = useMemo(
    () => ({
      group: (groupId: string, correlationId: string) =>
        inviteGroupToEvent(eventId, groupId, { correlationId }),
      user: (userId: string, correlationId: string) =>
        inviteUserToEvent(eventId, userId, { correlationId }),
      email: (email: string, correlationId: string) =>
        inviteEmailToEvent(eventId, email, { correlationId }),
    }),
    [eventId],
  );

  const handleInvitesSent = (result: InviteSendResult): void => {
    loadEvent(true);
    if (result.failedNames.length === 0) {
      setPickerTab(null);
      setInviteNotice(
        result.noNewGroups.length > 0 && result.noNewGroups.length === result.sent
          ? t('mob.game_detail.invite_group_done')
          : t('mob.gv.invites_sent', { count: result.sent }),
      );
    }
  };

  // Start Edit Wizard
  const handleStartEdit = () => {
    if (!event) return;
    setEditTitle(event.title);
    const startDate = event.starts_at ? new Date(event.starts_at) : new Date();
    setEditDateValue(startDate);
    const venueName = event.venue_name || event.location || '';
    setEditVenueQuery(venueName);
    setEditSelectedVenue({
      name: venueName,
      address: event.venue_address || '',
      place_id: event.venue_place_id ?? null,
      lat: event.venue_lat ?? null,
      lng: event.venue_lng ?? null,
    });
    if (event.venue_snapshot) {
      const isOthers = event.venue_snapshot.source === 'user';
      setEditCatalogueVenue({
        venueId: event.venue_id ?? null,
        name: event.venue_snapshot.name,
        address:
          event.venue_snapshot.address ||
          [event.venue_snapshot.block, event.venue_snapshot.street].filter(Boolean).join(' ') ||
          null,
        lat: event.venue_snapshot.lat ?? null,
        lng: event.venue_snapshot.lng ?? null,
        source: isOthers ? t('venue.source.user') : (event.venue_snapshot.source || t('venue.source.catalogue')),
        isOthers,
        geocoding_status: event.venue_snapshot.geocoding_status ?? null,
        snapshot: event.venue_snapshot,
      });
    } else if (event.venue_id) {
      setEditCatalogueVenue({
        venueId: event.venue_id,
        name: venueName,
        address: event.venue_address || null,
        lat: event.venue_lat ?? null,
        lng: event.venue_lng ?? null,
        source: t('venue.source.catalogue'),
        isOthers: false,
      });
    } else if (venueName) {
      setEditCatalogueVenue({
        venueId: null,
        name: venueName,
        address: event.venue_address || null,
        lat: event.venue_lat ?? null,
        lng: event.venue_lng ?? null,
        source: t('venue.source.catalogue'),
        isOthers: false,
      });
    } else {
      setEditCatalogueVenue(null);
    }
    setEditCourtDetails('');
    setEditCapacity(event.capacity || 4);
    setIsCapacityValid(true);
    setEditSkillLevel(toSkillRequirement(event.skill_level_requirement));
    const currentGroupIds = event.group_ids ?? [];
    setEditGroupIds(currentGroupIds);
    // Current groups show even if the user is no longer in them (name from the game).
    const currentGroupNames = event.group_names ?? [];
    const fromGame = currentGroupIds.map((id, index) => groupFromGame(id, currentGroupNames[index]));
    setEditGroupOptions(fromGame);
    if (event.visibility === 'group') {
      getGameLimits().then(limits => setMaxGroups(maxGroupsFor(limits))).catch(() => {});
      getMyGroups()
        .then(res => {
          const mine = res.items;
          const known = new Set(mine.map(group => group.id));
          setEditGroupOptions([...mine, ...fromGame.filter(group => !known.has(group.id))]);
        })
        .catch(() => {});
    }
    setEditStep(1);
    setEditError(null);
    setIsEditing(true);
  };

  const handleVenueSearch = async (text: string) => {
    setEditVenueQuery(text);
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
    setEditSelectedVenue({
      name: venueName,
      address: venueAddress,
      place_id: p.place_id,
      lat: null,
      lng: null,
    });
    setEditVenueQuery(venueName);
    setVenuePredictions([]);

    if (p.place_id && mapsApiKey) {
      const details = await fetchPlaceDetails(p.place_id, mapsApiKey);
      if (details) {
        setEditSelectedVenue(prev => ({
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
    setEditError(null);
    if (!mapsApiKey) {
      setEditError(t('mob.create_game.err_location_failed'));
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
          setEditError(t('mob.create_game.err_location_permission'));
          return;
        }
      } catch {
        setEditError(t('mob.create_game.err_location_permission'));
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
          setEditSelectedVenue({
            name: details.name,
            address: details.formatted_address,
            place_id: details.place_id,
            lat: details.lat,
            lng: details.lng,
          });
          setEditVenueQuery(details.name);
          setVenuePredictions([]);
        } else {
          setEditError(t('mob.create_game.err_location_failed'));
        }
      },
      () => {
        setEditError(t('mob.create_game.err_location_failed'));
      },
      {
        timeout: 10000,
        enableHighAccuracy: false,
      },
    );
  };

  const handleDateChange = (_e: DateTimePickerEvent, selected?: Date) => {
    setShowDatePicker(false);
    if (selected) {
      const newD = new Date(editDateValue);
      newD.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      setEditDateValue(newD);
    }
  };

  const handleTimeChange = (_e: DateTimePickerEvent, selected?: Date) => {
    setShowTimePicker(false);
    if (selected) {
      const newD = new Date(editDateValue);
      newD.setHours(selected.getHours(), selected.getMinutes());
      setEditDateValue(newD);
    }
  };

  const handleNextEditStep = () => {
    setEditError(null);
    if (editStep === 1) {
      if (!editTitle.trim()) {
        setEditError(t('mob.game_detail.edit_err_title'));
        return;
      }
      if (event?.visibility === 'group' && editGroupIds.length === 0) {
        setEditError(t('mob.create_game.groups_required'));
        return;
      }
      setEditStep(2);
      return;
    }
    if (editStep === 2) {
      if (editDateValue.getTime() < Date.now()) {
        setEditError(t('mob.closure.start_in_past'));
        return;
      }
      if (venueCatalogueEnabled && (!editCatalogueVenue || !editCatalogueVenue.name)) {
        setEditError(t('mob.create_game.venue_label'));
        return;
      }
      setEditStep(3);
      return;
    }
    if (editStep === 3) {
      if (!isCapacityValid || editCapacity < Math.max(2, event?.participant_count ?? 0)) {
        return;
      }
      setEditStep(4);
      return;
    }
  };

  const handleBackEditStep = () => {
    setEditError(null);
    if (editStep > 1) {
      setEditStep(editStep - 1);
    } else {
      setIsEditing(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!event) return;
    setEditError(null);
    setIsEditSubmitting(true);
    try {
      const fullVenueName = editCourtDetails.trim()
        ? `${editSelectedVenue.name}, ${editCourtDetails.trim()}`
        : editSelectedVenue.name;

      const venueChanged =
        fullVenueName !== (event.venue_name || event.location || '') ||
        editSelectedVenue.address !== (event.venue_address || '');

      const payload: UpdateEventInput = {
        title: editTitle.trim(),
        skill_level_requirement: editSkillLevel,
        capacity: editCapacity,
        starts_at: editDateValue.toISOString(),
        // The full list replaces the game's groups.
        ...(event.visibility === 'group' ? { group_ids: editGroupIds } : {}),
        ...(venueCatalogueEnabled && editCatalogueVenue
          ? editCatalogueVenue.isOthers && editCatalogueVenue.othersInput
            ? {
                others: editCatalogueVenue.othersInput,
              }
            : {
                venue_id: editCatalogueVenue.venueId || null,
              }
          : {
              venue_name: fullVenueName || null,
              venue_address: editSelectedVenue.address || null,
              ...(venueChanged && mapsApiKey && editSelectedVenue.place_id
                ? {
                    venue_place_id: editSelectedVenue.place_id,
                    venue_lat: editSelectedVenue.lat,
                    venue_lng: editSelectedVenue.lng,
                  }
                : {}),
            }),
      };

      await withCorrelationId(async correlationId => {
        await updateEvent(eventId, payload, { correlationId });
      });
      const originalSkill = toSkillRequirement(event.skill_level_requirement);
      const originalCapacity = event.capacity || 4;
      const originalWhen = event.starts_at ? new Date(event.starts_at).getTime() : Number.NaN;
      const rows: CompletionRow[] = [];
      if (editTitle.trim() !== event.title) {
        rows.push({ label: t('mob.done.f_title'), value: editTitle.trim() });
      }
      if (originalWhen !== editDateValue.getTime()) {
        const iso = editDateValue.toISOString();
        rows.push({
          label: t('mob.done.f_when'),
          value: `${formatEventDate(iso)}, ${formatEventTimeRange(iso, null)}`,
        });
      }
      if (venueChanged) {
        rows.push({ label: t('mob.done.f_venue'), value: fullVenueName });
      }
      if (editSkillLevel !== originalSkill) {
        rows.push({ label: t('mob.done.f_skill'), value: t(skillRequirementLabelKey(editSkillLevel)) });
      }
      if (editCapacity !== originalCapacity) {
        rows.push({ label: t('mob.done.f_players'), value: String(editCapacity) });
      }
      setIsEditing(false);
      showCompletion({
        flow: 'game_updated',
        rows,
        primary: 'dashboard',
        secondary: { button: 'view_game', id: eventId },
      });
    } catch (e: any) {
      // 404: the game is gone or no longer visible (AC-11): close with the neutral message.
      if (isNotFoundError(e)) {
        unavailable.onNotFound();
      } else if (
        e?.response?.status === 422 &&
        (e?.response?.data?.code === 'start_in_past' ||
          e?.response?.data?.detail === "Start time can't be in the past")
      ) {
        setEditError(t('mob.closure.start_in_past'));
      } else if (
        e?.response?.status === 409 &&
        (e?.response?.data?.code === 'game_ended' ||
          e?.response?.data?.detail === 'This game has ended and can no longer be changed')
      ) {
        setEditError(t('mob.closure.game_ended'));
      } else {
        setEditError(getApiErrorMessage(e, t('mob.game_detail.edit_error')));
      }
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleDeleteGame = async () => {
    if (!event) {
      return;
    }
    setIsDeleting(true);
    try {
      await withCorrelationId(async correlationId => {
        await cancelEvent(eventId, 'Deleted by host', { correlationId });
      });
      // The host's own action: any 404 after this closes the screen quietly (completion flow only).
      unavailable.markOwnAction();
      setIsDeleteModalOpen(false);
      showCompletion({
        flow: 'game_cancelled',
        rows: [
          { label: t('mob.done.f_title'), value: event.title },
          { label: t('mob.done.f_sport'), value: sportLabel },
          {
            label: t('mob.done.f_when'),
            value: `${formatEventDate(event.starts_at)}, ${formatEventTimeRange(event.starts_at, event.ends_at)}`,
          },
          { label: t('mob.done.f_status'), value: t('mob.done.v_cancelled') },
        ],
        primary: 'dashboard',
      });
    } catch (e) {
      if (isNotFoundError(e)) {
        setIsDeleteModalOpen(false);
        unavailable.onNotFound();
      } else {
        setActionError(getApiErrorMessage(e, t('mob.game_detail.cancel_error')));
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRsvp = async () => {
    setActionError(null);
    setIsActionLoading(true);
    try {
      await withCorrelationId(async correlationId => {
        await rsvpEvent(eventId, { correlationId });
        await loadEvent(true);
      });
    } catch (e: any) {
      if (isNotFoundError(e)) {
        unavailable.onNotFound();
      } else if (
        e?.response?.status === 409 &&
        (e?.response?.data?.code === 'game_ended' ||
          e?.response?.data?.detail === 'This game has ended and can no longer be changed')
      ) {
        setActionError(t('mob.closure.game_ended'));
      } else {
        // Backend 4xx detail (e.g. skill level or membership) when present, else the generic message.
        setActionError(getApiErrorMessage(e, t('mob.game_detail.join_error')));
      }
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleWithdraw = async () => {
    setActionError(null);
    setIsActionLoading(true);
    try {
      await withCorrelationId(async correlationId => {
        await withdrawEvent(eventId, { correlationId });
        // Leaving can take the game out of sight: a 404 on the refetch below closes the screen
        // quietly, it is not a "no longer available" surprise.
        unavailable.markOwnAction();
        await loadEvent(true);
      });
    } catch (e: any) {
      if (isNotFoundError(e)) {
        unavailable.onNotFound();
      } else if (
        e?.response?.status === 409 &&
        (e?.response?.data?.code === 'game_ended' ||
          e?.response?.data?.detail === 'This game has ended and can no longer be changed')
      ) {
        setActionError(t('mob.closure.game_ended'));
      } else {
        const reason = e?.response?.data?.detail || e?.response?.data?.reason;
        setActionError(reason ?? t('mob.game_detail.leave_error'));
      }
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleAcceptInvite = async () => {
    setActionError(null);
    setIsActionLoading(true);
    try {
      await withCorrelationId(async correlationId => {
        await respondToEventInvitation(eventId, true, { correlationId });
        await loadEvent(true);
      });
    } catch (e: any) {
      if (isNotFoundError(e)) {
        unavailable.onNotFound();
      } else if (
        e?.response?.status === 409 &&
        (e?.response?.data?.code === 'game_ended' ||
          e?.response?.data?.detail === 'This game has ended and can no longer be changed')
      ) {
        setActionError(t('mob.closure.game_ended'));
      } else {
        setActionError(getApiErrorMessage(e, t('mob.game_detail.join_error')));
      }
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDecline = async () => {
    setActionError(null);
    setIsActionLoading(true);
    try {
      await withCorrelationId(async correlationId => {
        await declineEvent(eventId, { correlationId });
        unavailable.markOwnAction();
        await loadEvent(true);
      });
    } catch (e: any) {
      if (isNotFoundError(e)) {
        unavailable.onNotFound();
      } else if (
        e?.response?.status === 409 &&
        (e?.response?.data?.code === 'game_ended' ||
          e?.response?.data?.detail === 'This game has ended and can no longer be changed')
      ) {
        setActionError(t('mob.closure.game_ended'));
      } else {
        const reason = e?.response?.data?.detail || e?.response?.data?.reason;
        setActionError(reason ?? t('mob.game_detail.leave_error'));
      }
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSaveClosure = async (payload: {
    outcome: 'completed' | 'not_held';
    attendeeIds: string[];
    winnerId: string | null;
    runnerUpId: string | null;
    expectedVersion: number;
  }) => {
    setIsClosureSubmitting(true);
    setClosureError(null);
    try {
      await withCorrelationId(async correlationId => {
        const updated = await putEventClosure(
          eventId,
          {
            outcome: payload.outcome,
            attendee_user_ids: payload.attendeeIds,
            winner_user_id: payload.winnerId,
            runner_up_user_id: payload.runnerUpId,
            expected_version: payload.expectedVersion,
          },
          { correlationId },
        );
        setClosure(updated);
        setIsClosureModalOpen(false);
        await loadEvent(true);

        const winnerCandidate = updated.candidates?.find(c => c.user_id === payload.winnerId);
        const runnerCandidate = updated.candidates?.find(c => c.user_id === payload.runnerUpId);

        const rows: CompletionRow[] = [
          { label: t('mob.done.f_title'), value: event?.title ?? '' },
          {
            label: t('mob.closure.title'),
            value:
              payload.outcome === 'completed'
                ? t('mob.closure.outcome.played')
                : t('mob.closure.outcome.not_held'),
          },
        ];
        if (payload.outcome === 'completed' && winnerCandidate) {
          rows.push({
            label: t('mob.closure.winner'),
            value: winnerCandidate.display_name,
          });
        }
        if (payload.outcome === 'completed' && runnerCandidate) {
          rows.push({
            label: t('mob.closure.runner_up'),
            value: runnerCandidate.display_name,
          });
        }

        showCompletion({
          flow: 'game_closed',
          rows,
          primary: 'dashboard',
        });
      });
    } catch (err: any) {
      const code = err?.response?.data?.code;
      const detail = err?.response?.data?.detail;
      if (
        err?.response?.status === 409 &&
        (code === 'version_conflict' || (typeof detail === 'object' && detail?.message))
      ) {
        setClosureError(t('mob.closure.version_conflict'));
        try {
          const reloaded = await getEventClosure(eventId);
          setClosure(reloaded);
        } catch {
          // Keep current
        }
      } else {
        setClosureError(getApiErrorMessage(err, t('mob.game_detail.load_error')));
      }
    } finally {
      setIsClosureSubmitting(false);
    }
  };

  if (isLoading) return <LoadingView />;
  if (loadError || !event) {
    return <ErrorView message={loadError ?? t('mob.game_detail.not_found')} onRetry={() => loadEvent(false)} />;
  }

  // -------------------------------------------------------------
  // EDIT WIZARD (Steps 1 to 4)
  // -------------------------------------------------------------
  if (isEditing) {
    const formattedEditDate = editDateValue.toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    const formattedEditTime = editDateValue.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    const minCap = Math.max(2, event.participant_count);

    const originalTime = event.starts_at
      ? new Date(event.starts_at).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })
      : '';
    const hasTimeChanged = originalTime !== formattedEditTime;
    const hasCapacityChanged = event.capacity !== editCapacity;
    const isEditDateInPast = editDateValue.getTime() < Date.now();

    return (
      <View style={styles.screen}>
        <WizardHeader
          title={t('mob.edit_game.wizard_title')}
          currentStep={editStep}
          totalSteps={4}
          onBack={handleBackEditStep}
        />

        <KeyboardAwareScreen contentContainerStyle={styles.scrollContent}>
          {editStep === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepHeading}>{t('mob.edit_game.step_details')}</Text>

              <View style={styles.cardContainer}>
                <Text style={styles.inputCardLabel}>{t('mob.create_game.game_title_label')}</Text>
                <TextInput
                  style={styles.cardTextInput}
                  value={editTitle}
                  onChangeText={setEditTitle}
                  placeholder={t('mob.create_game.title_placeholder')}
                  placeholderTextColor={colors.textMuted}
                />

                <Text style={[styles.inputCardLabel, { marginTop: spacing.md }]}>
                  {t('mob.create_game.sport')}
                </Text>
                <View style={styles.lockedRow}>
                  <View style={styles.lockedIconCircle}>
                    <SportIcon iconKey={sportVisual.iconKey} size={28} />
                  </View>
                  <View style={styles.lockedInfo}>
                    <Text style={styles.lockedTitle}>{sportLabel}</Text>
                    <Text style={styles.lockedSubtitle}>{t('mob.edit_game.locked_hint')}</Text>
                  </View>
                  <LockIcon size={18} color={colors.warning} />
                </View>

                <Text style={[styles.inputCardLabel, { marginTop: spacing.md }]}>
                  {t('mob.edit_game.who_can_play')}
                </Text>
                <View style={styles.lockedRow}>
                  <View style={[styles.lockedIconCircle, { backgroundColor: colors.avatarTint1 }]}>
                    <Text style={[styles.lockedInitials, { color: colors.avatarTintText1 }]}>
                      {getInitials(event.title)}
                    </Text>
                  </View>
                  <View style={styles.lockedInfo}>
                    <Text style={styles.lockedTitle}>
                      {event.visibility === 'group' ? t('mob.create_game.group') : t('mob.create_game.public_title')}
                    </Text>
                    <Text style={styles.lockedSubtitle}>{t('mob.edit_game.locked_hint')}</Text>
                  </View>
                  <LockIcon size={18} color={colors.warning} />
                </View>
              </View>

              {event.visibility === 'group' ? (
                <View style={[styles.cardContainer, { marginTop: spacing.lg }]}>
                  <Text style={styles.inputCardLabel}>{t('mob.create_game.share_group_section')}</Text>
                  <GroupMultiSelect
                    groups={editGroupOptions}
                    selectedIds={editGroupIds}
                    onChange={setEditGroupIds}
                    max={maxGroups}
                  />
                </View>
              ) : null}
            </View>
          )}

          {editStep === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepHeading}>{t('mob.create_game.step_when_where')}</Text>

              <View style={styles.cardContainer}>
                <View style={styles.row}>
                  <TouchableOpacity style={styles.halfField} onPress={() => setShowDatePicker(true)}>
                    <Text style={styles.fieldLabel}>{t('mob.create_game.date_label')}</Text>
                    <View style={[styles.pickerBox, isEditDateInPast && styles.pickerBoxError]}>
                      <CalendarIcon size={18} />
                      <Text style={styles.pickerBoxText}>{formattedEditDate}</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.halfField} onPress={() => setShowTimePicker(true)}>
                    <Text style={styles.fieldLabel}>{t('mob.create_game.start_time_label')}</Text>
                    <View style={[styles.pickerBox, isEditDateInPast && styles.pickerBoxError]}>
                      <ClockIcon size={18} />
                      <Text style={styles.pickerBoxText}>{formattedEditTime}</Text>
                    </View>
                  </TouchableOpacity>
                </View>

                {isEditDateInPast ? (
                  <Text style={styles.pastDateErrorText} testID="edit-game-past-date-error">
                    {t('mob.closure.start_in_past')}
                  </Text>
                ) : null}

                {showDatePicker && (
                  <DateTimePicker
                    value={editDateValue}
                    mode="date"
                    minimumDate={new Date()}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    {...iosPickerThemeProps()}
                    onChange={handleDateChange}
                  />
                )}

                {showTimePicker && (
                  <DateTimePicker
                    value={editDateValue}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    {...iosPickerThemeProps()}
                    onChange={handleTimeChange}
                  />
                )}

                {venueCatalogueEnabled ? (
                  <VenuePicker
                    sportId={sportRecord?.id ?? ''}
                    sportDisplayName={sportLabel}
                    selectedVenue={editCatalogueVenue}
                    onSelectVenue={venue => {
                      const addr =
                        [venue.block, venue.street].filter(Boolean).join(' ') ||
                        venue.street ||
                        '';
                      setEditCatalogueVenue({
                        venueId: venue.id,
                        name: venue.name,
                        address: addr,
                        lat: venue.lat,
                        lng: venue.lng,
                        source: venue.source || t('venue.source.catalogue'),
                        isOthers: false,
                      });
                      setEditSelectedVenue({
                        name: venue.name,
                        address: addr,
                        place_id: null,
                        lat: venue.lat ?? null,
                        lng: venue.lng ?? null,
                      });
                    }}
                    onSaveOthersVenue={others => {
                      setEditCatalogueVenue({
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
                      setEditSelectedVenue({
                        name: others.othersInput.name,
                        address: others.address || '',
                        place_id: null,
                        lat: others.lat ?? null,
                        lng: others.lng ?? null,
                      });
                    }}
                    onClearVenue={() => {
                      setEditCatalogueVenue(null);
                      setEditSelectedVenue({
                        name: '',
                        address: '',
                        place_id: null,
                        lat: null,
                        lng: null,
                      });
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
                        value={editVenueQuery}
                        onChangeText={handleVenueSearch}
                        placeholder={t('mob.create_game.venue_search_placeholder')}
                        placeholderTextColor={colors.textMuted}
                      />
                      {editVenueQuery ? (
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

                    {mapsApiKey && editSelectedVenue.lat != null && editSelectedVenue.lng != null ? (
                      <View style={styles.mapPreviewBox}>
                        <Image
                          style={styles.mapImage}
                          source={{
                            uri: `https://maps.googleapis.com/maps/api/staticmap?center=${editSelectedVenue.lat},${editSelectedVenue.lng}&zoom=15&size=600x300&markers=color:red%7C${editSelectedVenue.lat},${editSelectedVenue.lng}&key=${mapsApiKey}`,
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
                        <Text style={styles.locationName}>{editSelectedVenue.name}</Text>
                        <Text style={styles.locationAddress}>{editSelectedVenue.address}</Text>
                      </View>
                    </View>
                  </>
                )}

                <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>
                  {t('mob.create_game.court_details_label')}
                </Text>
                <TextInput
                  style={styles.courtInput}
                  value={editCourtDetails}
                  onChangeText={setEditCourtDetails}
                  placeholder={t('mob.create_game.court_details_placeholder')}
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>
          )}

          {editStep === 3 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepHeading}>{t('mob.create_game.step_players_skill')}</Text>

              <View style={styles.cardContainer}>
                <Text style={styles.inputCardLabel}>{t('mob.create_game.players_needed')}</Text>
                <NumberField
                  value={editCapacity}
                  onChangeValue={(val, valid) => {
                    if (val !== null) setEditCapacity(val);
                    setIsCapacityValid(valid);
                  }}
                  min={minCap}
                  max={100}
                  showStepper
                />
              </View>

              <View style={[styles.cardContainer, { marginTop: spacing.lg }]}>
                <Text style={styles.inputCardLabel}>{t('mob.create_game.skill_level_label')}</Text>
                <SkillRequirementPicker value={editSkillLevel} onChange={setEditSkillLevel} />
              </View>
            </View>
          )}

          {editStep === 4 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepHeading}>{t('mob.edit_game.step_review')}</Text>

              <View style={styles.cardContainer}>
                <View style={styles.reviewMainRow}>
                  <View style={styles.reviewSportBadge}>
                    <SportIcon iconKey={sportVisual.iconKey} size={28} />
                  </View>
                  <View style={styles.reviewMainText}>
                    <Text style={styles.reviewGameTitle}>{editTitle}</Text>
                    <Text style={styles.reviewGameSubtitle}>
                      {sportLabel} · {event.visibility === 'group' ? t('mob.create_game.group') : t('mob.create_game.public_title')}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                {hasTimeChanged && (
                  <View style={styles.changeRow}>
                    <Text style={styles.changeLabel}>{t('mob.edit_game.start_time')}</Text>
                    <View style={styles.changeValueRow}>
                      <Text style={styles.changeOldValue}>{originalTime}</Text>
                      <Text style={styles.changeArrow}> → </Text>
                      <Text style={styles.changeNewValue}>{formattedEditTime}</Text>
                    </View>
                  </View>
                )}

                {hasCapacityChanged && (
                  <View style={styles.changeRow}>
                    <Text style={styles.changeLabel}>{t('mob.edit_game.players_needed')}</Text>
                    <View style={styles.changeValueRow}>
                      <Text style={styles.changeOldValue}>{event.capacity}</Text>
                      <Text style={styles.changeArrow}> → </Text>
                      <Text style={styles.changeNewValue}>{editCapacity}</Text>
                    </View>
                  </View>
                )}

                <Text style={styles.changeHelper}>{t('mob.edit_game.changed_fields_hint')}</Text>
              </View>

              <View style={styles.notifyCard}>
                <Text style={styles.notifyText}>
                  {t('mob.edit_game.notify_joined', { count: event.participant_count })}
                </Text>
              </View>
            </View>
          )}

          {editError ? <Text style={styles.errorText}>{editError}</Text> : null}
        </KeyboardAwareScreen>

        {editStep === 4 ? (
          <View style={styles.footerContainer}>
            <Button
              label={t('mob.edit_game.save_changes')}
              variant="cta"
              onPress={handleSaveEdit}
              loading={isEditSubmitting}
              disabled={isEditSubmitting}
            />
          </View>
        ) : (
          <WizardFooter
            nextLabel={t('mob.wizard.next')}
            onNext={handleNextEditStep}
            nextDisabled={
              (editStep === 1 && event.visibility === 'group' && editGroupIds.length === 0) ||
              (editStep === 3 && (!isCapacityValid || editCapacity < minCap))
            }
          />
        )}
      </View>
    );
  }

  // -------------------------------------------------------------
  // GAME DETAIL VIEW (GameDetail.png)
  // -------------------------------------------------------------
  const formattedDate = formatEventDate(event.starts_at);
  const formattedTime = formatEventTimeRange(event.starts_at, event.ends_at);
  const venueText = [event.venue_name || event.location, event.venue_address]
    .filter(Boolean)
    .join(', ');

  const displayStatus = displayStatusOf(event);
  const endInstant = event.ends_at
    ? Date.parse(event.ends_at)
    : event.starts_at
    ? Date.parse(event.starts_at)
    : NaN;
  const isGameEnded =
    event.lifecycle_status === 'past' ||
    event.lifecycle_status === 'closed' ||
    (event.lifecycle_status !== 'active' &&
      event.status !== 'upcoming' &&
      !Number.isNaN(endInstant) &&
      Date.now() >= endInstant);

  // Cancelled / completed / closed games are read-only: no edit, cancel, Join or Leave.
  const isClosed =
    displayStatus !== 'active' ||
    event.status === 'cancelled' ||
    event.status === 'completed' ||
    event.lifecycle_status === 'closed';
  const isOrganiserActionsVisible = isOrganiser && !isClosed && !isGameEnded;
  const totalCapacity = event.capacity || 4;
  // The backend's going count for the game: withdrawn and waitlisted people are not joined.
  const joinedCount = event.participant_count;
  const goingParticipants = participants.filter(p => p.status === 'going');
  const emptySpotsCount = Math.max(0, totalCapacity - joinedCount);

  // The groups the game is shared with, for the Invite type row (GV-3).
  const groupNameList = event.group_names?.length
    ? event.group_names
    : event.group_name
    ? [event.group_name]
    : [];
  const inviteGroups = (event.group_ids?.length ? event.group_ids : groupNameList).map((key, index) => ({
    key,
    name: groupNameList[index] ?? '',
  }));
  const nicknames: Record<string, string | null> = {};
  participants.forEach(p => {
    nicknames[p.user_id] = p.user_nickname ?? null;
  });
  // People already in the game for the invite picker: joined first, then still-pending invitations.
  const alreadyInPeople: AlreadyInPerson[] = responses
    ? [
        ...responses.accepted.items.map(person => ({
          id: person.user_id ?? person.display_name,
          displayName: person.display_name,
          nickname: person.user_id ? nicknames[person.user_id] ?? null : null,
          photoUrl: person.photo_url ?? null,
          statusLabel: t('mob.respond.via.joined'),
        })),
        ...(responses.pending?.items ?? []).map(person => ({
          id: person.user_id ?? person.email ?? person.display_name,
          displayName: person.display_name || person.email || '',
          nickname: null,
          photoUrl: person.photo_url ?? null,
          statusLabel: t('mob.respond.via.invitation'),
        })),
      ]
    : [];

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.detailScroll} keyboardShouldPersistTaps="handled">
        {/* Blue Header Banner */}
        <View style={styles.detailHeaderBanner}>
          <View style={styles.bannerTopNav}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('mob.game_detail.back')}
              onPress={() => navigation.goBack()}
              style={styles.bannerNavBtn}
            >
              <BackArrowIcon size={20} color={colors.white} />
            </Pressable>

            {isOrganiserActionsVisible ? (
              <View style={styles.bannerActions}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={t('mob.game_detail.edit_game')}
                  onPress={handleStartEdit}
                  style={styles.bannerNavBtn}
                >
                  <EditIcon size={20} color={colors.white} />
                </TouchableOpacity>

                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={t('mob.game_detail.cancel_game')}
                  onPress={() => setIsDeleteModalOpen(true)}
                  style={styles.bannerNavBtn}
                >
                  <TrashIcon size={20} color={colors.white} />
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          {/* Centered Sport Circle */}
          <View style={styles.sportBadgeCenter}>
            <SportIcon iconKey={sportVisual.iconKey} size={36} />
          </View>

          <Text style={styles.detailTitle}>{event.title}</Text>

          <View style={styles.detailSubtitleRow}>
            <Text style={styles.detailSubtitle}>
              {sportLabel} ·{' '}
              {t(skillRequirementLabelKey(toSkillRequirement(event.skill_level_requirement)))}{' '}
              •
            </Text>
            {isOrganiser ? (
              <View style={styles.hostPill}>
                <Text style={styles.hostPillText}>{t('mob.game_detail.host_badge')}</Text>
              </View>
            ) : null}
            {!isOrganiser && event.my_declined ? (
              <View style={styles.declinedPill} testID="event-declined-badge">
                <Text style={styles.declinedPillText}>{t('mob.respond.declined')}</Text>
              </View>
            ) : null}
            <LifecycleStatusChip
              status={
                event.lifecycle_status ??
                (displayStatus === 'cancelled' ? 'cancelled' : 'active')
              }
              outcome={event.closure_outcome}
            />
          </View>
        </View>

        {/* Content Cards */}
        <View style={styles.detailContent}>
          {displayStatus === 'cancelled' ? (
            <View style={styles.cancelledBanner} accessibilityRole="alert" testID="cancelled-banner">
              <Text style={styles.cancelledBannerText}>{t('mob.game_detail.cancelled_banner')}</Text>
            </View>
          ) : null}
          {/* Card 1: Details */}
          <Card style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={[styles.infoIconBox, { backgroundColor: colors.primary }]}>
                <ClockIcon size={18} />
              </View>
              <Text style={styles.infoText}>
                {formattedDate}, {formattedTime}
              </Text>
            </View>

            {venueCatalogueEnabled ? (
              <VenueRow
                snapshot={event.venue_snapshot}
                fallbackText={venueText}
                venueName={event.venue_name || event.location}
                venueAddress={event.venue_address}
                venueLat={event.venue_lat}
                venueLng={event.venue_lng}
                venuePlaceId={event.venue_place_id}
                mapsApiKey={mapsApiKey}
                eventId={event.id}
                isOrganiser={isOrganiser}
              />
            ) : (
              <View style={styles.infoRow}>
                <View style={[styles.infoIconBox, { backgroundColor: colors.accent }]}>
                  <PinIcon size={18} />
                </View>
                <Text style={styles.infoText}>{venueText || t('mob.create_game.venue_label')}</Text>
              </View>
            )}

            <InviteTypeRow
              isPublic={event.visibility === 'public'}
              groups={event.visibility === 'group' ? inviteGroups : []}
              responses={isOrganiser ? responses : null}
              invitations={isOrganiser ? invitations : null}
              organizerId={event.organiser_id}
              menuContext={{ type: 'game', id: eventId }}
              currentUserId={user?.id}
              onChanged={() => loadEvent(true)}
              nicknames={nicknames}
            />
          </Card>

          {event.lifecycle_status === 'closed' && !isOrganiser ? (
            <ClosureSummaryCard
              outcome={event.closure_outcome ?? closure?.outcome ?? 'completed'}
              winnerName={closure?.winner?.display_name}
              runnerUpName={closure?.runner_up?.display_name}
              canEdit={isOrganiser && (closure?.can_close ?? true)}
              onEditPress={() => setIsClosureModalOpen(true)}
            />
          ) : null}

          {/* Responses for every viewer who got the payload (GV-4, AD-3 v1.1); a failed call keeps Players. */}
          {responses ? (
            <ResponsesSection
              responses={responses}
              entity="game"
              menu={playerMenu}
              summary={t('mob.gv.joined_of', { joined: joinedCount, capacity: totalCapacity })}
              organizerId={event.organiser_id}
              nicknames={nicknames}
            />
          ) : null}

          {/* Players (organizer: only when the responses call failed; hidden from non-organizers when closed) */}
          {(event.lifecycle_status !== 'closed' || isOrganiser) && !responses ? (
            <Card style={styles.infoCard}>
              <View style={styles.playersCardHeader}>
                <Text style={styles.playersCardTitle}>{t('mob.game_detail.players')}</Text>
                <Text style={styles.playersJoinedCount}>
                  {t('mob.game_detail.players_joined', {
                    joined: joinedCount,
                    capacity: totalCapacity,
                  })}
                </Text>
              </View>

              <View style={styles.playerAvatarsRow}>
                {goingParticipants.map(p => {
                  const name = p.user_display_name || p.user_nickname || 'Player';
                  return (
                    <UserPressable
                      key={p.id || p.user_id}
                      person={{
                        userId: p.user_id,
                        displayName: name,
                        nickname: p.user_nickname ?? null,
                        photoUrl: p.user_photo_url,
                      }}
                      menu={playerMenu}
                      testID={`player-${p.user_id}`}
                    >
                      <View style={styles.playerAvatarCircle} testID="player-avatar">
                        <UserAvatar imageUrl={p.user_photo_url} name={name} size={PLAYER_AVATAR_SIZE} />
                      </View>
                    </UserPressable>
                  );
                })}

                {Array.from({ length: emptySpotsCount }).map((_, idx) => (
                  <View key={`empty-${idx}`} style={styles.emptyAvatarCircle}>
                    <Text style={styles.emptyAvatarText}>?</Text>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}

          {/* Organizer: Invite card with the picker entries (GV-5) */}
          {isOrganiserActionsVisible ? (
            <InviteCard
              onInviteGroups={() => setPickerTab('groups')}
              onInvitePlayers={() => setPickerTab('players')}
              footer={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('mob.game_detail.share')}
                  onPress={share.open}
                  style={[styles.actionBtn, styles.whiteActionBtn, styles.actionBtnLast]}
                >
                  <View style={styles.actionBtnContent}>
                    <View
                      accessibilityElementsHidden
                      importantForAccessibility="no"
                      aria-hidden={true}
                      style={styles.actionBtnIcon}
                    >
                      <LinkIcon size={18} />
                    </View>
                    <Text style={styles.whiteActionBtnText}>
                      {stripIconGlyphs(t('mob.game_detail.share'))}
                    </Text>
                  </View>
                </Pressable>
              }
            />
          ) : null}

          {/* Non-organiser RSVP Actions */}
          {!isOrganiser && !isClosed && !isGameEnded ? (
            <View style={styles.rsvpActionContainer}>
              {event.current_user_rsvp_status === 'going' ? (
                <Button
                  label={t('mob.respond.decline')}
                  accessibilityLabel={t('mob.respond.decline')}
                  variant="secondary"
                  onPress={handleWithdraw}
                  loading={isActionLoading}
                  testID="decline-button"
                />
              ) : event.my_declined ? (
                <Button
                  label={
                    event.visibility === 'invite_only'
                      ? t('mob.respond.accept')
                      : t('mob.respond.join')
                  }
                  variant="cta"
                  onPress={event.visibility === 'invite_only' ? handleAcceptInvite : handleRsvp}
                  loading={isActionLoading}
                  testID="recover-join-button"
                />
              ) : event.visibility === 'invite_only' ? (
                <View style={styles.formButtonsRow}>
                  <Button
                    label={t('mob.respond.accept')}
                    variant="cta"
                    onPress={handleAcceptInvite}
                    loading={isActionLoading}
                    style={styles.rowButton}
                    testID="accept-button"
                  />
                  <Button
                    label={t('mob.respond.decline')}
                    variant="secondary"
                    onPress={handleDecline}
                    loading={isActionLoading}
                    style={styles.rowButton}
                    testID="decline-button"
                  />
                </View>
              ) : (
                <View style={styles.formButtonsRow}>
                  <Button
                    label={t('mob.respond.join')}
                    variant="cta"
                    onPress={handleRsvp}
                    loading={isActionLoading}
                    style={styles.rowButton}
                    testID="join-button"
                  />
                  <Button
                    label={t('mob.respond.decline')}
                    variant="secondary"
                    onPress={handleDecline}
                    loading={isActionLoading}
                    style={styles.rowButton}
                    testID="decline-button"
                  />
                </View>
              )}
            </View>
          ) : null}

          {/* Closure panel / notice and Close action go last (GV-7) */}
          {event.lifecycle_status === 'closed' && isOrganiser ? (
            <ClosureSummaryCard
              outcome={event.closure_outcome ?? closure?.outcome ?? 'completed'}
              winnerName={closure?.winner?.display_name}
              runnerUpName={closure?.runner_up?.display_name}
              canEdit={isOrganiser && (closure?.can_close ?? true)}
              onEditPress={() => setIsClosureModalOpen(true)}
            />
          ) : null}

          {/* Organiser closure notice / action when not closed */}
          {event.lifecycle_status !== 'closed' && isOrganiser ? (
            !isGameEnded ? (
              <View style={styles.closureNoticeBox} testID="closure-opens-notice">
                <Text style={styles.closureNoticeText}>{t('mob.closure.opens_when_ended')}</Text>
              </View>
            ) : (
              <View style={styles.closureActionContainer}>
                <Button
                  label={t('mob.closure.action.close_game')}
                  variant="primary"
                  onPress={() => setIsClosureModalOpen(true)}
                  testID="close-game-button"
                />
              </View>
            )
          ) : null}


          {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}
        </View>
      </ScrollView>

      <UserMenuSheet menu={playerMenu} />
      <InvitePicker
        visible={pickerTab !== null}
        onClose={() => setPickerTab(null)}
        title={event.title}
        initialTab={pickerTab ?? 'players'}
        allowGroups
        senders={inviteSenders}
        excludeEventId={eventId}
        alreadyInPeople={alreadyInPeople}
        alreadyInHeading={t('mob.gv.already_in')}
        alreadyInGroupIds={event.group_ids ?? []}
        alreadyInGroupLabel={t('mob.respond.via.invitation')}
        failureDetail={e => getApiErrorMessage(e, '') || null}
        onSent={handleInvitesSent}
      />
      <Toast message={inviteNotice} onDismiss={() => setInviteNotice(null)} />
      <ShareActionSheet
        visible={share.sheetVisible}
        title={t('mob.game_detail.share_title')}
        onShareGeneric={share.shareViaSystem}
        onShareWhatsApp={share.shareViaWhatsApp}
        onCopyLink={share.copyLink}
        onClose={share.close}
      />

      <Toast message={share.toastMessage} onDismiss={share.clearToast} />

      {/* Delete Game Bottom Sheet (DeleteGame.png) */}
      <Modal visible={isDeleteModalOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <ScreenContainer edges="bottom" fill={false} style={styles.bottomSheetSafe}>
          <View style={styles.bottomSheet}>
            <View style={styles.dragHandle} />

            <View style={styles.deleteTrashBadge}>
              <TrashIcon size={24} color={colors.error} />
            </View>

            <Text style={styles.deleteSheetTitle}>
              {t('mob.game_detail.delete_game_title', { title: event.title })}
            </Text>
            <Text style={styles.deleteSheetSubtitle}>
              {t('mob.game_detail.delete_subtitle', {
                when: `${formattedDate}, ${formattedTime}`,
                count: joinedCount,
              })}
            </Text>

            <View style={styles.bulletRow}>
              <CrossIcon size={16} color={colors.error} />
              <Text style={styles.bulletText}>
                {t('mob.game_detail.delete_bullet_1', { count: joinedCount })}
              </Text>
            </View>

            <View style={styles.bulletRow}>
              <CrossIcon size={16} color={colors.error} />
              <Text style={styles.bulletText}>{t('mob.game_detail.delete_bullet_2')}</Text>
            </View>

            <TouchableOpacity
              style={styles.deleteConfirmBtn}
              onPress={handleDeleteGame}
              disabled={isDeleting}
            >
              <Text style={styles.deleteConfirmBtnText}>
                {t('mob.game_detail.delete_confirm_button')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteKeepBtn}
              onPress={() => setIsDeleteModalOpen(false)}
              disabled={isDeleting}
            >
              <Text style={styles.deleteKeepBtnText}>{t('mob.game_detail.keep_game_button')}</Text>
            </TouchableOpacity>
          </View>
          </ScreenContainer>
        </View>
      </Modal>

      <ClosureModal
        visible={isClosureModalOpen}
        onClose={() => {
          setIsClosureModalOpen(false);
          setClosureError(null);
        }}
        entityType="event"
        candidates={closureCandidates}
        initialOutcome={event.closure_outcome ?? closure?.outcome}
        initialAttendeeIds={closure?.attendees?.map(a => a.user_id ?? '').filter(Boolean)}
        initialWinnerId={closure?.winner?.user_id}
        initialRunnerUpId={closure?.runner_up?.user_id}
        expectedVersion={closure?.version ?? 0}
        onSubmit={handleSaveClosure}
        isSubmitting={isClosureSubmitting}
        error={closureError}
      />
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
  detailScroll: {
    paddingBottom: spacing.xxl,
  },
  detailHeaderBanner: {
    backgroundColor: colors.primary,
    paddingTop: Platform.OS === 'ios' ? spacing.xxl : spacing.lg,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    borderBottomLeftRadius: radius.lg * 2,
    borderBottomRightRadius: radius.lg * 2,
  },
  bannerTopNav: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  bannerNavBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.overlayWhite25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sportBadgeCenter: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  detailTitle: {
    ...typography.h2,
    color: colors.white,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  detailSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  detailSubtitle: {
    ...typography.bodyBold,
    color: colors.white,
  },
  cancelledBanner: {
    backgroundColor: colors.errorLight,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  cancelledBannerText: {
    ...typography.bodyBold,
    color: colors.error,
    textAlign: 'center',
  },
  hostPill: {
    backgroundColor: colors.ownerChipBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  hostPillText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.ownerChipText,
  },
  declinedPill: {
    backgroundColor: colors.track,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  declinedPillText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  detailContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  infoIconBox: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    flex: 1,
  },
  playersCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  playersCardTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  playersJoinedCount: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.success,
  },
  playerAvatarsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  playerAvatarCircle: {
    width: PLAYER_AVATAR_SIZE,
    height: PLAYER_AVATAR_SIZE,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  emptyAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyAvatarText: {
    ...typography.bodyBold,
    color: colors.textMuted,
  },
  actionBtn: {
    minHeight: sizes.touchTarget,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    borderWidth: borderWidth.thin,
  },
  actionBtnLast: { marginBottom: 0 },
  actionBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnIcon: {
    width: spacing.lg,
    height: spacing.lg,
    marginRight: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whiteActionBtn: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  whiteActionBtnText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  formTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  formHint: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  successText: {
    ...typography.body,
    color: colors.success,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  formButtonsRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  rowButton: {
    flex: 1,
    marginBottom: 0,
  },
  selectedInviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  selectedInviteNames: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  selectedInvitePerson: { flexShrink: 1, marginLeft: spacing.sm },
  selectedInviteText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  rsvpActionContainer: {
    marginTop: spacing.md,
  },
  stepContent: {
    flex: 1,
  },
  stepHeading: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
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
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  lockedIconCircle: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  lockedInitials: {
    ...typography.bodyBold,
  },
  lockedInfo: {
    flex: 1,
  },
  lockedTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  lockedSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
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
  closureNoticeBox: {
    backgroundColor: colors.track,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  closureNoticeText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  closureActionContainer: {
    marginBottom: spacing.md,
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
  divider: {
    height: borderWidth.thin,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  changeRow: {
    marginBottom: spacing.sm,
  },
  changeLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  changeValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  changeOldValue: {
    ...typography.body,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  changeArrow: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  changeNewValue: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  changeHelper: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  notifyCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  notifyText: {
    ...typography.caption,
    color: colors.primaryDark,
    lineHeight: 18,
  },
  footerContainer: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: borderWidth.thin,
    borderTopColor: colors.border,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: 'flex-end',
  },
  bottomSheetSafe: {
    backgroundColor: colors.surface,
  },
  bottomSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg * 1.5,
    borderTopRightRadius: radius.lg * 1.5,
    padding: spacing.lg,
    alignItems: 'center',
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  deleteTrashBadge: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.errorLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  deleteSheetTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  deleteSheetSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    width: '100%',
    marginBottom: spacing.sm,
  },
  bulletText: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  deleteConfirmBtn: {
    width: '100%',
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  deleteConfirmBtnText: {
    ...typography.button,
    color: colors.white,
  },
  deleteKeepBtn: {
    width: '100%',
    height: 48,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  deleteKeepBtnText: {
    ...typography.button,
    color: colors.textPrimary,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
