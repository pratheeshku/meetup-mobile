/**
 * Render tests for `EventCard` against the web-reference layout: pill tags
 * (sport, category, optional RSVP), two-line uppercase title, one inline
 * meta line whose empty segments drop with their icon, bordered container
 * with no elevation. Also guards WCAG AA for each pill colour pairing.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import { getSports } from '../../api/sports';
import EventCard, { buildMetaSegments } from '../EventCard';
import { borderWidth, colors, radius, spacing } from '../../theme/tokens';
import type { Event } from '../../types/event';

jest.mock('../../api/sports', () => ({ getSports: jest.fn() }));

const mockGetSports = getSports as jest.MockedFunction<typeof getSports>;

// `useSportDisplayName` (BUG-M02) resolves `sport` against this list, cached
// module-wide — warmed ONCE below (before any test) so every synchronous
// `render()` call in this file already sees the resolved 'Badminton', with
// no per-test async wait needed. Only 'badminton' (default) and '' (empty,
// no pill rendered) appear anywhere in this file's fixtures.
beforeAll(async () => {
  mockGetSports.mockResolvedValue([{ name: 'badminton', display_name: 'Badminton' }]);
  await ReactTestRenderer.act(async () => {
    ReactTestRenderer.create(<EventCard event={{ ...BASE_EVENT }} onPress={jest.fn()} />);
  });
});

const BASE_EVENT: Event = {
  id: 'evt-1',
  title: 'Friday night doubles',
  description: '',
  sport: 'badminton',
  location: 'Riverside Courts',
  starts_at: '2026-09-25T18:00:00Z',
  ends_at: '2026-09-25T20:00:00Z',
  capacity: 12,
  participant_count: 5,
  waitlist_count: 0,
  visibility: 'public',
  status: 'upcoming',
  organiser_id: 'u-1',
  organiser_nickname: 'org',
  is_recurring: false,
  cost: null,
  current_user_rsvp_status: 'none',
  is_organiser: false,
};

function relativeLuminance(hex: string): number {
  const channel = (start: number): number => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

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

/** Style of the nearest host View above a Text (the pill box). */
function pillBoxStyle(node: ReactTestRenderer.ReactTestInstance): Record<string, unknown> {
  let current = node.parent;
  while (current && (current.type as unknown) !== 'View') {
    current = current.parent;
  }
  return StyleSheet.flatten(current!.props.style) as Record<string, unknown>;
}

function textOf(node: ReactTestRenderer.ReactTestInstance): string {
  return node.children.join('');
}

describe('EventCard', () => {
  it('renders sport and category pills (uppercase, primary on primaryLight) then title then one meta line', () => {
    const t = texts(render());
    expect(t.map(textOf)).toEqual([
      'Badminton',
      'Public',
      'Friday night doubles',
      expect.stringContaining('📅'),
    ]);

    const pill = StyleSheet.flatten(t[0].props.style);
    expect(pill).toMatchObject({
      color: colors.primary,
      textTransform: 'uppercase',
      fontWeight: '700',
      fontSize: 12,
    });
    const pillBox = pillBoxStyle(t[0]);
    expect(pillBox).toMatchObject({
      backgroundColor: colors.primaryLight,
      borderRadius: radius.full,
      paddingVertical: 6,
      paddingHorizontal: 12,
    });
  });

  it('renders the title bold, uppercase, textPrimary, capped at two lines', () => {
    const title = texts(render())[2];
    expect(title.props.numberOfLines).toBe(2);
    expect(StyleSheet.flatten(title.props.style)).toMatchObject({
      fontWeight: '700',
      textTransform: 'uppercase',
      color: colors.textPrimary,
    });
  });

  it('labels each visibility as a category pill', () => {
    expect(texts(render({ visibility: 'group' })).map(textOf)).toContain('Group');
    expect(texts(render({ visibility: 'invite_only' })).map(textOf)).toContain('Private');
  });

  describe('RSVP pill', () => {
    it('going → success pill as a third tag in row 1', () => {
      const t = texts(render({ current_user_rsvp_status: 'going' }));
      expect(t.slice(0, 3).map(textOf)).toEqual(['Badminton', 'Public', 'Going']);
      expect(StyleSheet.flatten(t[2].props.style).color).toBe(colors.success);
      expect(pillBoxStyle(t[2]).backgroundColor).toBe(colors.successLight);
    });

    it('waitlisted → warning pill (textPrimary on warningLight)', () => {
      const t = texts(render({ current_user_rsvp_status: 'waitlisted' }));
      expect(textOf(t[2])).toBe('Waitlisted');
      expect(StyleSheet.flatten(t[2].props.style).color).toBe(colors.textPrimary);
      expect(pillBoxStyle(t[2]).backgroundColor).toBe(colors.warningLight);
    });

    it.each(['none', 'withdrawn'] as const)('%s → no RSVP pill at all', status => {
      const t = texts(render({ current_user_rsvp_status: status })).map(textOf);
      expect(t).toHaveLength(4);
      expect(t).not.toContain('None');
      expect(t).not.toContain('Going');
      expect(t).not.toContain('Waitlisted');
    });
  });

  describe('meta line', () => {
    it('is a single Text with icon-prefixed segments joined by " · "', () => {
      const meta = textOf(texts(render())[3]);
      const segments = meta.split(' · ');
      expect(segments).toHaveLength(3);
      expect(segments[0].startsWith('📅 ')).toBe(true);
      expect(segments[0]).toContain(', ');
      expect(segments[1]).toBe('📍 Riverside Courts');
      expect(segments[2]).toBe('👤 5/12');
    });

    it('omits the location segment and its icon when location is empty', () => {
      const meta = textOf(texts(render({ location: '' }))[3]);
      expect(meta).not.toContain('📍');
      expect(meta.split(' · ')).toHaveLength(2);
      expect(meta).not.toMatch(/·\s*·/);
      expect(meta.endsWith('·')).toBe(false);
    });

    it('never renders a skill-level segment (Event has no such field)', () => {
      expect(textOf(texts(render())[3])).not.toContain('🎯');
    });

    it('shows start time only, no dash or "Invalid Date", when ends_at is null', () => {
      const segments = buildMetaSegments({ ...BASE_EVENT, ends_at: null });
      expect(segments[0]).not.toContain('–');
      expect(segments[0]).not.toContain('Invalid');
    });
  });

  it('omits the sport pill (not an empty pill) when sport is empty', () => {
    const t = texts(render({ sport: '' })).map(textOf);
    expect(t.slice(0, 2)).toEqual(['Public', 'Friday night doubles']);
  });

  it('falls back to the raw sport slug for a sport not in GET /admin/sports/public (BUG-M02)', () => {
    const t = texts(render({ sport: 'unlisted_sport' })).map(textOf);
    expect(t[0]).toBe('unlisted_sport');
  });

  describe('container', () => {
    it('is a 1px border card with no elevation/shadow, radius.md, spacing.md padding and margin', () => {
      const renderer = render();
      const pressable = renderer.root.findAll(
        node => node.props.accessibilityRole === 'button' && node.props.onPress,
      )[0];
      const style = StyleSheet.flatten(
        typeof pressable.props.style === 'function'
          ? pressable.props.style({ pressed: false })
          : pressable.props.style,
      );
      expect(style).toMatchObject({
        backgroundColor: colors.surface,
        borderWidth: borderWidth.thin,
        borderColor: colors.border,
        borderRadius: radius.md,
        padding: spacing.md,
        marginBottom: spacing.md,
        elevation: 0,
        shadowOpacity: 0,
      });
    });

    it('calls onPress when pressed', () => {
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

  describe('pill contrast (WCAG AA 4.5:1)', () => {
    const PAIRS: Array<[string, string, string]> = [
      ['tag', colors.primary, colors.primaryLight],
      ['success', colors.success, colors.successLight],
      ['warning', colors.textPrimary, colors.warningLight],
    ];
    it.each(PAIRS)('%s pill text on its background', (_name, text, background) => {
      expect(contrastRatio(text, background)).toBeGreaterThanOrEqual(4.5);
    });
  });
});
