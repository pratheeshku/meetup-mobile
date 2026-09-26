/**
 * Unit tests for `GroupCard` (Item 1 — visual parity with EventCard):
 * - Row 1: Role pill (Owner/Admin/Member) with rounded/colored-bg/white-text
 *   reusing ROLE_BADGE_VARIANT mapping (primary -> colors.primary, neutral -> colors.textSecondary)
 * - Row 2: Group name (h3/700)
 * - Row 3: Description (1 line, textMuted; if empty, fall back to blank)
 * - Row 4: "{member_count} members" left, "View →" action link right (accent, 700)
 * - No progress-bar row
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import GroupCard, {
  ROLE_BADGE_LABEL,
  ROLE_BADGE_VARIANT,
  getRolePillColor,
} from '../GroupCard';
import { colors } from '../../theme/tokens';
import type { Group } from '../../types/group';

const BASE_GROUP: Group = {
  id: 'grp-1',
  name: 'North Badminton Club',
  description: 'Weekly badminton sessions for intermediate players',
  owner_id: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  current_user_role: 'member',
  member_count: 12,
};

function renderCard(overrides: Partial<Group> = {}, onPress = jest.fn()): ReactTestRenderer.ReactTestRenderer {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <GroupCard group={{ ...BASE_GROUP, ...overrides }} onPress={onPress} />,
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

describe('GroupCard', () => {
  it('renders role pill, group name, description, member count, and View → action link', () => {
    const renderer = renderCard();
    const t = texts(renderer).map(textOf);
    expect(t).toContain('Member');
    expect(t).toContain('North Badminton Club');
    expect(t).toContain('Weekly badminton sessions for intermediate players');
    expect(t).toContain('12 members');
    expect(t).toContain('View →');
  });

  describe('Row 1: Role pill', () => {
    it('maps owner to primary variant and colors.primary background with white text', () => {
      expect(ROLE_BADGE_VARIANT.owner).toBe('primary');
      expect(ROLE_BADGE_LABEL.owner).toBe('Owner');
      expect(getRolePillColor('owner')).toBe(colors.primary);

      const renderer = renderCard({ current_user_role: 'owner' });
      const t = texts(renderer).map(textOf);
      expect(t).toContain('Owner');

      // Find the role pill View
      const pillView = renderer.root.findAll(
        node =>
          (node.type as unknown) === 'View' &&
          StyleSheet.flatten(node.props.style)?.backgroundColor === colors.primary,
      );
      expect(pillView.length).toBeGreaterThanOrEqual(1);
    });

    it('maps admin to primary variant and colors.primary background', () => {
      expect(ROLE_BADGE_VARIANT.admin).toBe('primary');
      expect(ROLE_BADGE_LABEL.admin).toBe('Admin');
      expect(getRolePillColor('admin')).toBe(colors.primary);

      const renderer = renderCard({ current_user_role: 'admin' });
      const t = texts(renderer).map(textOf);
      expect(t).toContain('Admin');
    });

    it('maps member to neutral variant and colors.textSecondary background', () => {
      expect(ROLE_BADGE_VARIANT.member).toBe('neutral');
      expect(ROLE_BADGE_LABEL.member).toBe('Member');
      expect(getRolePillColor('member')).toBe(colors.textSecondary);

      const renderer = renderCard({ current_user_role: 'member' });
      const t = texts(renderer).map(textOf);
      expect(t).toContain('Member');
    });

    it('pill text is white and 600 weight', () => {
      const renderer = renderCard({ current_user_role: 'owner' });
      const roleTextNode = renderer.root.find(
        node => (node.type as unknown) === 'Text' && textOf(node) === 'Owner',
      );
      const flattenedStyle = Object.assign(
        {},
        ...(Array.isArray(roleTextNode.props.style)
          ? roleTextNode.props.style
          : [roleTextNode.props.style]),
      );
      expect(flattenedStyle.color).toBe(colors.white);
      expect(flattenedStyle.fontWeight).toBe('600');
    });
  });

  describe('Row 2: Group name', () => {
    it('renders group name with h3 and 700 weight', () => {
      const renderer = renderCard({ name: 'Champions United' });
      const nameNode = renderer.root.find(
        node => (node.type as unknown) === 'Text' && textOf(node) === 'Champions United',
      );
      const flattenedStyle = Object.assign(
        {},
        ...(Array.isArray(nameNode.props.style)
          ? nameNode.props.style
          : [nameNode.props.style]),
      );
      expect(flattenedStyle.fontWeight).toBe('700');
    });
  });

  describe('Row 3: Description', () => {
    it('renders description with textMuted color', () => {
      const renderer = renderCard({ description: 'A fun group for casual runs' });
      const descNode = renderer.root.find(
        node => (node.type as unknown) === 'Text' && textOf(node) === 'A fun group for casual runs',
      );
      const flattenedStyle = Object.assign(
        {},
        ...(Array.isArray(descNode.props.style)
          ? descNode.props.style
          : [descNode.props.style]),
      );
      expect(flattenedStyle.color).toBe(colors.textMuted);
    });

    it('falls back to blank when description is empty or missing', () => {
      const renderer = renderCard({ description: '' });
      const descNode = renderer.root.findAll(
        node =>
          (node.type as unknown) === 'Text' &&
          StyleSheet.flatten(node.props.style)?.color === colors.textMuted,
      );
      expect(descNode.length).toBe(0);
    });
  });

  describe('Row 4: Member count and Action link', () => {
    it('formats singular member count as "1 member"', () => {
      const renderer = renderCard({ member_count: 1 });
      const t = texts(renderer).map(textOf);
      expect(t).toContain('1 member');
    });

    it('formats plural member count as "N members"', () => {
      const renderer = renderCard({ member_count: 25 });
      const t = texts(renderer).map(textOf);
      expect(t).toContain('25 members');
    });

    it('handles undefined member_count gracefully', () => {
      const renderer = renderCard({ member_count: undefined });
      const t = texts(renderer).map(textOf);
      expect(t).toContain('View →');
    });

    it('renders action link with accent color and 700 weight', () => {
      const renderer = renderCard();
      const actionNode = renderer.root.find(
        node => (node.type as unknown) === 'Text' && textOf(node) === 'View →',
      );
      const flattenedStyle = Object.assign(
        {},
        ...(Array.isArray(actionNode.props.style)
          ? actionNode.props.style
          : [actionNode.props.style]),
      );
      expect(flattenedStyle.color).toBe(colors.accent);
      expect(flattenedStyle.fontWeight).toBe('700');
    });
  });

  describe('No progress-bar row', () => {
    it('does not render any progress track or bar', () => {
      const renderer = renderCard();
      const progressTrack = renderer.root.findAll(
        node =>
          (node.type as unknown) === 'View' &&
          Array.isArray(node.props.style) &&
          node.props.style.some(
            (s: Record<string, unknown> | undefined) =>
              s?.backgroundColor === colors.track,
          ),
      );
      expect(progressTrack.length).toBe(0);
    });
  });

  describe('Interactivity', () => {
    it('calls onPress when the card is pressed', () => {
      const onPress = jest.fn();
      const renderer = renderCard({}, onPress);
      const pressable = renderer.root.findByProps({ accessibilityRole: 'button' });
      ReactTestRenderer.act(() => {
        pressable.props.onPress();
      });
      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });
});
