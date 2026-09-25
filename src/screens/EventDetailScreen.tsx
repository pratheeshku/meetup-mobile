/**
 * Event Detail screen (DES-MEETUP-MOBILE.md §4.3; R-021, R-024, R-025).
 *
 * Role/permission gating here is UX-only (§3.10, §5.3, R-017/R-082) —
 * every gated action still calls its endpoint normally and the backend
 * remains the sole authority.
 *
 * Organiser detection: derived via `isOrganiserOf(event, currentUserId)`.
 * Organisers on non-cancelled, non-completed events have access to:
 * - Event Cancel (POST /events/{id}/cancel with required reason)
 * - Event Edit (PATCH /events/{id}, full field set matching EventUpdate schema)
 * - Event Group Invite (POST /events/{id}/invite-group with group_id)
 * - Event Individual Invite (POST /events/{id}/invite-user with user_id)
 *
 * Error handling: rejected-action errors (e.g. 409 from immutable visibility or
 * locked post-start edit) surface via `getApiErrorMessage(e, fallback)`.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  cancelEvent,
  getEvent,
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
import Badge from '../components/Badge';
import Button from '../components/Button';
import Card from '../components/Card';
import DateTimePickerField from '../components/DateTimePickerField';
import ErrorView from '../components/ErrorView';
import LoadingView from '../components/LoadingView';
import OptionChips, { ChipOption } from '../components/OptionChips';
import TextField from '../components/TextField';
import TextLink from '../components/TextLink';
import UserSearchPicker from '../components/UserSearchPicker';
import { borderWidth, colors, radius, spacing, typography } from '../theme/tokens';
import type { Event, EventSkillLevel, UpdateEventInput } from '../types/event';
import type { Group } from '../types/group';
import type { Sport } from '../types/sport';
import type { UserSearchResult } from '../types/user';
import type { HomeStackParamList } from '../navigation/types';
import { formatEventDate, formatEventTimeRange } from '../utils/formatEventDateTime';
import { formatLocalDateTime, LOCAL_DATE_TIME_PLACEHOLDER, parseLocalDateTime } from '../utils/localDateTime';
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

export default function EventDetailScreen({ route }: Props): React.JSX.Element {
  const { eventId } = route.params;
  const { user } = useAuth();

  const [event, setEvent] = useState<Event | null>(null);
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

  const loadEvent = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await getEvent(eventId);
      setEvent(data);
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
        setEvent(await getEvent(eventId, { correlationId }));
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
        setEvent(await getEvent(eventId, { correlationId }));
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

  // Organiser action: Invite User
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
  const isAtCapacity = event.participant_count >= event.capacity;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={styles.infoCard}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{event.title}</Text>
          {event.is_recurring ? (
            <Badge label="Recurring" variant="neutral" style={styles.recurringBadge} />
          ) : null}
        </View>

        {event.status === 'cancelled' ? (
          <Text style={styles.cancelledBanner}>This event has been cancelled.</Text>
        ) : null}

        <Text style={styles.meta}>
          {sportLabel} · {event.location}
        </Text>
        <Text style={styles.meta}>{formatEventDate(event.starts_at)}</Text>
        <Text style={styles.meta}>{formatEventTimeRange(event.starts_at, event.ends_at)}</Text>
        <Text style={styles.meta}>
          {event.participant_count}/{event.capacity} going
          {event.waitlist_count > 0 ? ` · ${event.waitlist_count} waitlisted` : ''}
        </Text>
        {event.estimated_cost_cents != null ? (
          <Text style={styles.meta}>
            Cost: ${(event.estimated_cost_cents / 100).toFixed(2)}
            {event.estimated_cost_currency ? ` ${event.estimated_cost_currency}` : ''}
          </Text>
        ) : event.cost != null ? (
          <Text style={styles.meta}>Cost: {event.cost}</Text>
        ) : null}

        <Text style={styles.description}>{event.description}</Text>
      </Card>

      {isAtCapacity ? (
        <Text style={styles.waitlistNotice}>
          This event is at capacity — new RSVPs join the waitlist.
        </Text>
      ) : null}

      {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}

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

      {/* Organiser Primary Action Triggers */}
      {isOrganiserActionsVisible && !isEditing && !isCancelFormOpen && !isInviteGroupOpen && !isInviteUserOpen ? (
        <View style={styles.organiserActionsContainer}>
          <Button
            label="Edit Event"
            variant="secondary"
            onPress={handleStartEdit}
            style={styles.button}
          />
          <Button
            label="Invite Group"
            variant="secondary"
            onPress={handleOpenInviteGroup}
            style={styles.button}
          />
          <Button
            label="Invite User"
            variant="secondary"
            onPress={handleOpenInviteUser}
            style={styles.button}
          />
          <Button
            label="Cancel Event"
            variant="destructive"
            onPress={handleOpenCancel}
            style={styles.button}
          />
        </View>
      ) : null}

      {/* BUILD 1: Cancel Event Form */}
      {isCancelFormOpen ? (
        <Card style={styles.formCard}>
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

      {/* BUILD 3: Invite Group Form */}
      {isInviteGroupOpen ? (
        <Card style={styles.formCard}>
          <Text style={styles.formTitle}>Invite Group</Text>
          <Text style={styles.formHint}>
            Select one of your groups to invite all its members to this event.
          </Text>
          {isGroupsLoading ? (
            <Text style={styles.formHint}>Loading groups...</Text>
          ) : myGroups.length === 0 ? (
            <Text style={styles.formHint}>You don't belong to any groups yet.</Text>
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
        <Card style={styles.formCard}>
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
        <Card style={styles.formCard}>
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
              thumbColor={editAllowWaitlist ? colors.primary : colors.textMuted}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md },
  infoCard: { marginBottom: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  title: { ...typography.h2, color: colors.textPrimary, flexShrink: 1 },
  recurringBadge: { marginLeft: spacing.sm },
  cancelledBanner: {
    ...typography.bodyBold,
    color: colors.error,
    backgroundColor: colors.errorLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  meta: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xs },
  description: { ...typography.body, color: colors.textPrimary, marginTop: spacing.md },
  waitlistNotice: {
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.warningLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
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
  button: { marginBottom: spacing.sm },
  organiserActionsContainer: { marginBottom: spacing.md },
  formCard: { marginBottom: spacing.md },
  formTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.xs },
  formHint: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
  fieldLabel: { ...typography.bodyBold, color: colors.textPrimary, marginTop: spacing.sm, marginBottom: spacing.xs },
  formInput: { marginBottom: spacing.sm },
  multilineInput: { minHeight: 72 },
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
