/**
 * Sport glyphs for the shared icon library (backend repo `pratheeshku/meetup`,
 * `icons/manifest.json` + `icons/svg/<key>.svg`, main @ b1c9d27). Geometry and
 * colours are ported verbatim from the source SVGs (viewBox 0 0 48 48), as
 * `react-native-svg` elements: the literal colours are the ones drawn in those
 * SVGs. Registered in `ICON_GLYPHS` (DashboardIcons.tsx). The 7 glyphs that
 * already existed (badminton, basketball, football, tennis, volleyball,
 * swimming, sport-marker) are not redefined here.
 *
 * Generated mechanically from the SVGs; edit the SVGs upstream, not this file.
 * All glyphs are decorative and hidden from screen readers.
 */
import React from 'react';
import Svg, { Circle, Ellipse, Path, Polygon, Rect } from 'react-native-svg';

export interface SportGlyphProps {
  size?: number;
}
type IconProps = SportGlyphProps;

function Frame({ size = 24, children }: IconProps & { children: React.ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {children}
    </Svg>
  );
}

export function CyclingIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Circle cx="12" cy="33" r="7" fill="none" stroke="#1F2937" strokeWidth="2.5" />
      <Circle cx="36" cy="33" r="7" fill="none" stroke="#1F2937" strokeWidth="2.5" />
      <Path d="M12 33L21 33L28 21L36 33M21 33L18 22M16 22H22" fill="none" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="30" cy="11" r="4" fill="#F59E0B" />
      <Path d="M29 16 L22 24" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M29 17 L34 22" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M22 24 L27 33" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function WalkingIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Circle cx="24" cy="9" r="4" fill="#F59E0B" />
      <Path d="M24 14 L24 28" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 28 L17 41" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 28 L32 40" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 18 L17 25" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 18 L31 25" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M6 42H42" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function RunningIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Circle cx="30" cy="9" r="4" fill="#F59E0B" />
      <Path d="M28 14 L23 26" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M23 26 L14 30 L10 41" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M23 26 L33 34 L36 42" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M27 17 L35 21" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M27 17 L19 21 L14 16" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 16h6M2 24h8" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function HikingIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Polygon points="4,42 17,16 30,42" fill="#BBF7D0" />
      <Polygon points="20,42 32,20 44,42" fill="#9CA3AF" />
      <Circle cx="18" cy="10" r="4" fill="#F59E0B" />
      <Path d="M18 15 L18 28" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M18 28 L13 40" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M18 28 L24 40" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M18 19 L25 24" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Rect x="11" y="16" width="6" height="11" rx="2" fill="#DC2626" />
      <Path d="M25 24L30 44" fill="none" stroke="#B45309" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function YogaIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Circle cx="24" cy="8" r="4" fill="#F59E0B" />
      <Path d="M24 13 L24 27" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 27 L24 40" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 27 L33 31 L26 34" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 17 L17 10" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 17 L31 10" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Rect x="8" y="41" width="32" height="3" rx="1.5" fill="#7C3AED" />
    </Frame>
  );
}

export function FitnessIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Rect x="4" y="20" width="5" height="8" rx="1.5" fill="#1F2937" />
      <Rect x="10" y="16" width="6" height="16" rx="2" fill="#1F2937" />
      <Rect x="16" y="22" width="16" height="4" rx="2" fill="#9CA3AF" />
      <Rect x="32" y="16" width="6" height="16" rx="2" fill="#1F2937" />
      <Rect x="39" y="20" width="5" height="8" rx="1.5" fill="#1F2937" />
    </Frame>
  );
}

export function DanceIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Circle cx="22" cy="8" r="4" fill="#F59E0B" />
      <Path d="M22 13 L24 26" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 26 L18 40" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 26 L31 36 L34 42" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M22 17 L14 11" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M22 17 L32 20" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M38 8v10" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="36" cy="19" r="3" fill="#DC2626" />
      <Path d="M38 8l5 2" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function PickleballIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Polygon points="28.5,13.5 29.6,16.0 30.2,18.6 30.2,21.2 29.6,23.7 28.5,26.0 27.0,27.9 25.0,29.4 22.7,30.4 20.3,30.7 17.8,30.6 15.3,29.8 13.0,28.5 11.0,26.7 9.5,24.5 8.4,22.0 7.8,19.4 7.8,16.8 8.4,14.3 9.5,12.0 11.0,10.1 13.0,8.6 15.3,7.6 17.7,7.3 20.2,7.4 22.7,8.2 25.0,9.5 27.0,11.3" fill="#38BDF8" stroke="#1F2937" strokeWidth="2.5" strokeLinejoin="round" />
      <Path d="M25 29L35 42" fill="none" stroke="#1F2937" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="36" cy="12" r="5" fill="#FDE68A" stroke="#1F2937" strokeWidth="2" />
      <Circle cx="34.5" cy="11" r="1" fill="#1F2937" />
      <Circle cx="37.5" cy="12" r="1" fill="#1F2937" />
      <Circle cx="36" cy="14.5" r="1" fill="#1F2937" />
    </Frame>
  );
}

export function PadelIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Rect x="10" y="6" width="20" height="24" rx="10" fill="#7C3AED" />
      <Circle cx="16" cy="13" r="1.6" fill="#FFFFFF" />
      <Circle cx="24" cy="13" r="1.6" fill="#FFFFFF" />
      <Circle cx="20" cy="18" r="1.6" fill="#FFFFFF" />
      <Circle cx="16" cy="23" r="1.6" fill="#FFFFFF" />
      <Circle cx="24" cy="23" r="1.6" fill="#FFFFFF" />
      <Path d="M20 30V43" fill="none" stroke="#1F2937" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="38" cy="32" r="5" fill="#FDE68A" stroke="#1F2937" strokeWidth="2" />
    </Frame>
  );
}

export function BowlingIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Circle cx="17" cy="29" r="12" fill="#0284C7" />
      <Circle cx="13" cy="24" r="1.8" fill="#1F2937" />
      <Circle cx="18" cy="22" r="1.8" fill="#1F2937" />
      <Circle cx="18" cy="27" r="1.8" fill="#1F2937" />
      <Polygon points="34,14 38,14 39,26 33,26" fill="#FFFFFF" stroke="#1F2937" strokeWidth="2" strokeLinejoin="round" />
      <Rect x="33" y="26" width="6" height="2" rx="0" fill="#DC2626" />
      <Polygon points="40,24 44,24 45,36 39,36" fill="#FFFFFF" stroke="#1F2937" strokeWidth="2" strokeLinejoin="round" />
      <Rect x="39" y="36" width="6" height="2" rx="0" fill="#DC2626" />
    </Frame>
  );
}

export function DartsIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Circle cx="22" cy="26" r="16" fill="#FFFFFF" stroke="#1F2937" strokeWidth="2" />
      <Circle cx="22" cy="26" r="11" fill="#DC2626" />
      <Circle cx="22" cy="26" r="6" fill="#FFFFFF" />
      <Circle cx="22" cy="26" r="2.5" fill="#16A34A" />
      <Path d="M22 26L38 10" fill="none" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M38 10l-1 6M38 10l-6-1" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function FrisbeeIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Polygon points="39.5,19.9 39.4,21.3 38.6,22.8 37.1,24.4 34.9,25.9 32.1,27.4 29.0,28.7 25.6,29.8 22.1,30.6 18.7,31.0 15.6,31.1 12.9,30.9 10.7,30.2 9.3,29.3 8.5,28.1 8.6,26.7 9.4,25.2 10.9,23.6 13.1,22.1 15.9,20.6 19.0,19.3 22.4,18.2 25.9,17.4 29.3,17.0 32.4,16.9 35.1,17.1 37.3,17.8 38.7,18.7" fill="#38BDF8" stroke="#1F2937" strokeWidth="2.5" strokeLinejoin="round" />
      <Path d="M13 21c6 3 16 1 22-2" fill="none" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 14h8M2 20h6" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function CricketIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Rect x="9" y="6" width="9" height="26" rx="2" fill="#FDE68A" stroke="#B45309" strokeWidth="2" />
      <Path d="M13.5 32V43" fill="none" stroke="#B45309" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="33" cy="16" r="6" fill="#DC2626" />
      <Path d="M29 14c3 2 5 4 8 4" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M28 44V30M33 44V30M38 44V30" fill="none" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function ArcheryIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Path d="M15 5C36 13 36 35 15 43" fill="none" stroke="#B45309" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M15 5L15 43" fill="none" stroke="#1F2937" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8 24H43" fill="none" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Polygon points="45,24 38,20 38,28" fill="#9CA3AF" stroke="#1F2937" strokeWidth="1.5" strokeLinejoin="round" />
      <Path d="M8 24L5 21M8 24L5 27M11 24L8 21M11 24L8 27" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function AthleticsIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Circle cx="30" cy="8" r="4" fill="#F59E0B" />
      <Path d="M28 13 L23 24" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M23 24 L15 28 L11 38" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M23 24 L32 32 L35 40" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M27 16 L34 20" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M27 16 L20 20 L16 14" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 44H44M4 40H44" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function TrackAndFieldIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Circle cx="14" cy="12" r="4" fill="#F59E0B" />
      <Path d="M14 17 L16 28" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 28 L24 30 L30 28" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 28 L11 40" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M14 20 L24 17" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M34 44V26M44 44V26M32 26H46" fill="none" stroke="#1F2937" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M34 32H44" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function RaceWalkingIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Circle cx="22" cy="9" r="4" fill="#F59E0B" />
      <Path d="M22 14 L22 28" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M22 28 L15 41" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M22 28 L30 40" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M22 18 L15 24" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M22 18 L29 24" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Rect x="19" y="17" width="6" height="6" rx="1" fill="#FFFFFF" stroke="#1F2937" strokeWidth="1.5" />
      <Path d="M34 14l8 0M34 20l8 0M34 26l8 0" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function MarathonIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Circle cx="18" cy="12" r="4" fill="#F59E0B" />
      <Path d="M17 17 L14 28" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M14 28 L8 32 L6 42" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M14 28 L22 34 L24 42" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 20 L23 24" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 20 L9 22" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M32 6V44" fill="none" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Polygon points="32,8 44,12 32,17" fill="#DC2626" />
      <Path d="M32 44H46" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function ArtisticSwimmingIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Path d="M18 30L14 8" fill="none" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M30 30L34 8" fill="none" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <Polygon points="10,8 18,8 16,4" fill="#1F2937" />
      <Polygon points="30,8 38,8 36,4" fill="#1F2937" />
      <Path d="M4 32c4 4 8 4 12 0s8-4 12 0 8 4 12 0 8-4 8 0" fill="none" stroke="#0284C7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 38c4 4 8 4 12 0s8-4 12 0 8 4 12 0 8-4 8 0" fill="none" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 44c4 4 8 4 12 0s8-4 12 0 8 4 12 0 8-4 8 0" fill="none" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function DivingIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Rect x="2" y="12" width="16" height="3" rx="1.5" fill="#9CA3AF" />
      <Circle cx="34" cy="16" r="4" fill="#F59E0B" />
      <Path d="M32 18 L24 26" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 26 L14 22" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M32 19 L38 28" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 36c4 4 8 4 12 0s8-4 12 0 8 4 12 0 8-4 8 0" fill="none" stroke="#0284C7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 42c4 4 8 4 12 0s8-4 12 0 8 4 12 0 8-4 8 0" fill="none" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function WaterPoloIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Circle cx="30" cy="16" r="6" fill="#FDE68A" stroke="#1F2937" strokeWidth="2" />
      <Path d="M26 14c3 2 5 2 8 0" fill="none" stroke="#1F2937" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="14" cy="22" r="4" fill="#F59E0B" />
      <Path d="M14 26 L18 32" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 24 L24 18 L26 14" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 34c4 4 8 4 12 0s8-4 12 0 8 4 12 0 8-4 8 0" fill="none" stroke="#0284C7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 39c4 4 8 4 12 0s8-4 12 0 8 4 12 0 8-4 8 0" fill="none" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 44c4 4 8 4 12 0s8-4 12 0 8 4 12 0 8-4 8 0" fill="none" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function MarathonSwimmingIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Circle cx="26" cy="22" r="4" fill="#F59E0B" />
      <Path d="M24 26 L14 30" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 26 L34 18 L40 22" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M20 28 L8 32" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 30c4 4 8 4 12 0s8-4 12 0 8 4 12 0 8-4 8 0" fill="none" stroke="#0284C7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 35c4 4 8 4 12 0s8-4 12 0 8 4 12 0 8-4 8 0" fill="none" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 40c4 4 8 4 12 0s8-4 12 0 8 4 12 0 8-4 8 0" fill="none" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="40" cy="10" r="3.5" fill="#F0522D" />
      <Path d="M40 14V20" fill="none" stroke="#1F2937" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function BaseballIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Circle cx="18" cy="28" r="12" fill="#FFFFFF" stroke="#1F2937" strokeWidth="2.5" />
      <Path d="M11 20c3 3 3 11 0 14M25 20c-3 3-3 11 0 14" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Polygon points="37.0,3.6 41.9,7.1 27.0,28.4 22.1,24.9" fill="#FDE68A" stroke="#B45309" strokeWidth="2" strokeLinejoin="round" />
    </Frame>
  );
}

export function SoftballIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Circle cx="22" cy="26" r="14" fill="#FDE68A" stroke="#1F2937" strokeWidth="2.5" />
      <Path d="M13 16c4 4 4 16 0 20M31 16c-4 4-4 16 0 20" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Polygon points="34,6 44,8 42,18 36,16" fill="#B45309" />
    </Frame>
  );
}

export function Basketball3x3Icon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Path d="M8 28L13 41H27L32 28" fill="none" stroke="#9CA3AF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M20 29V41M14 28L18 41M26 28L22 41" fill="none" stroke="#9CA3AF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="20" cy="21" r="8" fill="#F0522D" stroke="#1F2937" strokeWidth="2" />
      <Path d="M20 13V29M12 21H28" fill="none" stroke="#1F2937" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <Ellipse cx="20" cy="28" rx="12" ry="3" fill="none" stroke="#DC2626" strokeWidth="2.5" />
      <Path d="M35 6H43L39 12C42 12 44 14 44 16.5C44 19.5 42 21 39 21H35" fill="none" stroke="#1F2937" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function BeachVolleyballIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Circle cx="18" cy="24" r="12" fill="#FFFFFF" stroke="#1F2937" strokeWidth="2" />
      <Path d="M18 12c4 6 4 10 0 16s-4 10 0 16M8 18c6 2 10 2 16 0M9 32c6-2 10-2 16 0" fill="none" stroke="#1F2937" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="38" cy="10" r="5" fill="#F59E0B" />
      <Path d="M38 2v2M44 10h2M32 10h-2" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 44c8-4 12 0 20-2s14 2 20-2" fill="none" stroke="#FDE68A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function BoxingIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Path d="M12 18c0-8 6-10 12-10s12 2 12 10v8c0 4-3 6-6 6h-6l-2 6H14z" fill="#DC2626" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Rect x="14" y="36" width="14" height="6" rx="2" fill="#FFFFFF" stroke="#1F2937" strokeWidth="2" />
      <Path d="M16 20c3-2 8-2 12 0" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function BreakingIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Circle cx="24" cy="34" r="4" fill="#F59E0B" />
      <Path d="M24 30 L24 18" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 18 L16 6" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 18 L32 6" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 30 L15 34 L12 42" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 30 L33 34" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 44H44" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M38 20c3 4 3 10 0 14" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function CanoeSlalomIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Path d="M6 36c8 6 28 6 36 0z" fill="#DC2626" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="24" cy="22" r="4" fill="#F59E0B" />
      <Path d="M24 26 L24 33" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M14 20 L34 30" fill="none" stroke="#B45309" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8 8v18M40 8v18" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Rect x="6" y="8" width="6" height="4" rx="0" fill="#16A34A" />
      <Rect x="36" y="8" width="6" height="4" rx="0" fill="#DC2626" />
      <Path d="M4 40c4 4 8 4 12 0s8-4 12 0 8 4 12 0 8-4 8 0" fill="none" stroke="#0284C7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function CanoeSprintIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Path d="M3 34c12 6 30 6 42 0z" fill="#F0522D" stroke="#F0522D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="24" cy="22" r="4" fill="#F59E0B" />
      <Path d="M24 26 L24 34" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M10 24 L40 34" fill="none" stroke="#B45309" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3 42H45M3 10H45" fill="none" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function RoadCyclingIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Circle cx="10" cy="32" r="7" fill="none" stroke="#1F2937" strokeWidth="2.5" />
      <Circle cx="38" cy="32" r="7" fill="none" stroke="#1F2937" strokeWidth="2.5" />
      <Path d="M10 32L20 32L27 22L38 32M20 32L17 22M14 22H22" fill="none" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="30" cy="11" r="4" fill="#DC2626" />
      <Path d="M29 16 L22 24" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M29 17 L35 23" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M22 24 L27 32" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3 44H45" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function TrackCyclingIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Path d="M4 40c10 0 30-2 40-16" fill="none" stroke="#9CA3AF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="14" cy="30" r="6" fill="none" stroke="#1F2937" strokeWidth="2.5" />
      <Circle cx="34" cy="24" r="6" fill="none" stroke="#1F2937" strokeWidth="2.5" />
      <Path d="M14 30L22 28L28 18L34 24M22 28L19 20" fill="none" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="26" cy="8" r="4" fill="#0284C7" />
      <Path d="M26 12 L20 20" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M26 13 L31 18" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function MountainBikingIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Polygon points="4,42 17,16 30,42" fill="#BBF7D0" />
      <Polygon points="22,42 34,18 46,42" fill="#9CA3AF" />
      <Circle cx="10" cy="36" r="5" fill="none" stroke="#1F2937" strokeWidth="2.5" />
      <Circle cx="28" cy="36" r="5" fill="none" stroke="#1F2937" strokeWidth="2.5" />
      <Path d="M10 36L17 36L22 28L28 36M17 36L15 28" fill="none" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="20" cy="18" r="4" fill="#16A34A" />
      <Path d="M20 22 L15 28" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M20 23 L25 27" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function BmxRacingIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Circle cx="11" cy="34" r="6" fill="none" stroke="#1F2937" strokeWidth="2.5" />
      <Circle cx="33" cy="34" r="6" fill="none" stroke="#1F2937" strokeWidth="2.5" />
      <Path d="M11 34L19 34L24 24L33 34M19 34L17 26M14 26H20" fill="none" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="25" cy="12" r="4" fill="#F0522D" />
      <Path d="M24 17 L19 25" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 18 L30 24" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M40 8L44 8L44 44M40 8V44" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function BmxFreestyleIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Circle cx="10" cy="30" r="6" fill="none" stroke="#1F2937" strokeWidth="2.5" />
      <Circle cx="32" cy="22" r="6" fill="none" stroke="#1F2937" strokeWidth="2.5" />
      <Path d="M10 30L18 28L24 18L32 22M18 28L15 20" fill="none" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="22" cy="8" r="4" fill="#7C3AED" />
      <Path d="M22 12 L18 19" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M22 13 L27 17" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M36 42c4-6 6-14 4-20M40 22l-4 3M40 22l3 4" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function EquestrianIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Path d="M16 42V30c0-8 2-14 8-18l4-6 2 6c4 2 8 6 8 12l-6 2-2-4-4 6v14z" fill="#B45309" stroke="#B45309" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="30" cy="14" r="1.3" fill="#FFFFFF" />
      <Path d="M16 30c-4-2-8 0-10 4" fill="none" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Rect x="22" y="6" width="8" height="2" rx="1" fill="#DC2626" />
    </Frame>
  );
}

export function FencingIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Path d="M8 40L38 8" fill="none" stroke="#9CA3AF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M40 40L10 8" fill="none" stroke="#9CA3AF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M5 37l6 6M43 37l-6 6" fill="none" stroke="#1F2937" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="24" cy="24" r="5" fill="#FFFFFF" stroke="#1F2937" strokeWidth="2" />
      <Path d="M20 22h8M20 25h8" fill="none" stroke="#1F2937" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function FieldHockeyIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Path d="M30 6L18 32c-1 3-4 5-8 5" fill="none" stroke="#B45309" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="36" cy="38" r="4" fill="#FDE68A" stroke="#1F2937" strokeWidth="2" />
      <Path d="M4 44H44" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M38 28c3-2 5-3 7-3" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function FlagFootballIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Polygon points="28.6,18.5 29.4,20.2 29.6,22.1 29.2,24.3 28.2,26.5 26.8,28.7 24.8,30.7 22.6,32.6 20.1,34.0 17.5,35.1 14.9,35.8 12.5,35.9 10.4,35.6 8.6,34.7 7.4,33.5 6.6,31.8 6.4,29.9 6.8,27.7 7.8,25.5 9.2,23.3 11.2,21.3 13.4,19.4 15.9,18.0 18.5,16.9 21.1,16.2 23.5,16.1 25.6,16.4 27.4,17.3" fill="#B45309" stroke="#1F2937" strokeWidth="2" strokeLinejoin="round" />
      <Path d="M10 32L26 20M17 24l2 4M20 22l2 4" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M38 6V42" fill="none" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Polygon points="38,8 46,12 38,16" fill="#DC2626" />
    </Frame>
  );
}

export function GolfIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Path d="M30 6V30" fill="none" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Polygon points="30,6 42,10 30,15" fill="#DC2626" />
      <Ellipse cx="26" cy="38" rx="18" ry="4" fill="#16A34A" />
      <Circle cx="14" cy="32" r="4" fill="#FFFFFF" stroke="#1F2937" strokeWidth="2" />
      <Path d="M14 36v6" fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function ArtisticGymnasticsIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Path d="M8 6H40" fill="none" stroke="#9CA3AF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 6V14M32 6V14" fill="none" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="16" cy="18" r="4" fill="none" stroke="#7C3AED" strokeWidth="2.5" />
      <Circle cx="32" cy="18" r="4" fill="none" stroke="#7C3AED" strokeWidth="2.5" />
      <Circle cx="24" cy="22" r="4" fill="#F59E0B" />
      <Path d="M24 27 L24 36" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 30 L18 22" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 30 L30 22" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 36 L20 43" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 36 L28 43" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function RhythmicGymnasticsIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Path d="M14 38C4 30 8 16 20 14s14 16 24 4" fill="none" stroke="#7C3AED" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="34" cy="30" r="9" fill="none" stroke="#DC2626" strokeWidth="3" />
      <Circle cx="14" cy="34" r="4" fill="#F59E0B" />
      <Path d="M14 38 L14 44" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M14 38 L22 30" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function TrampolineIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Circle cx="24" cy="10" r="4" fill="#F59E0B" />
      <Path d="M24 15 L24 26" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 18 L16 10" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 18 L32 10" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 26 L18 32" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 26 L30 32" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M6 36H42" fill="none" stroke="#1F2937" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8 36l-2 8M16 36l-1 8M24 36v8M32 36l1 8M40 36l2 8" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function HandballIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Rect x="26" y="6" width="18" height="18" rx="0" fill="none" stroke="#1F2937" strokeWidth="2.5" />
      <Path d="M31 6V24M37 6V24M26 12H44M26 18H44" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="10" cy="14" r="4" fill="#F59E0B" />
      <Path d="M10 19 L10 30" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M10 30 L5 42" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M10 30 L16 42" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M10 22 L18 16" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="22" cy="12" r="4" fill="#F0522D" stroke="#1F2937" strokeWidth="1.5" />
    </Frame>
  );
}

export function JudoIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Circle cx="16" cy="9" r="4" fill="#F59E0B" />
      <Path d="M16 14 L16 28" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 28 L11 41" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 28 L22 41" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 18 L28 24" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Rect x="12" y="22" width="9" height="4" rx="0" fill="#1F2937" />
      <Circle cx="34" cy="16" r="4" fill="#0284C7" />
      <Path d="M34 21 L30 24" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M34 21 L40 32" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M40 32 L46 42" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M38 28 L30 40" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function KarateIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Circle cx="14" cy="9" r="4" fill="#F59E0B" />
      <Path d="M14 14 L16 28" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 28 L12 41" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 28 L30 24 L42 22" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M14 18 L22 20 L26 14" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M14 18 L7 24" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Rect x="11" y="22" width="8" height="3" rx="0" fill="#1F2937" />
    </Frame>
  );
}

export function LacrosseIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Path d="M12 44L24 20" fill="none" stroke="#B45309" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 20C20 12 28 4 34 8s2 12-6 14" fill="none" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M26 12l5 6M30 9l4 7" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="38" cy="36" r="4.5" fill="#16A34A" stroke="#1F2937" strokeWidth="2" />
    </Frame>
  );
}

export function ModernPentathlonIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Polygon points="24,5 43,19 36,41 12,41 5,19" fill="none" stroke="#1F2937" strokeWidth="2.5" strokeLinejoin="round" />
      <Circle cx="24" cy="5" r="4.5" fill="#DC2626" />
      <Circle cx="43" cy="19" r="4.5" fill="#0284C7" />
      <Circle cx="36" cy="41" r="4.5" fill="#16A34A" />
      <Circle cx="12" cy="41" r="4.5" fill="#F59E0B" />
      <Circle cx="5" cy="19" r="4.5" fill="#7C3AED" />
    </Frame>
  );
}

export function RowingIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Path d="M4 34c14 6 26 6 40 0z" fill="#B45309" stroke="#B45309" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="24" cy="16" r="4" fill="#F59E0B" />
      <Path d="M24 21 L26 30" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 24 L14 26" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 24 L34 26" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 22L18 32M44 22L30 32" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 40c4 4 8 4 12 0s8-4 12 0 8 4 12 0 8-4 8 0" fill="none" stroke="#0284C7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function RugbySevensIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Polygon points="40.5,14.5 41.3,16.9 41.2,19.6 40.3,22.5 38.6,25.5 36.1,28.5 33.0,31.2 29.5,33.5 25.7,35.4 21.8,36.7 18.0,37.4 14.6,37.4 11.6,36.7 9.2,35.4 7.5,33.5 6.7,31.1 6.8,28.4 7.7,25.5 9.4,22.5 11.9,19.5 15.0,16.8 18.5,14.5 22.3,12.6 26.2,11.3 30.0,10.6 33.4,10.6 36.4,11.3 38.8,12.6" fill="#B45309" stroke="#1F2937" strokeWidth="2.5" strokeLinejoin="round" />
      <Path d="M14 30L34 18M20 22l3 5M24 20l3 5M28 18l3 5" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function SailingIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Path d="M24 6V34" fill="none" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Polygon points="26,8 40,32 26,32" fill="#FFFFFF" stroke="#1F2937" strokeWidth="2" strokeLinejoin="round" />
      <Polygon points="22,12 10,32 22,32" fill="#DC2626" />
      <Path d="M8 36H42L36 42H14z" fill="#B45309" stroke="#B45309" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 44c4 4 8 4 12 0s8-4 12 0 8 4 12 0 8-4 8 0" fill="none" stroke="#0284C7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function ShootingIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Polygon points="3,22 16,20 16,28 12,35 5,35" fill="#F59E0B" stroke="#B45309" strokeWidth="2" strokeLinejoin="round" />
      <Rect x="16" y="19" width="12" height="8" rx="2" fill="#9CA3AF" stroke="#1F2937" strokeWidth="2" />
      <Rect x="28" y="21" width="17" height="3.5" rx="1.5" fill="#1F2937" />
      <Path d="M40 18V21M36 19V21" fill="none" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M20 27V32H25" fill="none" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 31L12 35" fill="none" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function SkateboardingIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Circle cx="24" cy="8" r="4" fill="#16A34A" />
      <Path d="M24 13 L24 24" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 24 L18 30" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 24 L31 30" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 17 L16 22" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 17 L33 21" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8 36H40" fill="none" stroke="#B45309" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="14" cy="40" r="3" fill="#1F2937" />
      <Circle cx="34" cy="40" r="3" fill="#1F2937" />
    </Frame>
  );
}

export function SportClimbingIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Rect x="6" y="4" width="30" height="40" rx="3" fill="#9CA3AF" />
      <Circle cx="14" cy="12" r="3" fill="#DC2626" />
      <Circle cx="26" cy="10" r="3" fill="#0284C7" />
      <Circle cx="20" cy="22" r="3" fill="#F59E0B" />
      <Circle cx="12" cy="32" r="3" fill="#16A34A" />
      <Circle cx="28" cy="34" r="3" fill="#7C3AED" />
      <Circle cx="38" cy="14" r="4" fill="#F59E0B" />
      <Path d="M38 19 L34 32" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M38 22 L30 16" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M34 32 L30 40" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M40 4V10" fill="none" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function SquashIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Path d="M10 12c0-6 14-6 14 2s-8 12-12 16" fill="none" stroke="#1F2937" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Polygon points="23.5,16.7 22.6,18.8 21.3,20.5 19.7,22.0 18.0,23.1 16.2,23.7 14.3,23.8 12.6,23.4 11.0,22.6 9.7,21.3 8.6,19.6 8.0,17.7 7.7,15.6 7.9,13.4 8.5,11.3 9.4,9.2 10.7,7.5 12.3,6.0 14.0,4.9 15.8,4.3 17.7,4.2 19.4,4.6 21.0,5.4 22.3,6.7 23.4,8.4 24.0,10.3 24.3,12.4 24.1,14.6" fill="none" stroke="#1F2937" strokeWidth="3" strokeLinejoin="round" />
      <Path d="M22 24L34 40" fill="none" stroke="#1F2937" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="38" cy="12" r="4" fill="#1F2937" />
      <Circle cx="38" cy="12" r="1.3" fill="#DC2626" />
      <Rect x="4" y="42" width="40" height="2" rx="0" fill="#9CA3AF" />
    </Frame>
  );
}

export function SurfingIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Path d="M4 24c4 4 8 4 12 0s8-4 12 0 8 4 12 0 8-4 8 0" fill="none" stroke="#0284C7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 31c4 4 8 4 12 0s8-4 12 0 8 4 12 0 8-4 8 0" fill="none" stroke="#0284C7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 38c4 4 8 4 12 0s8-4 12 0 8 4 12 0 8-4 8 0" fill="none" stroke="#0284C7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Polygon points="26.0,19.5 23.1,21.0 20.2,22.4 17.5,23.4 15.1,24.0 13.2,24.3 11.8,24.1 11.0,23.5 10.9,22.5 11.4,21.3 12.6,19.7 14.3,18.0 16.6,16.1 19.2,14.3 22.0,12.5 24.9,11.0 27.8,9.6 30.5,8.6 32.9,8.0 34.8,7.7 36.2,7.9 37.0,8.5 37.1,9.5 36.6,10.7 35.4,12.3 33.7,14.0 31.4,15.9 28.8,17.7" fill="#F0522D" stroke="#1F2937" strokeWidth="2" strokeLinejoin="round" />
      <Circle cx="16" cy="5" r="4" fill="#F59E0B" />
      <Path d="M16 9 L18 14" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function TableTennisIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Circle cx="17" cy="19" r="12" fill="#DC2626" stroke="#1F2937" strokeWidth="2.5" />
      <Path d="M24 28L34 42" fill="none" stroke="#B45309" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="36" cy="12" r="4" fill="#FFFFFF" stroke="#1F2937" strokeWidth="2" />
      <Path d="M4 44H44" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function TaekwondoIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Circle cx="14" cy="12" r="4" fill="#F59E0B" />
      <Path d="M14 17 L16 28" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 28 L12 42" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 28 L34 20 L44 8" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M14 20 L8 26" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M14 20 L21 24" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Rect x="12" y="22" width="8" height="4" rx="0" fill="#DC2626" />
    </Frame>
  );
}

export function TriathlonIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Path d="M3 12c3 3 6 3 9 0s6-3 9 0" fill="none" stroke="#0284C7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="10" cy="34" r="7" fill="none" stroke="#1F2937" strokeWidth="2.5" />
      <Circle cx="26" cy="34" r="7" fill="none" stroke="#1F2937" strokeWidth="2.5" />
      <Path d="M10 34L18 34L22 26L26 34" fill="none" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="40" cy="12" r="4" fill="#F59E0B" />
      <Path d="M39 17 L37 26" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M37 26 L33 32 L34 42" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M37 26 L43 34" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M39 20 L44 24" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function WeightliftingIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Path d="M6 8H42" fill="none" stroke="#1F2937" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Rect x="2" y="3" width="4" height="10" rx="1" fill="#1F2937" />
      <Rect x="42" y="3" width="4" height="10" rx="1" fill="#1F2937" />
      <Circle cx="24" cy="18" r="4" fill="#F59E0B" />
      <Path d="M24 23 L24 34" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 26 L14 12" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 26 L34 12" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 34 L18 43" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 34 L30 43" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function WrestlingIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Circle cx="14" cy="12" r="4" fill="#F59E0B" />
      <Path d="M14 17 L18 28" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M18 28 L12 42" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M18 28 L24 42" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M14 20 L26 22" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="34" cy="18" r="4" fill="#0284C7" />
      <Path d="M34 23 L30 30" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M30 30 L36 42" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M30 30 L22 40" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M34 26 L24 26" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function AlpineSkiingIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Polygon points="4,44 44,12 44,44" fill="#E0F2FE" stroke="#9CA3AF" strokeWidth="1.5" strokeLinejoin="round" />
      <Circle cx="26" cy="12" r="4" fill="#F59E0B" />
      <Path d="M25 17 L22 26" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M22 26 L30 32" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M25 19 L32 22" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M14 34L40 26" fill="none" stroke="#DC2626" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M34 22L38 38" fill="none" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function BiathlonIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Circle cx="14" cy="10" r="4" fill="#F59E0B" />
      <Path d="M14 15 L14 28" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M14 28 L9 40" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M14 28 L20 40" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M14 18 L22 22" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M10 26L32 20" fill="none" stroke="#B45309" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 42H26" fill="none" stroke="#DC2626" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="38" cy="30" r="7" fill="#FFFFFF" stroke="#1F2937" strokeWidth="2" />
      <Circle cx="38" cy="30" r="3" fill="#DC2626" />
    </Frame>
  );
}

export function BobsleighIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Path d="M8 39H42" fill="none" stroke="#1F2937" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M14 33V39M34 33V39" fill="none" stroke="#1F2937" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M5 31C5 27 10 25 16 25H37C42 25 45 28 45 31V34H5Z" fill="#DC2626" stroke="#1F2937" strokeWidth="2.5" strokeLinejoin="round" />
      <Rect x="21" y="19" width="12" height="7" rx="3" fill="#F59E0B" stroke="#1F2937" strokeWidth="2" />
      <Circle cx="27" cy="14" r="5" fill="#F59E0B" stroke="#1F2937" strokeWidth="2.5" />
      <Path d="M28 13H32" fill="none" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M5 31H45" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function CrossCountrySkiingIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Circle cx="22" cy="10" r="4" fill="#F59E0B" />
      <Path d="M22 15 L22 27" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M22 27 L14 36" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M22 27 L30 34" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M22 18 L30 24" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M22 18 L14 24" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 40H34M10 44H42" fill="none" stroke="#DC2626" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M14 24L8 40M30 24L38 40" fill="none" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function CurlingIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Path d="M4 43H44" fill="none" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Rect x="8" y="26" width="32" height="13" rx="6" fill="#9CA3AF" stroke="#1F2937" strokeWidth="2.5" />
      <Rect x="12" y="22" width="24" height="7" rx="3.5" fill="#DC2626" stroke="#1F2937" strokeWidth="2" />
      <Path d="M17 22V17a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v5" fill="none" stroke="#1F2937" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function FigureSkatingIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Path d="M12 8V28c0 6 4 8 10 8h14V28H22V8z" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 8V28c0 6 4 8 10 8h14V28H22V8z" fill="#FFFFFF" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8 40H42" fill="none" stroke="#9CA3AF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8 40c-2 0-2-3 0-3" fill="none" stroke="#9CA3AF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 14h6M16 20h6" fill="none" stroke="#1F2937" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function FreestyleSkiingIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Circle cx="24" cy="12" r="4" fill="#F59E0B" />
      <Path d="M24 17 L26 28" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 20 L14 16" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 20 L34 16" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M26 28 L18 36" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M26 28 L34 36" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8 40L22 30M40 40L28 30" fill="none" stroke="#DC2626" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M6 10c4-4 8-4 12 0" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function IceHockeyIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Path d="M12 6L22 30c1 3 4 5 8 5h8" fill="none" stroke="#B45309" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <Ellipse cx="34" cy="40" rx="6" ry="3" fill="#1F2937" />
      <Path d="M4 44H44" fill="none" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function LugeIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Path d="M4 42H44" fill="none" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M6 39H36C41 39 43 37 43 33" fill="none" stroke="#1F2937" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M10 36V39M30 36V39" fill="none" stroke="#1F2937" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8 34H38" fill="none" stroke="#9CA3AF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="11" cy="25" r="4" fill="#F59E0B" />
      <Path d="M14 28L30 31" fill="none" stroke="#F59E0B" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M30 31L40 26" fill="none" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 29L22 33" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="11" cy="25" r="4.5" fill="none" stroke="#1F2937" strokeWidth="1.5" />
    </Frame>
  );
}

export function NordicCombinedIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Circle cx="24" cy="9" r="3.5" fill="#F59E0B" stroke="#1F2937" strokeWidth="1.5" />
      <Path d="M24 13L26 22" fill="none" stroke="#F59E0B" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M25 16L14 13" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M25 16L36 13" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M26 22L21 28" fill="none" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M26 22L31 28" fill="none" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M6 44L42 30" fill="none" stroke="#0284C7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M6 30L42 44" fill="none" stroke="#1F2937" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function ShortTrackIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Path d="M4 44Q24 38 44 44" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 40Q24 34 44 40" fill="none" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="27" cy="10" r="4" fill="#F59E0B" stroke="#1F2937" strokeWidth="1.5" />
      <Path d="M25 15L19 26" fill="none" stroke="#F59E0B" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M22 19L14 28" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M19 26L27 31L33 35" fill="none" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M19 26L14 35" fill="none" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9 37H20M28 37H40" fill="none" stroke="#1F2937" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Rect x="40" y="29" width="4" height="4" rx="1" fill="#DC2626" />
    </Frame>
  );
}

export function SkeletonIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Path d="M4 42H44" fill="none" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M7 39H40" fill="none" stroke="#1F2937" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M11 34V39M33 34V39" fill="none" stroke="#1F2937" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Rect x="8" y="31" width="32" height="4" rx="2" fill="#9CA3AF" stroke="#1F2937" strokeWidth="2" />
      <Path d="M9 27L30 27" fill="none" stroke="#F59E0B" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9 27L5 22" fill="none" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M30 28L40 33" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="36" cy="24" r="4.5" fill="#DC2626" stroke="#1F2937" strokeWidth="2" />
      <Path d="M38 22L41 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function SkiJumpingIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Path d="M4 10L22 28" fill="none" stroke="#9CA3AF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="26" cy="16" r="4" fill="#F59E0B" />
      <Path d="M26 20 L30 22" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M26 17 L34 18" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M30 22 L34 24" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M18 20L40 28" fill="none" stroke="#DC2626" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 44C20 44 34 40 44 34" fill="none" stroke="#E0F2FE" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function SnowboardingIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Polygon points="42.6,30.0 42.3,30.8 41.0,31.7 38.9,32.7 36.1,33.8 32.6,34.9 28.7,36.0 24.6,36.9 20.5,37.7 16.5,38.4 12.9,38.8 9.9,38.9 7.5,38.8 6.0,38.5 5.4,38.0 5.7,37.2 7.0,36.3 9.1,35.3 11.9,34.2 15.4,33.1 19.3,32.0 23.4,31.1 27.5,30.3 31.5,29.6 35.1,29.2 38.1,29.1 40.5,29.2 42.0,29.5" fill="#0284C7" stroke="#1F2937" strokeWidth="2" strokeLinejoin="round" />
      <Circle cx="24" cy="8" r="4" fill="#7C3AED" />
      <Path d="M24 13 L24 24" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 24 L20 32" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 24 L29 31" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 17 L16 22" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 17 L32 20" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function SpeedSkatingIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Circle cx="28" cy="12" r="4" fill="#0284C7" />
      <Path d="M26 16 L18 24" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M18 24 L26 30 L18 40" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M18 24 L10 32" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M26 17 L34 24" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 42H42" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 14h8M6 20h8" fill="none" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function SkiMountaineeringIcon({ size }: IconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Polygon points="4,44 44,18 44,44" fill="#9CA3AF" stroke="#1F2937" strokeWidth="2" strokeLinejoin="round" />
      <Polygon points="33,20 44,18 44,24" fill="#FFFFFF" />
      <Circle cx="25" cy="12" r="3.5" fill="#F59E0B" stroke="#1F2937" strokeWidth="1.5" />
      <Path d="M25 16L26 24" fill="none" stroke="#F59E0B" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M26 24L23 29M26 24L29 28" fill="none" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M25 18L33 17" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M33 8V26" fill="none" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M29 9L37 8" fill="none" stroke="#1F2937" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M21 9L18 25" fill="none" stroke="#0284C7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

/** icon_key -> glyph for every sport key in the manifest that had no glyph before. */
export const SPORT_GLYPHS: Record<string, (props: SportGlyphProps) => React.JSX.Element> = {
  'cycling': CyclingIcon,
  'walking': WalkingIcon,
  'running': RunningIcon,
  'hiking': HikingIcon,
  'yoga': YogaIcon,
  'fitness': FitnessIcon,
  'dance': DanceIcon,
  'pickleball': PickleballIcon,
  'padel': PadelIcon,
  'bowling': BowlingIcon,
  'darts': DartsIcon,
  'frisbee': FrisbeeIcon,
  'cricket': CricketIcon,
  'archery': ArcheryIcon,
  'athletics': AthleticsIcon,
  'track-and-field': TrackAndFieldIcon,
  'race-walking': RaceWalkingIcon,
  'marathon': MarathonIcon,
  'artistic-swimming': ArtisticSwimmingIcon,
  'diving': DivingIcon,
  'water-polo': WaterPoloIcon,
  'marathon-swimming': MarathonSwimmingIcon,
  'baseball': BaseballIcon,
  'softball': SoftballIcon,
  'basketball-3x3': Basketball3x3Icon,
  'beach-volleyball': BeachVolleyballIcon,
  'boxing': BoxingIcon,
  'breaking': BreakingIcon,
  'canoe-slalom': CanoeSlalomIcon,
  'canoe-sprint': CanoeSprintIcon,
  'road-cycling': RoadCyclingIcon,
  'track-cycling': TrackCyclingIcon,
  'mountain-biking': MountainBikingIcon,
  'bmx-racing': BmxRacingIcon,
  'bmx-freestyle': BmxFreestyleIcon,
  'equestrian': EquestrianIcon,
  'fencing': FencingIcon,
  'field-hockey': FieldHockeyIcon,
  'flag-football': FlagFootballIcon,
  'golf': GolfIcon,
  'artistic-gymnastics': ArtisticGymnasticsIcon,
  'rhythmic-gymnastics': RhythmicGymnasticsIcon,
  'trampoline': TrampolineIcon,
  'handball': HandballIcon,
  'judo': JudoIcon,
  'karate': KarateIcon,
  'lacrosse': LacrosseIcon,
  'modern-pentathlon': ModernPentathlonIcon,
  'rowing': RowingIcon,
  'rugby-sevens': RugbySevensIcon,
  'sailing': SailingIcon,
  'shooting': ShootingIcon,
  'skateboarding': SkateboardingIcon,
  'sport-climbing': SportClimbingIcon,
  'squash': SquashIcon,
  'surfing': SurfingIcon,
  'table-tennis': TableTennisIcon,
  'taekwondo': TaekwondoIcon,
  'triathlon': TriathlonIcon,
  'weightlifting': WeightliftingIcon,
  'wrestling': WrestlingIcon,
  'alpine-skiing': AlpineSkiingIcon,
  'biathlon': BiathlonIcon,
  'bobsleigh': BobsleighIcon,
  'cross-country-skiing': CrossCountrySkiingIcon,
  'curling': CurlingIcon,
  'figure-skating': FigureSkatingIcon,
  'freestyle-skiing': FreestyleSkiingIcon,
  'ice-hockey': IceHockeyIcon,
  'luge': LugeIcon,
  'nordic-combined': NordicCombinedIcon,
  'short-track': ShortTrackIcon,
  'skeleton': SkeletonIcon,
  'ski-jumping': SkiJumpingIcon,
  'snowboarding': SnowboardingIcon,
  'speed-skating': SpeedSkatingIcon,
  'ski-mountaineering': SkiMountaineeringIcon,
};
