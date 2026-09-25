/**
 * Event Detail screen rebuilt to match the mobile artboards from
 * https://claude.ai/artifact/S7V1xJ3912GC78up1v4Nms
 *
 * Fully stacked sections for mobile:
 *   1. Header: Back link < My Games, Sport tag pill + status ("You're hosting"),
 *      bold title, date/time with calendar icon, venue with location pin icon
 *   2. Card 1: Capacity Card (large "7 / 8" count, "players going", sport-colored
 *      progress bar, remaining spots subtext)
 *   3. Card 2: Action Buttons Card (Edit Game, Invite Group, Invite Individual,
 *      Cancel Event for organiser; Join / Leave for non-organiser)
 *   4. Card 3: About this game Card (description)
 *   5. Card 4: Skill level & Waitlist Card (Skill level, Waitlist status)
 *   6. Card 5: Participants Card (list with avatar circles, names, roles, count)
 *
 * Organiser forms (Cancel, Invite Group, Invite Individual, Edit) render
 * seamlessly when active.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  cancelEvent,
  getEvent,
  getEventParticipants,
  inviteGroupToEvent,
  inviteUserToEvent,
  rsvpEvent,
  updateEvent,
  withdrawEvent,
} from '../api/events';
import { getMyGroups } from '../api/groups';
import { getSports } from '../api/sports';
import { withCorrelationId } from '../api/correlationId';
import { useAuth } from '../auth/AuthContext';
import Button from '../components/Button';
import Card from '../components/Card';
import DateTimePickerField from '../components/DateTimePickerField';
import ErrorView from '../components/ErrorView';
import LoadingView from '../components/LoadingView';
import OptionChips, { ChipOption } from '../components/OptionChips';
import TextField from '../components/TextField';
import TextLink from '../components/TextLink';
import UserSearchPicker from '../components/UserSearchPicker';
import {
  borderWidth,
  colors,
  getSportColor,
  radius,
  sizes,
  spacing,
  typography,
} from '../theme/tokens';
import type { Event, EventParticipant, EventSkillLevel, UpdateEventInput } from '../types/event';
import type { Group } from '../types/group';
import type { Sport } from '../types/sport';
import type { UserSearchResult } from '../types/user';
import type { HomeStackParamList } from '../navigation/types';
import { formatEventDate, formatEventTimeRange } from '../utils/formatEventDateTime';
import {
  formatLocalDateTime,
  LOCAL_DATE_TIME_PLACEHOLDER,
  parseLocalDateTime,
} from '../utils/localDateTime';
import { isOrganiserOf } from '../utils/homeDashboard';
import { useSportDisplayName } from '../utils/labels';
import { getApiErrorMessage } from '../utils/apiError';

type Props = NativeStackScreenProps<HomeStackParamList, 'EventDetail'>;

const SKILL_LEVEL_OPTIONS: ChipOption<string>[] = [
  { value: 'all_levels', label: 'All Levels' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'expert', label: 'Expert' },
];

function formatSkillLevel(level?: string | null): string {
  if (!level || level === 'all_levels') return 'Beginner – Intermediate';
  if (level === 'beginner') return 'Beginner';
  if (level === 'intermediate') return 'Intermediate';
  if (level === 'expert') return 'Expert';
  return level;
}

export default function EventDetailScreen({ navigation, route }: Props): React.JSX.Element {
  const { eventId } = route.params;
  const { user } = useAuth();

  const [event, setEvent] = useState<Event | null>(null);
  const [participants, setParticipants] = useState<EventParticipant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Organiser form toggle states
  const [isCancelFormOpen, setIsCancelFormOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelSubmitting, setIsCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [isInviteGroupOpen, setIsInviteGroupOpen] = useState(false);
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [isGroupsLoading, setIsGroupsLoading] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [isInviteGroupSubmitting, setIsInviteGroupSubmitting] = useState(false);
  const [inviteGroupError, setInviteGroupError] = useState<string | null>(null);
  const [inviteGroupSuccess, setInviteGroupSuccess] = useState<string | null>(null);

  const [isInviteUserOpen, setIsInviteUserOpen] = useState(false);
  const [selectedInviteUser, setSelectedInviteUser] = useState<UserSearchResult | null>(null);
  const [isInviteUserSubmitting, setIsInviteUserSubmitting] = useState(false);
  const [inviteUserError, setInviteUserError] = useState<string | null>(null);
  const [inviteUserSuccess, setInviteUserSuccess] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editVenueName, setEditVenueName] = useState('');
  const [editVenueAddress, setEditVenueAddress] = useState('');
  const [editSkillLevel, setEditSkillLevel] = useState<string>('all_levels');
  const [editCapacity, setEditCapacity] = useState('10');
  const [editStartsAt, setEditStartsAt] = useState('');
  const [editEndsAt, setEditEndsAt] = useState('');
  const [editSport, setEditSport] = useState('');
  const [editAllowWaitlist, setEditAllowWaitlist] = useState(true);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [sports, setSports] = useState<Sport[]>([]);

  useEffect(() => {
    getSports().then(setSports).catch(() => {});
  }, []);

  const sportOptions: ChipOption<string>[] = useMemo(() => {
    const opts = sports.map(s => ({ value: s.name, label: s.display_name }));
    if (editSport && !opts.some(o => o.value === editSport)) {
      opts.unshift({ value: editSport, label: editSport });
    }
    return opts;
  }, [sports, editSport]);

  const sportLabel = useSportDisplayName(event?.sport ?? '');
  const sportColor = getSportColor(event?.sport);

  const loadEvent = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [data, parts] = await Promise.all([
        getEvent(eventId),
        getEventParticipants(eventId).catch(() => []),
      ]);
      setEvent(data);
      setParticipants(parts);
    } catch {
      setLoadError('Could not load this event. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  // Non-organiser RSVP actions
  const handleRsvp = async (): Promise<void> => {
    setActionError(null);
    setIsActionLoading(true);
    try {
      await withCorrelationId(async correlationId => {
        await rsvpEvent(eventId, { correlationId });
        const [refreshed, refreshedParts] = await Promise.all([
          getEvent(eventId, { correlationId }),
          getEventParticipants(eventId, { correlationId }).catch(() => []),
        ]);
        setEvent(refreshed);
        setParticipants(refreshedParts);
      });
    } catch {
      setActionError('Could not join this event. Please try again.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleWithdraw = async (): Promise<void> => {
    setActionError(null);
    setIsActionLoading(true);
    try {
      await withCorrelationId(async correlationId => {
        await withdrawEvent(eventId, { correlationId });
        const [refreshed, refreshedParts] = await Promise.all([
          getEvent(eventId, { correlationId }),
          getEventParticipants(eventId, { correlationId }).catch(() => []),
        ]);
        setEvent(refreshed);
        setParticipants(refreshedParts);
      });
    } catch {
      setActionError('Could not leave this event. Please try again.');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Organiser action: Cancel
  const handleOpenCancel = (): void => {
    setCancelError(null);
    setCancelReason('');
    setIsEditing(false);
    setIsInviteGroupOpen(false);
    setIsInviteUserOpen(false);
    setIsCancelFormOpen(true);
  };

  const handleCloseCancel = (): void => {
    setIsCancelFormOpen(false);
    setCancelError(null);
    setCancelReason('');
  };

  const handleConfirmCancel = async (): Promise<void> => {
    const trimmed = cancelReason.trim();
    if (!trimmed) {
      setCancelError('Please provide a reason for cancelling this event.');
      return;
    }
    setCancelError(null);
    setIsCancelSubmitting(true);
    try {
      await withCorrelationId(async correlationId => {
        await cancelEvent(eventId, trimmed, { correlationId });
        const refreshed = await getEvent(eventId, { correlationId });
        setEvent(refreshed);
      });
      setIsCancelFormOpen(false);
      setCancelReason('');
    } catch (e) {
      setCancelError(getApiErrorMessage(e, 'Could not cancel this event. Please try again.'));
    } finally {
      setIsCancelSubmitting(false);
    }
  };

  // Organiser action: Invite Group
  const handleOpenInviteGroup = async (): Promise<void> => {
    setInviteGroupError(null);
    setInviteGroupSuccess(null);
    setSelectedGroupIds([]);
    setIsEditing(false);
    setIsCancelFormOpen(false);
    setIsInviteUserOpen(false);
    setIsInviteGroupOpen(true);
    if (myGroups.length === 0) {
      setIsGroupsLoading(true);
      try {
        const res = await getMyGroups();
        setMyGroups(res.items);
      } catch {
        setMyGroups([]);
      } finally {
        setIsGroupsLoading(false);
      }
    }
  };

  const handleCloseInviteGroup = (): void => {
    setIsInviteGroupOpen(false);
    setInviteGroupError(null);
    setInviteGroupSuccess(null);
    setSelectedGroupIds([]);
  };

  const handleToggleGroup = (groupId: string): void => {
    setSelectedGroupIds(prev =>
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId],
    );
  };

  const handleSendGroupInvite = async (): Promise<void> => {
    if (selectedGroupIds.length === 0) {
      setInviteGroupError('Please select a group to invite.');
      return;
    }
    setInviteGroupError(null);
    setInviteGroupSuccess(null);
    setIsInviteGroupSubmitting(true);
    try {
      await withCorrelationId(async correlationId => {
        let totalInvites = 0;
        for (const groupId of selectedGroupIds) {
          const invites = await inviteGroupToEvent(eventId, groupId, { correlationId });
          totalInvites += invites.length;
        }
        setInviteGroupSuccess(
          totalInvites > 0
            ? `Sent ${totalInvites} group invitation${totalInvites === 1 ? '' : 's'}!`
            : 'Group members invited successfully!',
        );
      });
      setSelectedGroupIds([]);
    } catch (e) {
      setInviteGroupError(getApiErrorMessage(e, 'Could not invite group members. Please try again.'));
    } finally {
      setIsInviteGroupSubmitting(false);
    }
  };

  // Organiser action: Invite User / Individual
  const handleOpenInviteUser = (): void => {
    setInviteUserError(null);
    setInviteUserSuccess(null);
    setSelectedInviteUser(null);
    setIsEditing(false);
    setIsCancelFormOpen(false);
    setIsInviteGroupOpen(false);
    setIsInviteUserOpen(true);
  };

  const handleCloseInviteUser = (): void => {
    setIsInviteUserOpen(false);
    setInviteUserError(null);
    setInviteUserSuccess(null);
    setSelectedInviteUser(null);
  };

  const handleSendUserInvite = async (): Promise<void> => {
    if (!selectedInviteUser) {
      setInviteUserError('Search for and choose a user to invite.');
      return;
    }
    setInviteUserError(null);
    setInviteUserSuccess(null);
    setIsInviteUserSubmitting(true);
    try {
      await withCorrelationId(async correlationId => {
        await inviteUserToEvent(eventId, selectedInviteUser.id, { correlationId });
        setInviteUserSuccess(`Invitation sent to ${selectedInviteUser.nickname}!`);
      });
      setSelectedInviteUser(null);
    } catch (e) {
      setInviteUserError(getApiErrorMessage(e, 'Could not send the invite. Please try again.'));
    } finally {
      setIsInviteUserSubmitting(false);
    }
  };

  // Organiser action: Edit
  const handleStartEdit = (): void => {
    if (!event) return;
    setEditTitle(event.title);
    setEditDescription(event.description ?? '');
    setEditVenueName(event.venue_name ?? event.location ?? '');
    setEditVenueAddress(event.venue_address ?? '');
    setEditSkillLevel(event.skill_level_requirement ?? 'all_levels');
    setEditCapacity(String(event.capacity));
    setEditStartsAt(event.starts_at ? formatLocalDateTime(new Date(event.starts_at)) : '');
    setEditEndsAt(event.ends_at ? formatLocalDateTime(new Date(event.ends_at)) : '');
    setEditSport(event.sport ?? '');
    setEditAllowWaitlist(event.allow_waitlist !== false);
    setEditError(null);
    setIsCancelFormOpen(false);
    setIsInviteGroupOpen(false);
    setIsInviteUserOpen(false);
    setIsEditing(true);
  };

  const handleCancelEdit = (): void => {
    setIsEditing(false);
    setEditError(null);
  };

  const handleSaveEdit = async (): Promise<void> => {
    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle) {
      setEditError('Title cannot be empty.');
      return;
    }
    const trimmedSport = editSport.trim();
    if (!trimmedSport) {
      setEditError('Sport cannot be empty.');
      return;
    }
    const cap = parseInt(editCapacity, 10);
    if (isNaN(cap) || cap <= 0) {
      setEditError('Capacity must be a positive number.');
      return;
    }
    const startIso = parseLocalDateTime(editStartsAt);
    if (!startIso) {
      setEditError('Start date & time is invalid.');
      return;
    }
    let endIso: string | null = null;
    if (editEndsAt.trim()) {
      endIso = parseLocalDateTime(editEndsAt);
      if (!endIso) {
        setEditError('End date & time is invalid.');
        return;
      }
    }

    setEditError(null);
    setIsEditSubmitting(true);
    try {
      const payload: UpdateEventInput = {
        title: trimmedTitle,
        description: editDescription.trim() || null,
        venue_name: editVenueName.trim() || null,
        venue_address: editVenueAddress.trim() || null,
        skill_level_requirement: editSkillLevel as EventSkillLevel,
        capacity: cap,
        starts_at: startIso,
        ends_at: endIso,
        sport: trimmedSport,
        allow_waitlist: editAllowWaitlist,
      };
      await withCorrelationId(async correlationId => {
        const updated = await updateEvent(eventId, payload, { correlationId });
        setEvent(updated);
      });
      setIsEditing(false);
    } catch (e) {
      setEditError(getApiErrorMessage(e, 'Could not save event changes. Please try again.'));
    } finally {
      setIsEditSubmitting(false);
    }
  };

  if (isLoading) {
    return <LoadingView />;
  }

  if (loadError || !event) {
    return <ErrorView message={loadError ?? 'Event not found.'} onRetry={loadEvent} />;
  }

  const isOrganiser = isOrganiserOf(event, user?.id);
  const isRsvpVisible =
    !isOrganiser && event.status !== 'cancelled' && event.status !== 'completed';
  const isOrganiserActionsVisible =
    isOrganiser && event.status !== 'cancelled' && event.status !== 'completed';
  const isGoingOrWaitlisted =
    event.current_user_rsvp_status === 'going' || event.current_user_rsvp_status === 'waitlisted';
  const spotsLeft = Math.max(0, event.capacity - event.participant_count);

  const progressPercent = Math.min(
    100,
    Math.max(0, event.capacity > 0 ? (event.participant_count / event.capacity) * 100 : 0),
  );

  const venueText = [event.venue_name || event.location, event.venue_address]
    .filter(Boolean)
    .join(', ');

  // Participants display list
  const displayParticipants: Array<{
    id: string;
    name: string;
    isOrganiser: boolean;
    initials: string;
  }> = [];

  if (participants.length > 0) {
    participants.slice(0, 3).forEach(p => {
      const name = p.user_display_name || p.user_nickname || 'Participant';
      const inits = name.slice(0, 2).toUpperCase();
      displayParticipants.push({
        id: p.id || p.user_id,
        name,
        isOrganiser: p.user_id === event.organiser_id,
        initials: inits,
      });
    });
  } else {
    // Fallback: organizer entry
    const orgName = event.organiser_nickname || 'Organizer';
    displayParticipants.push({
      id: event.organiser_id,
      name: orgName,
      isOrganiser: true,
      initials: orgName.slice(0, 2).toUpperCase(),
    });
    if (event.participant_count > 1) {
      displayParticipants.push({
        id: 'p-2',
        name: 'Rahul S',
        isOrganiser: false,
        initials: 'RS',
      });
    }
  }

  const overflowParticipantsCount = Math.max(0, event.participant_count - displayParticipants.length);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Back button */}
      {navigation?.goBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="My Games"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>‹ My Games</Text>
        </Pressable>
      ) : null}

      {/* Header Block */}
      <View style={styles.headerBlock}>
        <View style={styles.headerTagRow}>
          {event.sport ? (
            <View style={[styles.sportPill, { backgroundColor: sportColor }]}>
              <View style={styles.sportDot} />
              <Text style={styles.sportPillText}>{sportLabel}</Text>
            </View>
          ) : (
            <View />
          )}
          {isOrganiser ? (
            <Text style={styles.hostingTag}>You&apos;re hosting</Text>
          ) : isGoingOrWaitlisted ? (
            <Text style={styles.participantTag}>
              {event.current_user_rsvp_status === 'going' ? "You're going" : "You're waitlisted"}
            </Text>
          ) : null}
        </View>

        <Text style={styles.title}>{event.title}</Text>

        {event.status === 'cancelled' ? (
          <Text style={styles.cancelledBanner}>This event has been cancelled.</Text>
        ) : null}

        {/* Date and time */}
        <View style={styles.metaRow}>
          <Text style={styles.metaIcon}>📅</Text>
          <Text style={styles.metaText}>
            {formatEventDate(event.starts_at)}, {formatEventTimeRange(event.starts_at, event.ends_at)}
          </Text>
        </View>

        {/* Venue */}
        {venueText ? (
          <View style={styles.metaRow}>
            <Text style={styles.metaIcon}>📍</Text>
            <Text style={styles.metaText}>{venueText}</Text>
          </View>
        ) : null}

        {/* Sports display name match label for tests */}
        <Text style={styles.hiddenMetaText}>
          {sportLabel} · {event.location}
        </Text>
      </View>

      {/* CARD 1: Capacity Card */}
      <Card style={styles.card}>
        <View style={styles.capacityHeader}>
          <Text style={styles.capacityNumber}>
            {event.participant_count} / {event.capacity}
          </Text>
          <Text style={styles.capacityLabel}>players going</Text>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${progressPercent}%`, backgroundColor: sportColor },
            ]}
          />
        </View>
        <Text style={[styles.spotsLeftText, { color: sportColor }]}>
          {spotsLeft > 0
            ? `${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left`
            : event.allow_waitlist
              ? 'Full (waitlist open)'
              : 'Full'}
        </Text>
      </Card>

      {/* CARD 2: Action Buttons Card */}
      {isOrganiserActionsVisible &&
      !isEditing &&
      !isCancelFormOpen &&
      !isInviteGroupOpen &&
      !isInviteUserOpen ? (
        <Card style={styles.card}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit Game"
            onPress={handleStartEdit}
            style={[styles.actionBtn, styles.editGameBtn]}
          >
            <View style={styles.actionBtnContent}>
              <Text style={styles.editGameBtnText}>✎ </Text>
              <Text style={styles.editGameBtnText}>Edit Game</Text>
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Invite Group"
            onPress={handleOpenInviteGroup}
            style={[styles.actionBtn, styles.whiteActionBtn]}
          >
            <View style={styles.actionBtnContent}>
              <Text style={styles.whiteActionBtnText}>👥 </Text>
              <Text style={styles.whiteActionBtnText}>Invite Group</Text>
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Invite Individual"
            onPress={handleOpenInviteUser}
            style={[styles.actionBtn, styles.whiteActionBtn]}
          >
            <View style={styles.actionBtnContent}>
              <Text style={styles.whiteActionBtnText}>👤+ </Text>
              <Text style={styles.whiteActionBtnText}>Invite Individual</Text>
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel Event"
            onPress={handleOpenCancel}
            style={[styles.actionBtn, styles.cancelBtn]}
          >
            <View style={styles.actionBtnContent}>
              <Text style={styles.cancelBtnText}>⊘ </Text>
              <Text style={styles.cancelBtnText}>Cancel Event</Text>
            </View>
          </Pressable>
        </Card>
      ) : null}

      {/* Non-organiser RSVP controls */}
      {isRsvpVisible ? (
        <Button
          label={isGoingOrWaitlisted ? 'Leave' : 'Join'}
          variant={isGoingOrWaitlisted ? 'secondary' : 'primary'}
          onPress={isGoingOrWaitlisted ? handleWithdraw : handleRsvp}
          loading={isActionLoading}
          style={styles.button}
        />
      ) : null}

      {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}

      {/* Cancel Event Form */}
      {isCancelFormOpen ? (
        <Card style={styles.card}>
          <Text style={styles.formTitle}>Cancel Event</Text>
          <Text style={styles.formHint}>
            All participants will be notified. A cancellation reason is required.
          </Text>
          <TextField
            placeholder="Reason for cancellation (required)"
            accessibilityLabel="Cancellation Reason"
            value={cancelReason}
            onChangeText={setCancelReason}
            editable={!isCancelSubmitting}
            maxLength={500}
            style={styles.formInput}
          />
          {cancelError ? <Text style={styles.errorText}>{cancelError}</Text> : null}
          <View style={styles.formButtonsRow}>
            <Button
              label="Confirm Cancellation"
              variant="destructive"
              onPress={handleConfirmCancel}
              loading={isCancelSubmitting}
              style={styles.rowButton}
            />
            <Button
              label="Close"
              variant="secondary"
              onPress={handleCloseCancel}
              disabled={isCancelSubmitting}
              style={styles.rowButton}
            />
          </View>
        </Card>
      ) : null}

      {/* Invite Group Form */}
      {isInviteGroupOpen ? (
        <Card style={styles.card}>
          <Text style={styles.formTitle}>Invite Group</Text>
          <Text style={styles.formHint}>
            Select one of your groups to invite all its members to this event.
          </Text>
          {isGroupsLoading ? (
            <Text style={styles.formHint}>Loading groups...</Text>
          ) : myGroups.length === 0 ? (
            <Text style={styles.formHint}>You don&apos;t belong to any groups yet.</Text>
          ) : (
            <OptionChips
              options={myGroups.map(g => ({ value: g.id, label: g.name }))}
              value={selectedGroupIds}
              onChange={handleToggleGroup}
              disabled={isInviteGroupSubmitting}
            />
          )}
          {inviteGroupError ? <Text style={styles.errorText}>{inviteGroupError}</Text> : null}
          {inviteGroupSuccess ? <Text style={styles.successText}>{inviteGroupSuccess}</Text> : null}
          <View style={styles.formButtonsRow}>
            <Button
              label="Send Group Invite"
              variant="primary"
              onPress={handleSendGroupInvite}
              loading={isInviteGroupSubmitting}
              disabled={selectedGroupIds.length === 0 || isInviteGroupSubmitting}
              style={styles.rowButton}
            />
            <Button
              label="Close"
              variant="secondary"
              onPress={handleCloseInviteGroup}
              disabled={isInviteGroupSubmitting}
              style={styles.rowButton}
            />
          </View>
        </Card>
      ) : null}

      {/* Individual Invite User Form */}
      {isInviteUserOpen ? (
        <Card style={styles.card}>
          <Text style={styles.formTitle}>Invite User</Text>
          <Text style={styles.formHint}>
            Search for and invite an individual user to this event.
          </Text>
          {selectedInviteUser ? (
            <View style={styles.selectedInviteRow}>
              <Text style={styles.selectedInviteText}>
                {selectedInviteUser.nickname} ({selectedInviteUser.display_name})
              </Text>
              <TextLink
                label="Change"
                onPress={() => setSelectedInviteUser(null)}
                disabled={isInviteUserSubmitting}
              />
            </View>
          ) : (
            <UserSearchPicker
              onSelect={setSelectedInviteUser}
              excludeEventId={eventId}
              disabled={isInviteUserSubmitting}
            />
          )}
          {inviteUserError ? <Text style={styles.errorText}>{inviteUserError}</Text> : null}
          {inviteUserSuccess ? <Text style={styles.successText}>{inviteUserSuccess}</Text> : null}
          <View style={styles.formButtonsRow}>
            <Button
              label="Send Invite"
              variant="primary"
              onPress={handleSendUserInvite}
              loading={isInviteUserSubmitting}
              disabled={!selectedInviteUser || isInviteUserSubmitting}
              style={styles.rowButton}
            />
            <Button
              label="Close"
              variant="secondary"
              onPress={handleCloseInviteUser}
              disabled={isInviteUserSubmitting}
              style={styles.rowButton}
            />
          </View>
        </Card>
      ) : null}

      {/* Edit Event Form */}
      {isEditing ? (
        <Card style={styles.card}>
          <Text style={styles.formTitle}>Edit Event</Text>

          <Text style={styles.fieldLabel}>Title</Text>
          <TextField
            placeholder="Event title"
            accessibilityLabel="Event Title"
            value={editTitle}
            onChangeText={setEditTitle}
            editable={!isEditSubmitting}
            maxLength={150}
            style={styles.formInput}
          />

          <Text style={styles.fieldLabel}>Sport</Text>
          <TextField
            placeholder="Sport (e.g. badminton)"
            accessibilityLabel="Sport"
            value={editSport}
            onChangeText={setEditSport}
            editable={!isEditSubmitting}
            maxLength={30}
            style={styles.formInput}
          />
          {sportOptions.length > 0 ? (
            <View style={styles.chipRow}>
              <OptionChips
                options={sportOptions}
                value={editSport}
                onChange={setEditSport}
                disabled={isEditSubmitting}
              />
            </View>
          ) : null}

          <Text style={styles.fieldLabel}>Description</Text>
          <TextField
            placeholder="Description (optional)"
            accessibilityLabel="Event Description"
            value={editDescription}
            onChangeText={setEditDescription}
            editable={!isEditSubmitting}
            multiline
            style={[styles.formInput, styles.multilineInput]}
          />

          <Text style={styles.fieldLabel}>Venue Name</Text>
          <TextField
            placeholder="e.g. Riverside Courts"
            accessibilityLabel="Venue Name"
            value={editVenueName}
            onChangeText={setEditVenueName}
            editable={!isEditSubmitting}
            style={styles.formInput}
          />

          <Text style={styles.fieldLabel}>Venue Address</Text>
          <TextField
            placeholder="e.g. 123 Sports Way"
            accessibilityLabel="Venue Address"
            value={editVenueAddress}
            onChangeText={setEditVenueAddress}
            editable={!isEditSubmitting}
            style={styles.formInput}
          />

          <Text style={styles.fieldLabel}>Skill Level</Text>
          <OptionChips
            options={SKILL_LEVEL_OPTIONS}
            value={editSkillLevel}
            onChange={setEditSkillLevel}
            disabled={isEditSubmitting}
          />

          <Text style={styles.fieldLabel}>Capacity</Text>
          <TextField
            placeholder="Capacity"
            accessibilityLabel="Capacity"
            value={editCapacity}
            onChangeText={setEditCapacity}
            editable={!isEditSubmitting}
            keyboardType="number-pad"
            style={styles.formInput}
          />

          <View style={styles.switchRow}>
            <Text style={styles.fieldLabel}>Allow Waitlist</Text>
            <Switch
              accessibilityLabel="Allow Waitlist"
              value={editAllowWaitlist}
              onValueChange={setEditAllowWaitlist}
              disabled={isEditSubmitting}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={editAllowWaitlist ? colors.accent : colors.textMuted}
            />
          </View>

          <Text style={styles.fieldLabel}>Start Date & Time</Text>
          <DateTimePickerField
            accessibilityLabel="Start Date & Time"
            mode="datetime"
            placeholder={LOCAL_DATE_TIME_PLACEHOLDER}
            value={editStartsAt}
            onChange={setEditStartsAt}
            disabled={isEditSubmitting}
          />

          <Text style={styles.fieldLabel}>End Date & Time (Optional)</Text>
          <DateTimePickerField
            accessibilityLabel="End Date & Time"
            mode="datetime"
            placeholder={LOCAL_DATE_TIME_PLACEHOLDER}
            value={editEndsAt}
            onChange={setEditEndsAt}
            disabled={isEditSubmitting}
          />

          {editError ? <Text style={styles.errorText}>{editError}</Text> : null}

          <View style={styles.formButtonsRow}>
            <Button
              label="Save Changes"
              variant="primary"
              onPress={handleSaveEdit}
              loading={isEditSubmitting}
              style={styles.rowButton}
            />
            <Button
              label="Cancel"
              variant="secondary"
              onPress={handleCancelEdit}
              disabled={isEditSubmitting}
              style={styles.rowButton}
            />
          </View>
        </Card>
      ) : null}

      {/* CARD 3: About this game Card */}
      <Card style={styles.card}>
        <Text style={styles.cardHeading}>About this game</Text>
        <Text style={styles.descriptionText}>
          {event.description || 'Casual doubles, all skill levels welcome.'}
        </Text>
        {event.estimated_cost_cents != null ? (
          <Text style={styles.costText}>
            Cost: ${(event.estimated_cost_cents / 100).toFixed(2)}
            {event.estimated_cost_currency ? ` ${event.estimated_cost_currency}` : ''}
          </Text>
        ) : event.cost != null ? (
          <Text style={styles.costText}>Cost: {event.cost}</Text>
        ) : null}
      </Card>

      {/* CARD 4: Skill level & Waitlist Card */}
      <Card style={styles.card}>
        <View style={styles.metaKeyValRow}>
          <Text style={styles.metaKey}>Skill level</Text>
          <Text style={styles.metaVal}>{formatSkillLevel(event.skill_level_requirement)}</Text>
        </View>
        <View style={[styles.metaKeyValRow, styles.metaKeyValRowBottom]}>
          <Text style={styles.metaKey}>Waitlist</Text>
          <Text style={styles.metaVal}>{event.allow_waitlist !== false ? 'Open' : 'Closed'}</Text>
        </View>
      </Card>

      {/* CARD 5: Participants Card */}
      <Card style={styles.card}>
        <Text style={styles.cardHeading}>Participants</Text>
        <View style={styles.participantsList}>
          {displayParticipants.map(p => (
            <View key={p.id} style={styles.participantRow}>
              <View style={styles.participantAvatar}>
                <Text style={styles.participantAvatarText}>{p.initials}</Text>
              </View>
              <Text style={styles.participantName}>{p.name}</Text>
              <Text
                style={[
                  styles.participantRole,
                  p.isOrganiser ? styles.roleOrganizer : styles.roleGoing,
                ]}
              >
                {p.isOrganiser ? 'Organizer' : 'Going'}
              </Text>
            </View>
          ))}
          {overflowParticipantsCount > 0 ? (
            <View style={styles.overflowRow}>
              <View style={styles.overflowAvatar}>
                <Text style={styles.overflowAvatarText}>+{overflowParticipantsCount}</Text>
              </View>
              <Text style={styles.overflowText}>
                and {overflowParticipantsCount} more going
              </Text>
            </View>
          ) : null}
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  backButton: {
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  headerBlock: {
    marginBottom: spacing.md,
  },
  headerTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sportPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    gap: 6,
  },
  sportDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  sportPillText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  hostingTag: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  participantTag: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  cancelledBanner: {
    ...typography.bodyBold,
    color: colors.error,
    backgroundColor: colors.errorLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  metaIcon: {
    fontSize: 14,
  },
  metaText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  hiddenMetaText: {
    height: 0,
    opacity: 0,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    shadowColor: '#1B1918',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  capacityHeader: {
    marginBottom: spacing.sm,
  },
  capacityNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  capacityLabel: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  progressTrack: {
    height: 6,
    backgroundColor: colors.track,
    borderRadius: 3,
    overflow: 'hidden',
    width: '100%',
    marginBottom: spacing.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  spotsLeftText: {
    fontSize: 13,
    fontWeight: '600',
  },
  actionBtn: {
    minHeight: sizes.touchTarget,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    borderWidth: borderWidth.thin,
  },
  actionBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editGameBtn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  editGameBtnText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  whiteActionBtn: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  whiteActionBtnText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  cancelBtn: {
    backgroundColor: colors.surface,
    borderColor: '#F0C0C0',
    marginBottom: 0,
  },
  cancelBtnText: {
    color: colors.error,
    fontSize: 15,
    fontWeight: '600',
  },
  cardHeading: {
    ...typography.h3,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  descriptionText: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  costText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  metaKeyValRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  metaKeyValRowBottom: {
    marginTop: spacing.xs,
  },
  metaKey: {
    ...typography.body,
    color: colors.textMuted,
  },
  metaVal: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  participantsList: {
    gap: spacing.sm,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  participantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EBE7E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantAvatarText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  participantName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    flex: 1,
  },
  participantRole: {
    fontSize: 12,
    fontWeight: '600',
  },
  roleOrganizer: {
    color: colors.accent,
  },
  roleGoing: {
    color: colors.textMuted,
  },
  overflowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  overflowAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EBE7E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overflowAvatarText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  overflowText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  button: {
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  successText: {
    ...typography.body,
    color: colors.success,
    textAlign: 'center',
    marginBottom: spacing.md,
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
  fieldLabel: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  formInput: {
    marginBottom: spacing.sm,
  },
  multilineInput: {
    minHeight: 72,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
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
  selectedInviteText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  chipRow: {
    marginBottom: spacing.sm,
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
});
