import React from 'react';
import { Circle, Path, Svg } from 'react-native-svg';
import { colors } from '../../theme/tokens';

interface IconProps {
  size?: number;
  color?: string;
}

export function VenuePinBadgeIcon({
  size = 18,
  color = colors.venuePinIcon,
}: IconProps): React.JSX.Element {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z" />
      <Circle cx="12" cy="10" r="2.5" />
    </Svg>
  );
}

export function VenuePlusIcon({
  size = 18,
  color = colors.venueOthersIcon,
}: IconProps): React.JSX.Element {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function VenueChevronDownIcon({
  size = 16,
  color = colors.venueOthersIcon,
}: IconProps): React.JSX.Element {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M6 9l6 6 6-6" />
    </Svg>
  );
}
