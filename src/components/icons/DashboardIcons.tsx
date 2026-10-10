/**
 * Dashboard icon set — ONE module (DES-MEETUP-ADDENDUM-dashboard.md AD-2,
 * Appendix A and B). Geometry and colours are ported verbatim from the
 * appendix SVGs (viewBox 0 0 48 48; banner 0 0 390 208) to
 * `react-native-svg` elements. No emoji, no raster images, no icon font.
 *
 * Sport glyphs are chosen by the API's `icon_key`, case-insensitively.
 * An unknown or missing key uses the neutral ball. The keys below are glyph
 * ids an admin can assign; they are not a list of sports.
 *
 * All icons are decorative: they are hidden from screen readers; the text
 * next to them carries the meaning.
 */
import React from 'react';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import { SwimmingIcon, VolleyballIcon } from './SharedIcons';

export interface IconProps {
  size?: number;
}

const VIEWBOX = '0 0 48 48';

function Frame({ size = 24, children }: IconProps & { children: React.ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox={VIEWBOX}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {children}
    </Svg>
  );
}

export function BadmintonIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Path
        d="M17 33L9 9c6-3 24-3 30 0l-8 24z"
        fill="#FFFFFF"
        stroke="#64748B"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <Path d="M20.5 33L15.5 9M24 33V7M27.5 33L32.5 9" stroke="#94A3B8" strokeWidth={1.4} />
      <Path d="M10.5 14c8.5-2.4 18.5-2.4 27 0" stroke="#94A3B8" strokeWidth={1.4} fill="none" />
      <Ellipse cx={24} cy={37.5} rx={7.5} ry={6} fill="#EF4444" />
      <Path d="M17 34.5h14" stroke="#B91C1C" strokeWidth={1.4} />
    </Frame>
  );
}

export function BasketballIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Circle cx={24} cy={24} r={20} fill="#F97316" />
      <Path d="M24 4v40M4 24h40" stroke="#7C2D12" strokeWidth={2} />
      <Path
        d="M9.5 9.5c7 5 7 24 0 29M38.5 9.5c-7 5-7 24 0 29"
        stroke="#7C2D12"
        strokeWidth={2}
        fill="none"
      />
      <Circle cx={24} cy={24} r={20} fill="none" stroke="#7C2D12" strokeWidth={2} />
    </Frame>
  );
}

export function FootballIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Circle cx={24} cy={24} r={20} fill="#FFFFFF" stroke="#1F2937" strokeWidth={2} />
      <Path d="M24 15l8 5.8-3 9.4H19l-3-9.4z" fill="#1F2937" />
      <Path
        d="M24 15V6M32 20.8l8.5-2.8M29 30.2l5.3 7.2M19 30.2l-5.3 7.2M16 20.8l-8.5-2.8"
        stroke="#1F2937"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path d="M18.5 5.5L24 4l5.5 1.5L28 10h-8z" fill="#1F2937" />
      <Path d="M5 18l4.5-3.5 3.5 4-1.5 5.5H5.2z" fill="#1F2937" />
      <Path d="M43 18l-4.5-3.5-3.5 4 1.5 5.5h5.8z" fill="#1F2937" />
    </Frame>
  );
}

export function TennisIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Circle cx={24} cy={24} r={20} fill="#D9F04A" />
      <Path
        d="M7 12c8 4 8 20 0 24M41 12c-8 4-8 20 0 24"
        stroke="#FFFFFF"
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
      />
      <Circle cx={24} cy={24} r={20} fill="none" stroke="#A3B825" strokeWidth={1.5} />
    </Frame>
  );
}

export function AllSportsIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Rect x={6} y={6} width={16} height={16} rx={4} fill="#3B82F6" />
      <Rect x={26} y={6} width={16} height={16} rx={4} fill="#22C55E" />
      <Rect x={6} y={26} width={16} height={16} rx={4} fill="#F97316" />
      <Rect x={26} y={26} width={16} height={16} rx={4} fill="#A855F7" />
    </Frame>
  );
}

export function FallbackBallIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Circle cx={24} cy={24} r={20} fill="#94A3B8" />
      <Path d="M4.5 20c12 5 27 5 39 0" stroke="#FFFFFF" strokeWidth={2.5} fill="none" />
      <Circle cx={24} cy={24} r={20} fill="none" stroke="#64748B" strokeWidth={1.5} />
    </Frame>
  );
}

export function HomeIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Path d="M9 23l15-13 15 13v17H9z" fill="#FDE68A" />
      <Path
        d="M5 25L24 8l19 17"
        stroke="#DC2626"
        strokeWidth={5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Rect x={20} y={28} width={8} height={12} rx={2} fill="#B45309" />
      <Rect x={12} y={27} width={6} height={6} rx={1} fill="#60A5FA" />
      <Rect x={30} y={27} width={6} height={6} rx={1} fill="#60A5FA" />
    </Frame>
  );
}

export function GroupsIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Circle cx={32} cy={15} r={6} fill="#EC4899" />
      <Path d="M21 39c0-6.5 4.5-10.5 11-10.5s11 4 11 10.5z" fill="#EC4899" />
      <Circle cx={18} cy={17} r={7} fill="#6366F1" />
      <Path d="M5 40c0-8 5.5-12.5 13-12.5S31 32 31 40z" fill="#6366F1" />
    </Frame>
  );
}

export function GamesIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Path
        d="M12 14h24a9 9 0 0 1 9 9v6a7 7 0 0 1-12 5l-4-4H19l-4 4a7 7 0 0 1-12-5v-6a9 9 0 0 1 9-9z"
        fill="#334155"
      />
      <Path d="M15 20v8M11 24h8" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" />
      <Circle cx={33} cy={21} r={2.4} fill="#F87171" />
      <Circle cx={38} cy={26} r={2.4} fill="#4ADE80" />
      <Circle cx={28} cy={26} r={2.4} fill="#FACC15" />
      <Circle cx={33} cy={31} r={2.4} fill="#60A5FA" />
    </Frame>
  );
}

export function ProfileIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Circle cx={24} cy={16} r={8} fill="#F59E0B" />
      <Path d="M8 43c0-9.5 7-15 16-15s16 5.5 16 15z" fill="#0EA5E9" />
    </Frame>
  );
}

type IconComponent = (props: IconProps) => React.JSX.Element;

/**
 * Bundled glyphs an admin `icon_key` can select. Not a catalogue of sports.
 */
export const ICON_GLYPHS: Record<string, IconComponent> = {
  badminton: BadmintonIcon,
  basketball: BasketballIcon,
  football: FootballIcon,
  tennis: TennisIcon,
  volleyball: VolleyballIcon,
  swimming: SwimmingIcon,
};

/** Normalised icon_key / sport key. */
export function sportSlug(slug: string | null | undefined): string {
  return (slug ?? '').trim().toLowerCase();
}

export function hasSportIcon(iconKey: string | null | undefined): boolean {
  return Object.prototype.hasOwnProperty.call(ICON_GLYPHS, sportSlug(iconKey));
}

export function SportIcon({
  iconKey,
  size,
}: IconProps & { iconKey?: string | null }): React.JSX.Element {
  const key = sportSlug(iconKey);
  const Icon = Object.prototype.hasOwnProperty.call(ICON_GLYPHS, key)
    ? ICON_GLYPHS[key]
    : FallbackBallIcon;
  return <Icon size={size} />;
}

/**
 * Appendix B: banner background, viewBox 0 0 390 208, decorative. Drawn
 * with `preserveAspectRatio="xMidYMid slice"` so it fills (and is clipped
 * by) the banner at any phone width.
 */
export function BannerBackground({
  width,
  height,
}: {
  width: number | string;
  height: number | string;
}): React.JSX.Element {
  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 390 208"
      preserveAspectRatio="xMidYMid slice"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Circle cx={340} cy={40} r={120} fill="#3B82F6" fillOpacity={0.45} />
      <Circle cx={385} cy={170} r={70} fill="#93C5FD" fillOpacity={0.25} />
      <Circle cx={-10} cy={208} r={110} fill="#0B3FA8" fillOpacity={0.4} />
      <G
        stroke="#FFFFFF"
        strokeOpacity={0.2}
        strokeWidth={1.5}
        fill="none"
        transform="rotate(-16 285 110)"
      >
        <Rect x={205} y={30} width={160} height={200} rx={6} />
        <Path d="M205 96h160" />
        <Path d="M205 164h160" />
        <Path d="M285 30v66M285 164v66" />
      </G>
    </Svg>
  );
}
