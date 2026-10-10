/**
 * `sport` DOES have a backend display field — but only on
 * `GET /admin/sports/public` (`Sport.display_name`, distinct from the raw
 * `name`/slug), not on the `Event`/`Tournament` responses that embed a bare
 * `sport` string with no paired display value of their own. `CreateGameScreen`
 * already renders `Sport.display_name` directly where it fetches that list
 * itself — no fix needed there. Everywhere else (`EventCard`,
 * `EventDetailScreen`, `TournamentDetailScreen`, `TournamentsScreen`,
 * `ProfileScreen`'s skill-levels list) only has the raw slug, so
 * `useSportDisplayName` below resolves it against the same sports list,
 * fetched once and cached module-wide (not per-render, not per-screen) —
 * reusing `getSports()` (`api/sports.ts`) rather than duplicating its
 * fetch logic, per this task's explicit instruction.
 *
 * This file previously (BUG-M02) also carried hardcoded `skill_level` and
 * `*_visibility` label maps. Those had no backend display field at the
 * time; they've since been replaced by the shared `GET /api/labels`
 * endpoint — see `src/labels/LabelsContext.tsx` (`useLabels()`/`getLabel()`)
 * and `src/api/labels.ts`. `sport`'s own display field (`display_name`,
 * above) is unaffected — a separate mechanism, out of scope for that fix.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';

import { invalidateSportsCatalog, useSportRecord } from '../sports/catalog';
import type { LabelMap } from '../api/labels';
import { GlobeIcon, GroupsIcon, LockIcon } from '../components/icons/SharedIcons';
import { getLabel } from '../labels/LabelsContext';
import type { EventVisibility } from '../types/event';

/**
 * Resolves a raw `sport` slug to its admin `display_name` from the shared
 * sports catalog (`GET /admin/sports/public`). The catalog is fetched at most
 * once until `invalidateSportsCatalog()` replaces it.
 */
export function useSportDisplayName(sport: string): string {
  const record = useSportRecord(sport);
  return record?.display_name ?? sport;
}

/** Test-only: clears the shared sports catalog so each test controls its own fetch. */
export function __resetSportDisplayNamesCacheForTests(): void {
  invalidateSportsCatalog();
}

/**
 * Removes leading or trailing emoji/pictographs, arrows (← → ↗),
 * variation selectors, and surrounding whitespace from a label
 * before it is rendered next to an icon. Never touches letters,
 * digits, or placeholders like {email}.
 */
export function stripIconGlyphs(text: string): string {
  if (typeof text !== 'string') {
    return '';
  }
  const leadingGlyphs =
    /^(?:[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}\u{FE0E}\u{FE0F}\u{200D}\u{20E3}\s]+)/u;
  const trailingGlyphs =
    /(?:[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}\u{FE0E}\u{FE0F}\u{200D}\u{20E3}\s]+)$/u;
  return text.replace(leadingGlyphs, '').replace(trailingGlyphs, '').trim();
}

/**
 * Returns formatted event visibility label (without emojis):
 *   {getLabel(labels, 'event_visibility.public')}
 *   {getLabel(labels, 'event_visibility.invite_only')}
 *   {getLabel(labels, 'event_visibility.group')}
 */
export function getEventVisibilityLabel(
  visibility: EventVisibility | string | undefined,
  labels: LabelMap,
): string {
  switch (visibility) {
    case 'invite_only':
      return stripIconGlyphs(getLabel(labels, 'event_visibility.invite_only'));
    case 'group':
      return stripIconGlyphs(getLabel(labels, 'event_visibility.group'));
    case 'public':
    default:
      return stripIconGlyphs(getLabel(labels, 'event_visibility.public'));
  }
}

/**
 * Returns the matching shared icon for an event visibility setting.
 */
export function getEventVisibilityIcon(
  visibility: EventVisibility | string | undefined,
  size = 18,
): React.ReactElement {
  switch (visibility) {
    case 'invite_only':
      return React.createElement(LockIcon, { size });
    case 'group':
      return React.createElement(GroupsIcon, { size });
    case 'public':
    default:
      return React.createElement(GlobeIcon, { size });
  }
}

/**
 * Renders the visibility badge with a SharedIcon and localized label.
 */
export function EventVisibilityBadge({
  visibility,
  labels,
  size = 18,
  textStyle,
}: {
  visibility: EventVisibility | string | undefined;
  labels: LabelMap;
  size?: number;
  textStyle?: StyleProp<TextStyle>;
}): React.ReactElement {
  return React.createElement(
    View,
    { style: visibilityBadgeStyles.row },
    React.createElement(
      View,
      {
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no',
        'aria-hidden': true,
        style: visibilityBadgeStyles.icon,
      },
      getEventVisibilityIcon(visibility, size),
    ),
    React.createElement(
      Text,
      { style: textStyle },
      getEventVisibilityLabel(visibility, labels),
    ),
  );
}

const visibilityBadgeStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 6,
  },
});

