/**
 * Line icons of the phone list cards (DES-MEETUP-ADDENDUM-nov10-enhancements AD-7, NE-06; boards
 * docs/design/list-cards/Main.dc.html and Game.dc.html in the backend repo). Paths are the boards' own
 * 24x24 strokes; colours come from the caller (theme tokens). All decorative: hidden from screen readers.
 */
import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

export interface ListCardIconProps {
  size?: number;
  color: string;
}

function Frame({ size, children }: { size: number; children: React.ReactNode }): React.JSX.Element {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {children}
    </Svg>
  );
}

export function ClockLineIcon({ size = 16, color }: ListCardIconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M12 7v5l3 2" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Frame>
  );
}

export function GlobeLineIcon({ size = 16, color }: ListCardIconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path
        d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Frame>
  );
}

export function PeopleLineIcon({ size = 16, color }: ListCardIconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Circle cx={9} cy={8} r={3} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Circle cx={17} cy={9} r={2.5} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path
        d="M3 20c0-3.5 3-6 6-6s6 2.5 6 6M15 14.5c3 0 6 1.8 6 5.5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Frame>
  );
}

export function PinLineIcon({ size = 16, color }: ListCardIconProps): React.JSX.Element {
  return (
    <Frame size={size}>
      <Path
        d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={10} r={2.5} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}
