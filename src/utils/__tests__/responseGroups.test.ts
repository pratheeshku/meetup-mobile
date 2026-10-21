/** T2 (data level): the Responses groups follow the §3 order (GV-4, GV-P1, AD-1). */
import type { ResponsePerson, ResponsesResponse } from '../../types/event';
import type { TournamentRegistration } from '../../types/tournament';
import {
  groupGameResponses,
  groupTournamentResponses,
  invitedPeople,
  isActiveRegistration,
} from '../responseGroups';

const p = (id: string | null, name: string, extra: Partial<ResponsePerson> = {}): ResponsePerson => ({
  user_id: id,
  display_name: name,
  ...extra,
});
const section = (items: ResponsePerson[]) => ({ total: items.length, items });
const responses = (over: Partial<ResponsesResponse> = {}): ResponsesResponse => ({
  accepted: section([p('u-1', 'Alice'), p('u-org', 'Pratheesh'), p('u-2', 'Bob', { waitlisted: true })]),
  pending: section([p('u-3', 'Sam'), p(null, '', { email: 'friend@example.com' })]),
  declined: section([p('u-4', 'Ravi', { via: 'invitation' })]),
  ...over,
});
const reg = (id: string, userId: string | null, status: TournamentRegistration['status'] = 'registered'): TournamentRegistration => ({
  id,
  user_id: userId,
  nickname: id,
  registered_at: '2999-01-01T00:00:00Z',
  status,
});

describe('groupGameResponses', () => {
  it('puts the organizer first in Accepted and keeps the rest in server order', () => {
    const groups = groupGameResponses(responses(), 'u-org');
    expect(groups.accepted.map(x => x.display_name)).toEqual(['Pratheesh', 'Alice', 'Bob']);
  });

  it('leaves the order alone when the organizer is not among the accepted or unknown', () => {
    expect(groupGameResponses(responses(), 'nobody').accepted.map(x => x.display_name)).toEqual(['Alice', 'Pratheesh', 'Bob']);
    expect(groupGameResponses(responses(), null).accepted.map(x => x.display_name)).toEqual(['Alice', 'Pratheesh', 'Bob']);
  });

  it('does not mutate the response it was given', () => {
    const input = responses();
    groupGameResponses(input, 'u-org');
    expect(input.accepted.items.map(x => x.display_name)).toEqual(['Alice', 'Pratheesh', 'Bob']);
  });

  it('returns declined and pending as the server sent them', () => {
    const groups = groupGameResponses(responses(), 'u-org');
    expect(groups.declined.map(x => x.display_name)).toEqual(['Ravi']);
    expect(groups.pending).toHaveLength(2);
  });
});

describe('groupTournamentResponses (AD-1)', () => {
  it('Registered is accepted ∩ registrations; the rest of accepted is "not yet registered"', () => {
    const groups = groupTournamentResponses(responses(), [reg('r-1', 'u-1'), reg('r-2', 'u-2')]);
    expect(groups.registered.map(x => x.display_name)).toEqual(['Alice', 'Bob']);
    expect(groups.acceptedNotRegistered.map(x => x.display_name)).toEqual(['Pratheesh']);
    expect(groups.declined.map(x => x.display_name)).toEqual(['Ravi']);
    expect(groups.pending).toHaveLength(2);
  });

  it('a withdrawn registration does not count as registered', () => {
    const groups = groupTournamentResponses(responses(), [reg('r-1', 'u-1', 'withdrawn')]);
    expect(groups.registered).toEqual([]);
    expect(groups.acceptedNotRegistered).toHaveLength(3);
    expect(isActiveRegistration(reg('r-1', 'u-1', 'withdrawn'))).toBe(false);
    expect(isActiveRegistration(reg('r-1', 'u-1'))).toBe(true);
  });

  it('a registration without a user id never matches a person', () => {
    const groups = groupTournamentResponses(responses(), [reg('r-team', null)]);
    expect(groups.registered).toEqual([]);
  });
});

describe('invitedPeople (Invited sheet)', () => {
  it('lists people by response without the organizer', () => {
    const people = invitedPeople(responses(), 'u-org');
    expect(people.accepted.map(x => x.display_name)).toEqual(['Alice', 'Bob']);
    expect(people.declined.map(x => x.display_name)).toEqual(['Ravi']);
    expect(people.pending).toHaveLength(2);
  });
});
