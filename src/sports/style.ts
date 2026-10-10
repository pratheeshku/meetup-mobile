/**
 * Colour treatment for one sport, derived only from the colour the sports
 * API returns. A missing or unreadable colour uses the neutral palette —
 * never a per-sport table.
 */

export const NEUTRAL_SPORT_TINT = '#64748B';
export const NEUTRAL_SPORT_CHIP = '#E2E8F0';
export const NEUTRAL_SPORT_SHADOW = 'rgba(15, 23, 42, 0.12)';

export interface SportPalette {
  /** The sport colour, used for filled accents. */
  tint: string;
  /** Light background mixed from the same colour. */
  chip: string;
  /** Shadow colour mixed from the same colour. */
  shadow: string;
}

const NEUTRAL_PALETTE: SportPalette = {
  tint: NEUTRAL_SPORT_TINT,
  chip: NEUTRAL_SPORT_CHIP,
  shadow: NEUTRAL_SPORT_SHADOW,
};

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function parseHex(input: string): Rgb | null {
  const hex = input.trim().replace(/^#/, '');
  const full = hex.length === 3 ? hex.split('').map(channel => channel + channel).join('') : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    return null;
  }
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function toHex(value: number): string {
  return value.toString(16).padStart(2, '0');
}

/** Mix `amount` of white into `rgb` (0 = the colour, 1 = white). */
function mixWhite(rgb: Rgb, amount: number): string {
  const channel = (value: number): number => Math.round(value + (255 - value) * amount);
  return `#${toHex(channel(rgb.r))}${toHex(channel(rgb.g))}${toHex(channel(rgb.b))}`;
}

export function sportPalette(color: string | null | undefined): SportPalette {
  if (!color) {
    return NEUTRAL_PALETTE;
  }
  const trimmed = color.trim();
  const rgb = parseHex(trimmed);
  if (!rgb) {
    return NEUTRAL_PALETTE;
  }
  const tint = /^#[0-9a-fA-F]{6}$/.test(trimmed)
    ? trimmed
    : `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
  return {
    tint,
    chip: mixWhite(rgb, 0.85),
    shadow: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.28)`,
  };
}
