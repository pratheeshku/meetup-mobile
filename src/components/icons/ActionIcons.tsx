import React from 'react';
import { Circle, Path, Rect, Svg } from 'react-native-svg';

import { colors } from '../../theme/tokens';

interface ActionIconProps {
  size?: number;
  color?: string;
}

export function EditIcon({ size = 20, color = colors.white }: ActionIconProps): React.JSX.Element {
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
      <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </Svg>
  );
}

export function TrashIcon({ size = 20, color = colors.white }: ActionIconProps): React.JSX.Element {
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
      <Path d="M3 6h18" />
      <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </Svg>
  );
}

export function CameraIcon({ size = 20, color = colors.white }: ActionIconProps): React.JSX.Element {
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
      <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <Circle cx="12" cy="13" r="4" />
    </Svg>
  );
}

export function SearchIcon({ size = 20, color = colors.textMuted }: ActionIconProps): React.JSX.Element {
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
      <Circle cx="11" cy="11" r="8" />
      <Path d="m21 21-4.35-4.35" />
    </Svg>
  );
}

export function LockIcon({ size = 18, color = colors.primary }: ActionIconProps): React.JSX.Element {
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
      <Rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Svg>
  );
}

export function CheckIcon({ size = 18, color = colors.success }: ActionIconProps): React.JSX.Element {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M20 6 9 17l-5-5" />
    </Svg>
  );
}

export function CrossIcon({ size = 18, color = colors.error }: ActionIconProps): React.JSX.Element {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M18 6 6 18M6 6l12 12" />
    </Svg>
  );
}

export function PlusIcon({ size = 18, color = colors.white }: ActionIconProps): React.JSX.Element {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function MinusIcon({ size = 18, color = colors.white }: ActionIconProps): React.JSX.Element {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M5 12h14" />
    </Svg>
  );
}

export function WarningIcon({ size = 28, color = colors.white }: ActionIconProps): React.JSX.Element {
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
      <Path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <Path d="M12 9v4M12 17h.01" />
    </Svg>
  );
}

export function BackArrowIcon({ size = 20, color = colors.white }: ActionIconProps): React.JSX.Element {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="m15 18-6-6 6-6" />
    </Svg>
  );
}

export function CancelledIcon({ size = 20, color = colors.white }: ActionIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="4" width="18" height="17" rx="3" stroke={color} strokeWidth={2} />
      <Path d="M3 9h18" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M8 2v3M16 2v3" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path
        d="m10 13 4 4m0-4-4 4"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function PlayerRemovedIcon({ size = 20, color = colors.white }: ActionIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="9" cy="8" r="4" stroke={color} strokeWidth={2} />
      <Path
        d="M2 19c0-3.3 3.1-6 7-6s7 2.7 7 6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path d="M17 11h5" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

export function OwnerIcon({ size = 20, color = colors.white }: ActionIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 17h16l1.2-8.5a.6.6 0 0 0-.9-.6L15.5 11l-3-6a.6.6 0 0 0-1 0l-3 6-4.8-3.1a.6.6 0 0 0-.9.6L4 17z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Circle cx="4.5" cy="8" r="1.2" fill={color} />
      <Circle cx="12" cy="4.5" r="1.2" fill={color} />
      <Circle cx="19.5" cy="8" r="1.2" fill={color} />
      <Path d="M6 14.5h12" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

export function MarkUnreadIcon({ size = 20, color = colors.white }: ActionIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="8" stroke={color} strokeWidth={2.5} />
      <Circle cx="12" cy="12" r="3.5" fill={color} />
    </Svg>
  );
}

