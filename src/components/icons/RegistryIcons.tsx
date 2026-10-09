/**
 * Icon Registry — central icon mapping for interface and notification icons (image 09).
 *
 * Every screen refers to an icon by this name. Replacing the icon set later changes only this mapping.
 * Supports gradient badges with white glyphs (one colour per semantic meaning).
 */
import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import IconBadge from '../IconBadge';
import { colors, type GradientTokenKey } from '../../theme/tokens';
import { EditIcon, TrashIcon, CheckIcon } from './ActionIcons';

export type RegistryIconName =
  | 'edit'
  | 'settings'
  | 'time'
  | 'location'
  | 'players'
  | 'notifications'
  | 'delete'
  | 'mail'
  | 'lock'
  | 'search'
  | 'camera'
  | 'logout'
  | 'support'
  | 'report'
  | 'privacy'
  | 'terms'
  | 'add'
  | 'success'
  | 'globe'
  | 'trophy'
  | 'star'
  | 'cancelled'
  | 'player-removed'
  | 'owner'
  | 'mark-unread';

export interface GlyphProps {
  size?: number;
  color?: string;
}

/** 1. Cancelled: Calendar with an X mark (red badge). */
export function CancelledGlyph({ size = 22, color = colors.white }: GlyphProps): React.JSX.Element {
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

/** 2. Player Removed: Person bust with minus mark (orange badge). */
export function PlayerRemovedGlyph({ size = 22, color = colors.white }: GlyphProps): React.JSX.Element {
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

/** 3. Owner: Crown with circular peaks (amber badge). */
export function OwnerGlyph({ size = 22, color = colors.white }: GlyphProps): React.JSX.Element {
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

/** 4. Mark Unread: Bullseye circle with centered dot (gray badge). */
export function MarkUnreadGlyph({ size = 22, color = colors.white }: GlyphProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="8" stroke={color} strokeWidth={2.5} />
      <Circle cx="12" cy="12" r="3.5" fill={color} />
    </Svg>
  );
}

/** Time: Clock with hour & minute hands. */
export function TimeGlyph({ size = 22, color = colors.white }: GlyphProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="8.5" stroke={color} strokeWidth={2} />
      <Path
        d="M12 7.5v5l3.5 2"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Players: Two people avatars. */
export function PlayersGlyph({ size = 22, color = colors.white }: GlyphProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="9" cy="7" r="3" stroke={color} strokeWidth={2} />
      <Path
        d="M3 18c0-3 2.7-5 6-5s6 2 6 5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d="M16 4.5a2.5 2.5 0 0 1 0 5M16.5 13.5c2 .5 3.5 1.8 3.5 4.5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Add: Plus sign. */
export function AddGlyph({ size = 22, color = colors.white }: GlyphProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 5v14M5 12h14"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Notifications: Bell icon. */
export function NotificationsGlyph({ size = 22, color = colors.white }: GlyphProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 15h2l-2-2V9a6 6 0 1 0-12 0v4l-2 2h2m12 0a2 2 0 0 1-4 0"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Metadata configuration for each registered icon in image 09 */
export const REGISTRY_CONFIG: Record<
  RegistryIconName,
  {
    color: GradientTokenKey;
    renderGlyph: (props: GlyphProps) => React.JSX.Element;
  }
> = {
  edit: {
    color: 'blue',
    renderGlyph: props => <EditIcon size={props.size ?? 20} color={props.color ?? colors.white} />,
  },
  settings: {
    color: 'gray',
    renderGlyph: props => <TimeGlyph {...props} />,
  },
  time: {
    color: 'blue',
    renderGlyph: props => <TimeGlyph {...props} />,
  },
  location: {
    color: 'red',
    renderGlyph: props => <TimeGlyph {...props} />,
  },
  players: {
    color: 'green',
    renderGlyph: props => <PlayersGlyph {...props} />,
  },
  notifications: {
    color: 'amber',
    renderGlyph: props => <NotificationsGlyph {...props} />,
  },
  delete: {
    color: 'red',
    renderGlyph: props => <TrashIcon size={props.size ?? 20} color={props.color ?? colors.white} />,
  },
  mail: {
    color: 'blue',
    renderGlyph: props => <TimeGlyph {...props} />,
  },
  lock: {
    color: 'amber',
    renderGlyph: props => <TimeGlyph {...props} />,
  },
  search: {
    color: 'blue',
    renderGlyph: props => <TimeGlyph {...props} />,
  },
  camera: {
    color: 'purple',
    renderGlyph: props => <TimeGlyph {...props} />,
  },
  logout: {
    color: 'red',
    renderGlyph: props => <TimeGlyph {...props} />,
  },
  support: {
    color: 'teal',
    renderGlyph: props => <TimeGlyph {...props} />,
  },
  report: {
    color: 'orange',
    renderGlyph: props => <TimeGlyph {...props} />,
  },
  privacy: {
    color: 'blue',
    renderGlyph: props => <TimeGlyph {...props} />,
  },
  terms: {
    color: 'purple',
    renderGlyph: props => <TimeGlyph {...props} />,
  },
  add: {
    color: 'blue',
    renderGlyph: props => <AddGlyph {...props} />,
  },
  success: {
    color: 'green',
    renderGlyph: props => <CheckIcon size={props.size ?? 20} color={props.color ?? colors.white} />,
  },
  globe: {
    color: 'green',
    renderGlyph: props => <TimeGlyph {...props} />,
  },
  trophy: {
    color: 'blue',
    renderGlyph: props => <TimeGlyph {...props} />,
  },
  star: {
    color: 'amber',
    renderGlyph: props => <TimeGlyph {...props} />,
  },
  cancelled: {
    color: 'red',
    renderGlyph: props => <CancelledGlyph {...props} />,
  },
  'player-removed': {
    color: 'orange',
    renderGlyph: props => <PlayerRemovedGlyph {...props} />,
  },
  owner: {
    color: 'amber',
    renderGlyph: props => <OwnerGlyph {...props} />,
  },
  'mark-unread': {
    color: 'gray',
    renderGlyph: props => <MarkUnreadGlyph {...props} />,
  },
};

export interface RegistryIconProps {
  name: RegistryIconName;
  size?: number;
  borderRadius?: number;
  tileOpacity?: number;
  hasShadow?: boolean;
  style?: ViewStyle;
}

export function RegistryIcon({
  name,
  size = 48,
  borderRadius = 14,
  tileOpacity = 1,
  hasShadow = false,
  style,
}: RegistryIconProps): React.JSX.Element {
  const config = REGISTRY_CONFIG[name] ?? REGISTRY_CONFIG.notifications;
  const glyphSize = Math.round(size * 0.48);

  return (
    <View
      style={[
        styles.wrapper,
        { width: size, height: size, opacity: tileOpacity },
        hasShadow && styles.shadow,
        style,
      ]}
    >
      <IconBadge color={config.color} size={size} borderRadius={borderRadius}>
        {config.renderGlyph({ size: glyphSize, color: colors.white })}
      </IconBadge>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
});
