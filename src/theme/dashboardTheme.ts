/**
 * Dashboard theme tokens — the single module for the colours, radii and
 * sizes of the redesigned Home and Games screens
 * (DES-MEETUP-ADDENDUM-dashboard.md §5 "Tokens", P1).
 *
 * Kept separate from `tokens.ts` on purpose: the addendum specifies its own
 * blue palette, and repointing the shared palette would restyle every other
 * screen (out of scope — display-only change on Home/Games).
 */

export const dash = {
  brand: '#1E5BD6',
  brandDeep: '#0B3FA8',
  brandLight: '#3B82F6',
  page: '#F5F8FF',
  card: '#FFFFFF',
  cardBorder: '#E3EAF8',
  text: '#0F2350',
  textMuted: '#5B6B8C',
  navInactive: '#64748B',
  badgeRed: '#DC2626',
  goingBg: '#DCFCE7',
  goingText: '#166534',
  white: '#FFFFFF',
  /** Neutral skeleton block. */
  skeleton: '#E3EAF8',
} as const;

/** Sport tile background colours, keyed by lower-case slug. */
export const sportTileColors: Record<string, string> = {
  badminton: '#DBEAFE',
  basketball: '#FFEDD5',
  football: '#DCFCE7',
  tennis: '#EDE9FE',
  all: '#F1F5F9',
  fallback: '#E2E8F0',
};

export const dashRadius = {
  card: 20,
  nextGameCard: 22,
  tile: 20,
  sportTile: 20,
  chip: 20,
  bannerBottom: 32,
  brandIcon: 12,
  rowTile: 14,
  circle: 999,
} as const;

export const dashSize = {
  bannerHeight: 208,
  /** How far the next-game card overlaps the banner. */
  nextGameOverlap: 40,
  brandIcon: 52,
  avatar: 48,
  avatarRing: 2,
  touchTarget: 44,
  sportTile: 60,
  sportIcon: 38,
  sportLabel: 11,
  rowIconTile: 44,
  rowIcon: 28,
  navIcon: 30,
  navLabel: 11,
  chipRing: 2,
} as const;

/**
 * Phone brand block (AD-17): the single constant for the wordmark, tagline
 * and their colours. The wordmark renders as `wordmarkLead` in white followed
 * by `wordmarkAccent` in `accent`.
 */
export const brandBlock = {
  accessibilityLabel: 'Shuttlr',
  wordmarkLead: 'Shuttl',
  wordmarkAccent: 'r',
  tagline: 'PLAY TOGETHER',
  accent: '#FDE68A',
  taglineColor: '#DBEAFE',
} as const;
