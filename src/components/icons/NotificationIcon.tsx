/**
 * Notification Icon component — resolves notification types to their registered
 * gradient badge icon (image 09).
 *
 * Mappings:
 * - event_reminder: time (blue)
 * - event_changed: edit (blue)
 * - event_participant_added: players (green)
 * - waitlist_promoted: success (green)
 * - group_event_created: add (blue)
 * - event_cancelled: cancelled (red)
 * - event_participant_removed: player-removed (orange)
 * - group_ownership_transferred: owner (amber)
 * - group_deleted: delete (red)
 * - Fallback / Unknown types: notifications (amber)
 */
import React from 'react';
import type { ViewStyle } from 'react-native';

import { RegistryIcon, type RegistryIconName } from './RegistryIcons';

export const NOTIFICATION_TYPE_MAP: Record<string, RegistryIconName> = {
  event_reminder: 'time',
  event_changed: 'edit',
  event_participant_added: 'players',
  waitlist_promoted: 'success',
  group_event_created: 'add',
  event_cancelled: 'cancelled',
  event_participant_removed: 'player-removed',
  group_ownership_transferred: 'owner',
  group_deleted: 'delete',
};

export interface NotificationIconProps {
  type: string;
  read?: boolean;
  size?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function NotificationIcon({
  type,
  read = false,
  size = 48,
  borderRadius = 14,
  style,
}: NotificationIconProps): React.JSX.Element {
  const iconName: RegistryIconName = NOTIFICATION_TYPE_MAP[type] ?? 'notifications';

  return (
    <RegistryIcon
      name={iconName}
      size={size}
      borderRadius={borderRadius}
      tileOpacity={read ? 0.6 : 1.0}
      hasShadow={!read}
      style={style}
    />
  );
}

export default NotificationIcon;
