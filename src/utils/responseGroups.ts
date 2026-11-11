/**
 * Grouping of the organizer's responses listing (DES-MEETUP-ADDENDUM-game-view-redesign GV-4, GV-P1,
 * AD-1). Pure: it only reorders and splits what the server returned and never recomputes a count the
 * server owns.
 *
 * - Game: Accepted (the organizer first), Declined, Pending.
 * - Tournament: Registered, Accepted but not yet registered, Declined, Pending.
 *
 * Tournament Registered (architect decision, a deliberate change to GV-4): every registration whose status
 * is `registered`, one row per registration, from the registrations list the screen already loads. A team
 * entry (`team_id` set, `user_id` null) is labelled by its name (the registration's `nickname`, which the
 * client maps from `participant_name`); a person is labelled by their display name from the accepted
 * invitees when they are one, else by the registration's name. The header count uses `registeredCount`, the
 * same status rule, so the number and the list cannot differ. The denominator is never computed here.
 */
import type { ResponsePerson, ResponsesResponse } from '../types/event';
import type { TournamentRegistration } from '../types/tournament';

export interface GameResponseGroups {
  accepted: ResponsePerson[];
  declined: ResponsePerson[];
  pending: ResponsePerson[];
}

export interface TournamentResponseGroups {
  registered: ResponsePerson[];
  acceptedNotRegistered: ResponsePerson[];
  declined: ResponsePerson[];
  pending: ResponsePerson[];
}

/** The organizer goes first; everyone else keeps the server's order. */
export function groupGameResponses(
  responses: ResponsesResponse,
  organizerId: string | null | undefined,
): GameResponseGroups {
  const accepted = [...responses.accepted.items];
  if (organizerId) {
    const index = accepted.findIndex(person => person.user_id === organizerId);
    if (index > 0) {
      accepted.unshift(accepted.splice(index, 1)[0]);
    }
  }
  return {
    accepted,
    declined: responses.declined?.items ?? [],
    pending: responses.pending?.items ?? [],
  };
}

/** A registration that still counts (the list can carry withdrawn rows). Not the Registered rule: see `isRegisteredRegistration`. */
export function isActiveRegistration(
  registration: TournamentRegistration,
): boolean {
  return registration.status !== 'withdrawn';
}

/** The one rule for "registered", same as the backend `registered_count`: status is `registered`. */
export function isRegisteredRegistration(
  registration: TournamentRegistration,
): boolean {
  return registration.status === 'registered';
}

/** The header numerator ("x of y registered"): the length of the Registered list, by the same rule. */
export function registeredCount(registrations: readonly TournamentRegistration[]): number {
  return registrations.filter(isRegisteredRegistration).length;
}

export function groupTournamentResponses(
  responses: ResponsesResponse,
  registrations: readonly TournamentRegistration[],
): TournamentResponseGroups {
  const registeredRows = registrations.filter(isRegisteredRegistration);
  const acceptedById = new Map<string, ResponsePerson>();
  for (const person of responses.accepted.items) {
    if (person.user_id) {
      acceptedById.set(person.user_id, person);
    }
  }
  const registered: ResponsePerson[] = registeredRows.map(
    registration =>
      (registration.user_id ? acceptedById.get(registration.user_id) : undefined) ?? {
        user_id: registration.user_id,
        display_name: registration.nickname,
      },
  );
  // Accepted invitees with no registered row stay "not yet registered"; one who is registered shows once, under Registered.
  const registeredUserIds = new Set(
    registeredRows.map(registration => registration.user_id).filter((id): id is string => Boolean(id)),
  );
  const acceptedNotRegistered = responses.accepted.items.filter(
    person => !(person.user_id && registeredUserIds.has(person.user_id)),
  );
  return {
    registered,
    acceptedNotRegistered,
    declined: responses.declined?.items ?? [],
    pending: responses.pending?.items ?? [],
  };
}

export interface InvitedPeople {
  accepted: ResponsePerson[];
  declined: ResponsePerson[];
  pending: ResponsePerson[];
}

/** People of the Invited sheet (GV-3): the responses listing without the organizer, by response. */
export function invitedPeople(
  responses: ResponsesResponse,
  excludeUserId?: string | null,
): InvitedPeople {
  const keep = (person: ResponsePerson): boolean =>
    !excludeUserId || person.user_id !== excludeUserId;
  return {
    accepted: responses.accepted.items.filter(keep),
    declined: (responses.declined?.items ?? []).filter(keep),
    pending: (responses.pending?.items ?? []).filter(keep),
  };
}
