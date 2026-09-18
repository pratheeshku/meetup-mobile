/**
 * Design tokens — the single source of every colour, spacing, radius,
 * type-scale, shadow and fixed-size value used by the UI layer.
 *
 * Palette is matched to the web app (meetups.duckdns.org), extracted from
 * its computed styles. Screens and components must import from here rather
 * than hardcoding hex colours or sizing numbers.
 *
 * Provenance: DES-MEETUP-MOBILE.md (T1) has no styling/theming
 * requirement, so this file traces to the user-directed "design system
 * foundation" task, not to a design section / R-ID.
 *
 * The first five exports (`colors`, `spacing`, `radius`, `typography`,
 * `shadows`) are exactly as specified by that task, with one additive
 * `typography.label` member. Everything under "Additive tokens" exists
 * only so the screens contain no remaining magic numbers; none of the
 * specified values were altered.
 *
 * Contrast notes (WCAG 2.x, measured — not asserted):
 * - `textMuted` on `surface` is 2.92:1 and on `background` 2.65:1, i.e. it
 *   FAILS AA for body-size text. It is used only where the task specifies
 *   it (inactive tab tint) and for non-text UI; never for readable copy or
 *   placeholders (`textSecondary`, 5.35:1 on `surface`, is used there).
 * - `warning` on `warningLight` is 2.47:1 (fail), so warning badges use
 *   `textPrimary` text on `warningLight` instead (15.4:1).
 */

export const colors = {
  primary: '#1565C0',
  primaryDark: '#0D47A1',
  primaryLight: '#E3F2FD',
  background: '#F0F4FF',
  surface: '#FFFFFF',
  textPrimary: '#0D1B3E',
  textSecondary: '#5C6B8A',
  textMuted: '#8B97B5',
  border: '#E0E6F5',
  success: '#2E7D32',
  successLight: '#E8F5E9',
  warning: '#F57C00',
  warningLight: '#FFF3E0',
  error: '#C62828',
  errorLight: '#FFEBEE',
  white: '#FFFFFF',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 999,
};

export const typography = {
  h1: { fontSize: 28, fontWeight: '700' as const },
  h2: { fontSize: 22, fontWeight: '700' as const },
  h3: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyBold: { fontSize: 15, fontWeight: '600' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  button: { fontSize: 16, fontWeight: '600' as const },
  /** Additive: badge / small-label text (was an ad hoc 12px/600 on screens). */
  label: { fontSize: 12, fontWeight: '600' as const },
};

export const shadows = {
  card: {
    shadowColor: '#0D1B3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
};

// ---------------------------------------------------------------------------
// Additive tokens (not in the task's specified list — see file header).
// ---------------------------------------------------------------------------

export const borderWidth = {
  thin: 1,
  thick: 2,
};

export const opacity = {
  /** Same dimming the screens already used for disabled controls. */
  disabled: 0.6,
  pressed: 0.85,
};

export const sizes = {
  /** Android minimum recommended touch target (48dp). */
  touchTarget: 48,
  /** Compact control height (inline / row-level buttons). */
  controlSmall: 40,
  avatar: 88,
  emptyStateIcon: 72,
  emptyStateIconInner: 24,
};
