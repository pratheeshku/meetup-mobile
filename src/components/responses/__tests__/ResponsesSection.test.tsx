import React from 'react';
import { act, render, texts } from '../../../test-utils/render';
import type { Instance } from '../../../test-utils/render';
import { useUserMenu } from '../../../hooks/useUserMenu';
import UserMenuSheet from '../../user/UserMenuSheet';
import ResponsesSection from '../ResponsesSection';
import type { ResponsesResponse } from '../../../types/event';
import type { TournamentRegistration } from '../../../types/tournament';

jest.mock('../../../api/events', () => ({ getEventPlayerCard: jest.fn(), removeEventPlayer: jest.fn() }));
jest.mock('../../../api/groups', () => ({
  getGroupMemberCard: jest.fn(),
  removeMember: jest.fn(),
  transferGroupOwnership: jest.fn(),
  updateMemberRole: jest.fn(),
}));

describe('ResponsesSection', () => {
  const mockResponses: ResponsesResponse = {
    accepted: {
      total: 2,
      items: [
        { user_id: 'u1', display_name: 'Alice', photo_url: null, waitlisted: false },
        { user_id: 'u2', display_name: 'Bob', photo_url: null, waitlisted: true },
      ],
    },
    pending: {
      total: 2,
      items: [
        { user_id: 'u3', display_name: 'Charlie', email: 'charlie@example.com' },
        { user_id: null, display_name: '', email: 'unclaimed@example.com' },
      ],
    },
    declined: {
      total: 3,
      items: [
        { user_id: 'u4', display_name: 'David', via: 'invitation' },
        { user_id: 'u5', display_name: 'Eve', via: 'public' },
        { user_id: 'u6', display_name: 'Frank', via: 'joined' },
      ],
    },
  };

  it('renders null when responses is null', () => {
    const root = render(<ResponsesSection responses={null} />);
    expect(texts(root)).toEqual([]);
  });

  it('renders all 3 sections with totals and names', () => {
    const root = render(<ResponsesSection responses={mockResponses} />);
    const content = texts(root).join(' ');

    expect(content).toContain('Responses');
    expect(content).toContain('Accepted');
    expect(content).toContain('Pending');
    expect(content).toContain('Declined');

    // Names
    expect(content).toContain('Alice');
    expect(content).toContain('Bob');
    expect(content).toContain('Charlie');
    expect(content).toContain('unclaimed@example.com');
    expect(content).toContain('David');
    expect(content).toContain('Eve');
    expect(content).toContain('Frank');

    // Tags
    expect(content).toContain('Waitlisted');
    expect(content).toContain('Invited');
    expect(content).toContain('Public');
    expect(content).toContain('Joined');
  });

  it('renders empty messages when sections are empty', () => {
    const emptyResponses: ResponsesResponse = {
      accepted: { total: 0, items: [] },
      pending: { total: 0, items: [] },
      declined: { total: 0, items: [] },
    };

    const root = render(<ResponsesSection responses={emptyResponses} />);
    const content = texts(root).join(' ');

    expect(content).toContain('No one yet');
    expect(content).toContain('No one has declined');
  });
});

const rows = (root: Instance, section: string): string[] =>
  root
    .findAll(n => typeof n.type === 'string' && String(n.props.testID ?? '').startsWith(`${section}-row-`))
    .map(n => String(n.props.testID));
/** The section titles in on-screen order. */
const sectionOrder = (root: Instance): string[] =>
  root
    .findAll(n => typeof n.type === 'string' && String(n.props.testID ?? '').startsWith('responses-section-'))
    .map(n => String(n.props.testID).replace('responses-section-', ''));

describe('ResponsesSection (game-view-redesign GV-4, GV-P1)', () => {
  const game: ResponsesResponse = {
    accepted: {
      total: 3,
      items: [
        { user_id: 'u-1', display_name: 'Arun Raj', photo_url: null },
        { user_id: 'u-org', display_name: 'Pratheesh', photo_url: null },
        { user_id: 'u-3', display_name: 'Kavya D', photo_url: null, waitlisted: true },
      ],
    },
    pending: { total: 1, items: [{ user_id: null, display_name: '', email: 'friend@example.com' }] },
    declined: { total: 1, items: [{ user_id: 'u-4', display_name: 'Ravi N', via: 'invitation' }] },
  };

  it('T2: game groups read Accepted, Declined, Pending (Declined above Pending)', () => {
    const root = render(<ResponsesSection responses={game} organizerId="u-org" />);
    expect(sectionOrder(root)).toEqual(['accepted', 'declined', 'pending']);
  });

  it('shows the summary right of the "Responses" header', () => {
    const root = render(<ResponsesSection responses={game} summary="5 of 8 joined" />);
    expect(texts(root)).toEqual(expect.arrayContaining(['Responses', '5 of 8 joined']));
  });

  it('puts the organizer first with the Organizer badge, and flags the waitlisted', () => {
    const root = render(<ResponsesSection responses={game} organizerId="u-org" />);
    const accepted = root.find(n => n.props.testID === 'responses-section-accepted' && typeof n.type === 'string');
    const names = texts(accepted).filter(x => ['Arun Raj', 'Pratheesh', 'Kavya D'].includes(x));
    expect(names).toEqual(['Pratheesh', 'Arun Raj', 'Kavya D']);
    expect(texts(accepted)).toEqual(expect.arrayContaining(['Organizer', 'Waitlisted']));
  });

  it('a pending email invite reads "email"; a decline keeps its Invited tag', () => {
    const root = render(<ResponsesSection responses={game} />);
    expect(texts(root)).toEqual(expect.arrayContaining(['friend@example.com', 'email', 'Invited']));
  });

  it('shows a nickname after the display name when the host knows it', () => {
    const root = render(<ResponsesSection responses={game} nicknames={{ 'u-1': 'Arun' }} />);
    expect(texts(root)).toEqual(expect.arrayContaining(['Arun Raj', 'Arun']));
  });

  it('T2: tournament groups read Registered, Accepted not yet registered, Declined, Pending (AD-1)', () => {
    const registrations: TournamentRegistration[] = [
      { id: 'r-1', user_id: 'u-1', nickname: 'Arun', registered_at: '2999-01-01T00:00:00Z', status: 'registered' },
    ];
    const root = render(
      <ResponsesSection responses={game} entity="tournament" registrations={registrations} summary="1 of 16 registered" />,
    );
    expect(sectionOrder(root)).toEqual(['registered', 'accepted_not_registered', 'declined', 'pending']);
    expect(rows(root, 'registered')).toHaveLength(1);
    expect(rows(root, 'accepted_not_registered')).toHaveLength(2);
    expect(texts(root)).toEqual(
      expect.arrayContaining(['Registered', 'Accepted, not yet registered', '1 of 16 registered']),
    );
  });

  it('T5/GV-4: a person row with a menu opens the combined pop-up carrying the response badge', async () => {
    function Host(): React.JSX.Element {
      const menu = useUserMenu({ context: { type: 'none' } });
      return (
        <>
          <ResponsesSection responses={game} organizerId="u-org" menu={menu} />
          <UserMenuSheet menu={menu} />
        </>
      );
    }
    const root = render(<Host />);
    const ravi = root.find(n => n.props.testID === 'response-person-u-4' && typeof n.props.onPress === 'function');
    await act(async () => ravi.props.onPress());
    expect(root.findAll(n => n.props.testID === 'user-menu-details').length).toBeGreaterThan(0);
    const badge = root.find(n => n.props.testID === 'user-menu-badge' && typeof n.type === 'string');
    expect(texts(badge)).toEqual(['Declined']);
    // A pending email invite has no user to open.
    expect(root.findAll(n => String(n.props.testID ?? '').startsWith('response-person-friend'))).toHaveLength(0);
  });
});

