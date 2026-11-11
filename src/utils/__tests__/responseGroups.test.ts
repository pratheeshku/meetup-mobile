/** T2 (data level): the Responses groups follow the §3 order (GV-4, GV-P1, AD-1). */
import type { ResponsePerson, ResponsesResponse } from '../../types/event';
import type { TournamentRegistration } from '../../types/tournament';
import {
  groupGameResponses,
  groupTournamentResponses,
  invitedPeople,
  isActiveRegistration,
  isRegisteredRegistration,
  registeredCount,
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
const reg = (
  id: string,
  userId: string | null,
  status: TournamentRegistration['status'] = 'registered',
  extra: Partial<TournamentRegistration> = {},
): TournamentRegistration => ({
  id,
  user_id: userId,
  nickname: id,
  registered_at: '2999-01-01T00:00:00Z',
  status,
  ...extra,
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

describe('groupTournamentResponses (AD-1, Registered = every registration with status "registered")', () => {
  it('an accepted invitee who is also registered appears once, under Registered, with their response details', () => {
    const groups = groupTournamentResponses(responses(), [reg('r-1', 'u-1'), reg('r-2', 'u-2')]);
    expect(groups.registered.map(x => x.display_name)).toEqual(['Alice', 'Bob']);
    expect(groups.registered[1].waitlisted).toBe(true);
    expect(groups.acceptedNotRegistered.map(x => x.display_name)).toEqual(['Pratheesh']);
    const everyone = [...groups.registered, ...groups.acceptedNotRegistered].map(x => x.user_id);
    expect(new Set(everyone).size).toBe(everyone.length);
    expect(groups.declined.map(x => x.display_name)).toEqual(['Ravi']);
    expect(groups.pending).toHaveLength(2);
  });

  it('a team registration (team_id set, user_id null) is a Registered row labelled by the team name', () => {
    const groups = groupTournamentResponses(responses(), [reg('r-team', null, 'registered', { team_id: 't-1', nickname: 'Net Ninjas' })]);
    expect(groups.registered).toHaveLength(1);
    expect(groups.registered[0]).toMatchObject({ user_id: null, display_name: 'Net Ninjas' });
    expect(groups.acceptedNotRegistered).toHaveLength(3);
  });

  it('a person who registered without an invitation is a Registered row (the report: "3 of 32 registered" but "No one yet")', () => {
    const regs = [reg('r-1', 'u-walk', 'registered', { nickname: 'Walk In' }), reg('r-2', null, 'registered', { team_id: 't-1', nickname: 'Team A' }), reg('r-3', 'u-x', 'registered', { nickname: 'Xin' })];
    const groups = groupTournamentResponses(responses({ accepted: section([]) }), regs);
    expect(groups.registered.map(x => x.display_name)).toEqual(['Walk In', 'Team A', 'Xin']);
    expect(groups.registered).toHaveLength(registeredCount(regs));
  });

  it('an accepted invitee with no registration stays under "Accepted, not yet registered"', () => {
    const groups = groupTournamentResponses(responses(), [reg('r-1', 'u-1')]);
    expect(groups.registered.map(x => x.display_name)).toEqual(['Alice']);
    expect(groups.acceptedNotRegistered.map(x => x.display_name)).toEqual(['Pratheesh', 'Bob']);
  });

  it('a withdrawn registration shows nowhere under Registered, and a "none" row neither', () => {
    const groups = groupTournamentResponses(responses(), [reg('r-1', 'u-1', 'withdrawn'), reg('r-t', null, 'withdrawn', { team_id: 't-1' }), reg('r-n', 'u-n', 'none')]);
    expect(groups.registered).toEqual([]);
    expect(groups.acceptedNotRegistered).toHaveLength(3);
    expect(isActiveRegistration(reg('r-1', 'u-1', 'withdrawn'))).toBe(false);
  });

  it('the header count and the Registered list come from one rule: registeredCount === registered.length', () => {
    const regs = [
      reg('r-1', 'u-1'),
      reg('r-2', null, 'registered', { team_id: 't-1', nickname: 'Net Ninjas' }),
      reg('r-3', 'u-9', 'registered', { nickname: 'Walk In' }),
      reg('r-4', 'u-2', 'withdrawn'),
      reg('r-5', 'u-8', 'none'),
    ];
    expect(registeredCount(regs)).toBe(3);
    expect(groupTournamentResponses(responses(), regs).registered).toHaveLength(registeredCount(regs));
    expect(isRegisteredRegistration(regs[3])).toBe(false);
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
