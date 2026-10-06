/**
 * Home v2 Icon Set (Round 2).
 *
 * Requirements:
 * 1. CalendarIcon: coloured calendar icon in the same flat filled style as the
 *    bottom-bar icons (DashboardIcons), 40px.
 * 2. ClockIcon: 16px flat coloured icon in front of time detail line (blue).
 * 3. MapPinIcon: 16px flat coloured icon in front of location detail line (red-orange).
 * 4. OwnerCrownIcon: 16px flat coloured person with a gold crown for group owner line.
 * 5. PeopleGreenIcon: 14px flat coloured small people icon in front of count on the right (green).
 *
 * All icons are decorative: hidden from screen readers.
 */
import React from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

export interface HomeIconProps {
  size?: number;
}

/**
 * Calendar icon in flat filled style matching DashboardIcons.
 * Default size: 40px.
 */
export function CalendarIcon({ size = 40 }: HomeIconProps): React.JSX.Element {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* Calendar outer body */}
      <Rect x={6} y={10} width={36} height={32} rx={6} fill="#3B82F6" />
      {/* Top darker header band */}
      <Path
        d="M6 16c0-3.314 2.686-6 6-6h24c3.314 0 6 2.686 6 6v4H6v-4z"
        fill="#2563EB"
      />
      {/* Left and right binder clips / rings */}
      <Rect x={13} y={6} width={4} height={8} rx={2} fill="#F8FAFC" />
      <Rect x={31} y={6} width={4} height={8} rx={2} fill="#F8FAFC" />
      {/* Calendar face area */}
      <Rect x={10} y={23} width={28} height={15} rx={3} fill="#EFF6FF" />
      {/* Date grid tiles / dots in flat filled colors */}
      <Rect x={14} y={26} width={4} height={3} rx={1} fill="#60A5FA" />
      <Rect x={22} y={26} width={4} height={3} rx={1} fill="#60A5FA" />
      <Rect x={30} y={26} width={4} height={3} rx={1} fill="#60A5FA" />
      <Rect x={14} y={32} width={4} height={3} rx={1} fill="#60A5FA" />
      <Rect x={22} y={32} width={4} height={3} rx={1} fill="#F59E0B" />
      <Rect x={30} y={32} width={4} height={3} rx={1} fill="#10B981" />
    </Svg>
  );
}

/**
 * 16px flat coloured clock icon (blue).
 */
export function ClockIcon({ size = 16 }: HomeIconProps): React.JSX.Element {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Circle cx={8} cy={8} r={7} fill="#3B82F6" />
      {/* Clock inner hands */}
      <Path
        d="M8 4.2v4.1l2.8 1.6"
        stroke="#FFFFFF"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx={8} cy={8} r={1.2} fill="#FFFFFF" />
    </Svg>
  );
}

/**
 * 16px flat coloured map pin icon (red-orange).
 */
export function MapPinIcon({ size = 16 }: HomeIconProps): React.JSX.Element {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* Pin body */}
      <Path
        d="M8 1.5C5.515 1.5 3.5 3.515 3.5 6c0 3.6 4.5 8.5 4.5 8.5s4.5-4.9 4.5-8.5c0-2.485-2.015-4.5-4.5-4.5z"
        fill="#EA580C"
      />
      {/* Inner white circle */}
      <Circle cx={8} cy={5.8} r={1.8} fill="#FFFFFF" />
    </Svg>
  );
}

/**
 * 16px flat coloured person with a gold crown icon.
 * Replaces the small crown on the group owner detail line.
 */
export function OwnerCrownIcon({ size = 16 }: HomeIconProps): React.JSX.Element {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* Gold crown sitting on top of head */}
      <Path
        d="M5 2.5l1.2 1.3L8 1.8l1.8 2 1.2-1.3-.4 2.5H5.4L5 2.5z"
        fill="#F59E0B"
      />
      {/* Head */}
      <Circle cx={8} cy={6.5} r={2.2} fill="#4B5563" />
      {/* Shoulders / body */}
      <Path
        d="M3.5 13.5c0-2.2 2-3.8 4.5-3.8s4.5 1.6 4.5 3.8v.5H3.5v-.5z"
        fill="#4B5563"
      />
    </Svg>
  );
}

/**
 * 14px flat coloured small people icon (green).
 * Displayed in front of the count on the right.
 */
export function PeopleGreenIcon({ size = 14 }: HomeIconProps): React.JSX.Element {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* Back person */}
      <Circle cx={11} cy={5.5} r={2} fill="#34D399" />
      <Path
        d="M8.5 12.8c0-1.8 1.2-3 2.8-3s2.8 1.2 2.8 3v.7h-5.6v-.7z"
        fill="#34D399"
      />
      {/* Front person */}
      <Circle cx={5.5} cy={6} r={2.3} fill="#059669" />
      <Path
        d="M2.5 13.5c0-2.2 1.5-3.5 3.3-3.5 1.8 0 3.3 1.3 3.3 3.5v.5H2.5v-.5z"
        fill="#059669"
      />
    </Svg>
  );
}
