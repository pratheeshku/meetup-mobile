/**
 * Grouping of the organizer's responses listing (DES-MEETUP-ADDENDUM-game-view-redesign GV-4, GV-P1,
 * AD-1). Pure: it only reorders and splits what the server returned and never recomputes a count the
 * server owns.
 *
 * - Game: Accepted (the organizer first), Declined, Pending.
 * - Tournament: Registered (accepted people who also appear in the registrations list), Accepted but
 *   not yet registered, Declined, Pending.
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
    declined: responses.declined.items,
    pending: responses.pending.items,
  };
}

/** A registration that still counts (the list can carry withdrawn rows). */
export function isActiveRegistration(
  registration: TournamentRegistration,
): boolean {
  return registration.status !== 'withdrawn';
}

export function groupTournamentResponses(
  responses: ResponsesResponse,
  registrations: readonly TournamentRegistration[],
): TournamentResponseGroups {
  const registeredIds = new Set(
    registrations
      .filter(isActiveRegistration)
      .map(registration => registration.user_id)
      .filter((id): id is string => Boolean(id)),
  );
  const registered: ResponsePerson[] = [];
  const acceptedNotRegistered: ResponsePerson[] = [];
  for (const person of responses.accepted.items) {
    if (person.user_id && registeredIds.has(person.user_id)) {
      registered.push(person);
    } else {
      acceptedNotRegistered.push(person);
    }
  }
  return {
    registered,
    acceptedNotRegistered,
    declined: responses.declined.items,
    pending: responses.pending.items,
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
    declined: responses.declined.items.filter(keep),
    pending: responses.pending.items.filter(keep),
  };
}
