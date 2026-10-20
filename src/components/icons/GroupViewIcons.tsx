/** Icons for the WhatsApp-style Group detail screen (docs/mockups/group-view/). */
import React from 'react';
import { Circle, Path, Svg } from 'react-native-svg';

interface GroupViewIconProps {
  size?: number;
  color: string;
}

function Frame({ size = 22, color, children }: GroupViewIconProps & { children: React.ReactNode }): React.JSX.Element {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

export function PencilLineIcon(props: GroupViewIconProps): React.JSX.Element {
  return (
    <Frame {...props}>
      <Path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z" />
      <Path d="M13 21h8" />
    </Frame>
  );
}

export function PersonPlusIcon(props: GroupViewIconProps): React.JSX.Element {
  return (
    <Frame {...props}>
      <Circle cx="9" cy="8" r="3.5" />
      <Path d="M2.5 20c0-3.6 2.9-6 6.5-6 1.3 0 2.5.3 3.5.9" />
      <Path d="M18 14v6M15 17h6" />
    </Frame>
  );
}

export function PersonMinusIcon(props: GroupViewIconProps): React.JSX.Element {
  return (
    <Frame {...props}>
      <Circle cx="9" cy="8" r="3.5" />
      <Path d="M2.5 20c0-3.6 2.9-6 6.5-6 1.3 0 2.5.3 3.5.9" />
      <Path d="M15 17h6" />
    </Frame>
  );
}

export function ShieldPlusIcon(props: GroupViewIconProps): React.JSX.Element {
  return (
    <Frame {...props}>
      <Path d="M12 3l7 3v5.5c0 4.3-2.9 7.6-7 9.5-4.1-1.9-7-5.2-7-9.5V6z" />
      <Path d="M12 9v6M9 12h6" />
    </Frame>
  );
}

export function ShieldMinusIcon(props: GroupViewIconProps): React.JSX.Element {
  return (
    <Frame {...props}>
      <Path d="M12 3l7 3v5.5c0 4.3-2.9 7.6-7 9.5-4.1-1.9-7-5.2-7-9.5V6z" />
      <Path d="M9 12h6" />
    </Frame>
  );
}

export function ChevronLeftIcon(props: GroupViewIconProps): React.JSX.Element {
  return (
    <Frame {...props}>
      <Path d="M15 5l-7 7 7 7" />
    </Frame>
  );
}

export function LinkIcon(props: GroupViewIconProps): React.JSX.Element {
  return (
    <Frame {...props}>
      <Path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <Path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </Frame>
  );
}

export function CheckMarkIcon(props: GroupViewIconProps): React.JSX.Element {
  return (
    <Frame {...props}>
      <Path d="M5 12.5l4.5 4.5L19 7.5" />
    </Frame>
  );
}

export function InfoIcon(props: GroupViewIconProps): React.JSX.Element {
  return (
    <Frame {...props}>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 11v5.5" />
      <Path d="M12 7.6v.1" />
    </Frame>
  );
}

export function PersonIcon(props: GroupViewIconProps): React.JSX.Element {
  return (
    <Frame {...props}>
      <Circle cx="12" cy="8.5" r="3.8" />
      <Path d="M4.5 20c0-3.9 3.2-6.5 7.5-6.5s7.5 2.6 7.5 6.5" />
    </Frame>
  );
}
