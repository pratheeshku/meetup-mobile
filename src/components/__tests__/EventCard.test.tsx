/**
 * Render tests for `EventCard` against the mobile artboard layout:
 * - Sport pill tag with circular icon dot & sport-specific color
 * - Status label top-right ("Hosting", "Waitlisted", "X left", "Open")
 * - Event title
 * - Date and venue with middle dot
 * - Avatar stack with initials + capacity count ("7/8")
 * - Action link with arrow ("Manage →", "View →", "Join →")
 * - Progress bar colored with sport color
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import { getSports } from '../../api/sports';
import EventCard from '../EventCard';
import type { Event } from '../../types/event';
import { colors } from '../../theme/tokens';

jest.mock('../../api/sports', () => ({ getSports: jest.fn() }));

const mockUser: { current: { id: string } | null } = { current: { id: 'user-me' } };
jest.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: mockUser.current }),
}));

const mockGetSports = getSports as jest.MockedFunction<typeof getSports>;

beforeAll(async () => {
  mockGetSports.mockResolvedValue([
    { name: 'badminton', display_name: 'Badminton', icon_key: 'badminton', color: '#2A7B72' },
    { name: 'football', display_name: 'Football', icon_key: 'football', color: '#835C2B' },
    { name: 'basketball', display_name: 'Basketball', icon_key: 'basketball', color: '#67509B' },
    { name: 'tennis', display_name: 'Tennis', icon_key: 'tennis', color: '#A54362' },
  ]);
  await ReactTestRenderer.act(async () => {
    ReactTestRenderer.create(<EventCard event={{ ...BASE_EVENT }} onPress={jest.fn()} />);
  });
});

beforeEach(() => {
  mockUser.current = { id: 'user-me' };
});

const BASE_EVENT: Event = {
  id: 'evt-1',
  title: 'Sunday Morning Doubles',
  description: '',
  sport: 'badminton',
  location: 'Punggol Sports Hall',
  venue_name: 'Punggol Sports Hall',
  venue_address: 'Court 3',
  starts_at: '2026-09-27T09:00:00Z',
  ends_at: '2026-09-27T11:00:00Z',
  capacity: 8,
  participant_count: 7,
  waitlist_count: 0,
  visibility: 'public',
  status: 'upcoming',
  organiser_id: 'org-1',
  organiser_nickname: 'PK',
  is_recurring: false,
  cost: null,
  current_user_rsvp_status: 'none',
  is_organiser: false,
};

function render(overrides: Partial<Event> = {}): ReactTestRenderer.ReactTestRenderer {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <EventCard event={{ ...BASE_EVENT, ...overrides }} onPress={jest.fn()} />,
    );
  });
  return renderer;
}

function texts(renderer: ReactTestRenderer.ReactTestRenderer): ReactTestRenderer.ReactTestInstance[] {
  return renderer.root.findAll(node => (node.type as unknown) === 'Text');
}

function textOf(node: ReactTestRenderer.ReactTestInstance): string {
  return node.children.join('');
}

describe('EventCard', () => {
  it('renders sport pill, status, title, date/venue, capacity, and action link', () => {
    const t = texts(render()).map(textOf);
    expect(t).toContain('Badminton');
    expect(t).toContain('Sunday Morning Doubles');
    expect(t).toContain('7/8');
    expect(t).toContain('Join');
  });

  describe('Sport tag pill and color palette', () => {
    it('uses badminton teal (#2A7B72) for badminton', () => {
      const renderer = render({ sport: 'badminton' });
      const views = renderer.root.findAll(
        node =>
          (node.type as unknown) === 'View' &&
          StyleSheet.flatten(node.props.style)?.backgroundColor === '#2A7B72',
      );
      // Both the sport pill and the progress bar fill use the sport color
      expect(views.length).toBe(2);
    });

    it('uses basketball purple (#67509B) for basketball', () => {
      const renderer = render({ sport: 'basketball' });
      const views = renderer.root.findAll(
        node =>
          (node.type as unknown) === 'View' &&
          StyleSheet.flatten(node.props.style)?.backgroundColor === '#67509B',
      );
      expect(views.length).toBe(2);
    });

    it('uses tennis berry (#A54362) for tennis', () => {
      const renderer = render({ sport: 'tennis' });
      const views = renderer.root.findAll(
        node =>
          (node.type as unknown) === 'View' &&
          StyleSheet.flatten(node.props.style)?.backgroundColor === '#A54362',
      );
      expect(views.length).toBe(2);
    });
  });

  describe('Status label and Action link states', () => {
    it('shows "Hosting" and "Manage →" when current user is the organiser', () => {
      const renderer = render({ organiser_id: 'user-me' });
      const t = texts(renderer).map(textOf);
      expect(t).toContain('Hosting');
      expect(t).toContain('Manage');
    });

    it('shows "Waitlisted" and "View →" when current user is waitlisted', () => {
      const renderer = render({ current_user_rsvp_status: 'waitlisted' });
      const t = texts(renderer).map(textOf);
      expect(t).toContain('Waitlisted');
      expect(t).toContain('View');
    });

    it('shows "1 left" and "View →" when user joined and 1 spot remains', () => {
      const renderer = render({
        current_user_rsvp_status: 'going',
        capacity: 8,
        participant_count: 7,
      });
      const t = texts(renderer).map(textOf);
      expect(t).toContain('1 left');
      expect(t).toContain('View');
    });

    it('shows "Open" and "Join →" when user is not joined and capacity has space', () => {
      const renderer = render({
        current_user_rsvp_status: 'none',
        capacity: 10,
        participant_count: 2,
      });
      const t = texts(renderer).map(textOf);
      expect(t).toContain('Open');
      expect(t).toContain('Join');
    });
  });

  describe('Avatar stack', () => {
    it('renders initials and overflow badge for multiple participants', () => {
      const renderer = render({ participant_count: 7, organiser_nickname: 'PK' });
      const t = texts(renderer).map(textOf);
      expect(t).toContain('PK');
      expect(t).toContain('RS');
      expect(t).toContain('+5');
    });

    it('renders single avatar circle when participant count is 1', () => {
      const renderer = render({ participant_count: 1, organiser_nickname: 'PK' });
      const t = texts(renderer).map(textOf);
      expect(t).toContain('PK');
      expect(t).not.toContain('RS');
      expect(t).not.toContain('+5');
    });
  });

  describe('Progress bar', () => {
    it('calculates progress percentage and sets sport color fill', () => {
      const renderer = render({ sport: 'badminton', capacity: 10, participant_count: 5 });
      const fills = renderer.root.findAll(
        node =>
          (node.type as unknown) === 'View' &&
          StyleSheet.flatten(node.props.style)?.backgroundColor === '#2A7B72' &&
          StyleSheet.flatten(node.props.style)?.width === '50%',
      );
      expect(fills.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('contrast (WCAG AA 4.5:1)', () => {
    function contrastRatio(a: string, b: string): number {
      const channel = (hex: string, start: number): number => {
        const value = parseInt(hex.slice(start, start + 2), 16) / 255;
        return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
      };
      const lum = (hex: string): number =>
        0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    }

    // The artboard card no longer paints the old primary/success/warningLight
    // pills. These are the pairs it paints now; each measured >= 4.5:1.
    const PAIRS: Array<[string, string, string]> = [
      ['sport label on badminton', colors.white, '#2A7B72'],
      ['sport label on football', colors.white, '#835C2B'],
      ['sport label on basketball', colors.white, '#67509B'],
      ['sport label on tennis', colors.white, '#A54362'],
      ['title on the card', colors.textPrimary, colors.surface],
      ['date on the card', colors.textMuted, colors.surface],
      ['initials on the avatar', colors.textSecondary, '#EBE7E0'],
      ['action on the card', colors.accent, colors.surface],
      ['waitlisted status on the card', '#67509B', colors.surface],
    ];

    it.each(PAIRS)('%s', (_name, text, background) => {
      expect(contrastRatio(text, background)).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe('Interaction', () => {
    it('calls onPress when the card is pressed', () => {
      const onPress = jest.fn();
      let renderer!: ReactTestRenderer.ReactTestRenderer;
      ReactTestRenderer.act(() => {
        renderer = ReactTestRenderer.create(<EventCard event={BASE_EVENT} onPress={onPress} />);
      });
      const pressable = renderer.root.findAll(
        node => node.props.accessibilityRole === 'button' && node.props.onPress,
      )[0];
      ReactTestRenderer.act(() => pressable.props.onPress());
      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });
});
