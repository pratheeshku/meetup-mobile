/**
 * NotificationCard — individual swipeable notification card component.
 *
 * Visual specifications (images 01-13):
 * - Unread: bg #EAF1FF, border #C6D9FF, title weight 800, body #52617E, blue time and 10px blue dot, full-colour icon tile.
 * - Read: white, border #E3EAF7, title weight 600, body #62718F, grey time, no dot, icon tile at 60% opacity with no shadow.
 * - Swipe left: reveals one 96px action button.
 *   - Unread shows "Mark read" (blue #1961F7, success checkmark icon).
 *   - Read shows "Mark unread" (grey #52617E, mark-unread icon).
 * - Accessible alternatives: custom accessibility action ('toggle_read') and long-press.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useT } from '../labels/LabelsContext';
import type { NotificationHistoryItem } from '../types/notification';
import { formatNotificationCardTime } from '../utils/notificationDateUtils';
import { CheckIcon, MarkUnreadIcon } from './icons/ActionIcons';
import NotificationIcon from './icons/NotificationIcon';

const ACTION_WIDTH = 96;

export interface NotificationCardProps {
  item: NotificationHistoryItem;
  onPress: (item: NotificationHistoryItem) => void;
  onToggleRead: (item: NotificationHistoryItem) => void;
  isOpen?: boolean;
  onOpen?: (id: string) => void;
  onClose?: (id: string) => void;
  now?: Date;
}

export default function NotificationCard({
  item,
  onPress,
  onToggleRead,
  isOpen = false,
  onOpen,
  onClose,
  now,
}: NotificationCardProps): React.JSX.Element {
  const t = useT();
  const isUnread = item.read_at === null;
  const translateX = useRef(new Animated.Value(isOpen ? -ACTION_WIDTH : 0)).current;
  const [swipedOpen, setSwipedOpen] = useState(isOpen);

  useEffect(() => {
    if (isOpen !== swipedOpen) {
      setSwipedOpen(isOpen);
      Animated.spring(translateX, {
        toValue: isOpen ? -ACTION_WIDTH : 0,
        useNativeDriver: true,
        bounciness: 0,
      }).start();
    }
  }, [isOpen, swipedOpen, translateX]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        // Trigger on horizontal drag exceeding 10px
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderMove: (_evt, gestureState) => {
        const base = swipedOpen ? -ACTION_WIDTH : 0;
        const newX = Math.min(0, Math.max(-ACTION_WIDTH * 1.2, base + gestureState.dx));
        translateX.setValue(newX);
      },
      onPanResponderRelease: (_evt, gestureState) => {
        const threshold = -ACTION_WIDTH / 2;
        const base = swipedOpen ? -ACTION_WIDTH : 0;
        const targetX = base + gestureState.dx;

        if (targetX < threshold) {
          // Open
          setSwipedOpen(true);
          Animated.spring(translateX, {
            toValue: -ACTION_WIDTH,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
          onOpen?.(item.id);
        } else {
          // Close
          setSwipedOpen(false);
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
          onClose?.(item.id);
        }
      },
    }),
  ).current;

  const rawTitle = item.payload?.display?.title ?? item.title;
  const title =
    rawTitle && rawTitle.trim() ? rawTitle.trim() : t('mob.notif_history.fallback_title');
  const rawBody = item.payload?.display?.body ?? item.body;
  const body = rawBody && rawBody.trim() ? rawBody.trim() : '';
  const timeText = formatNotificationCardTime(item.created_at, now);

  const toggleActionLabel = isUnread
    ? t('mob.notif_history.action_mark_read')
    : t('mob.notif_history.action_mark_unread');

  const accessibilityLabel = `${isUnread ? `${t('mob.notif_history.unread_prefix')} ` : ''}${title}${
    body ? `. ${body}` : ''
  }. ${timeText}`;

  const handleCardPress = (): void => {
    if (swipedOpen) {
      setSwipedOpen(false);
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 0,
      }).start();
      onClose?.(item.id);
      return;
    }
    onPress(item);
  };

  const handleActionPress = (): void => {
    setSwipedOpen(false);
    translateX.setValue(0);
    onClose?.(item.id);
    onToggleRead(item);
  };

  return (
    <View style={styles.cardOuter}>
      {/* Background Revealed Action Button (96px) */}
      <View
        style={[
          styles.actionBackground,
          isUnread ? styles.actionUnreadBg : styles.actionReadBg,
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={toggleActionLabel}
          onPress={handleActionPress}
          style={styles.actionButton}
        >
          {isUnread ? (
            <CheckIcon size={24} color="#FFFFFF" />
          ) : (
            <MarkUnreadIcon size={24} color="#FFFFFF" />
          )}
          <Text style={styles.actionText}>{toggleActionLabel}</Text>
        </Pressable>
      </View>

      {/* Foreground Animated Content */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.cardForeground,
          isUnread ? styles.cardUnread : styles.cardRead,
          { transform: [{ translateX }] },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityActions={[{ name: 'toggle_read', label: toggleActionLabel }]}
          onAccessibilityAction={event => {
            if (event.nativeEvent.actionName === 'toggle_read') {
              onToggleRead(item);
            }
          }}
          onPress={handleCardPress}
          onLongPress={() => onToggleRead(item)}
          style={({ pressed }) => [styles.pressableContent, pressed && styles.pressed]}
        >
          {/* Left Icon Badge */}
          <NotificationIcon
            type={item.notification_type}
            read={!isUnread}
            size={48}
            borderRadius={14}
          />

          {/* Center Title & Body */}
          <View style={styles.textContainer}>
            <Text
              style={[styles.title, isUnread ? styles.titleUnread : styles.titleRead]}
              numberOfLines={2}
            >
              {title}
            </Text>
            {body ? (
              <Text
                style={[styles.body, isUnread ? styles.bodyUnread : styles.bodyRead]}
                numberOfLines={2}
              >
                {body}
              </Text>
            ) : null}
          </View>

          {/* Right Column: Time and Blue Dot */}
          <View style={styles.metaContainer}>
            <Text
              style={[styles.time, isUnread ? styles.timeUnread : styles.timeRead]}
            >
              {timeText}
            </Text>
            {isUnread ? <View style={styles.blueDot} /> : null}
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardOuter: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  actionBackground: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
  },
  actionUnreadBg: {
    backgroundColor: '#1961F7',
  },
  actionReadBg: {
    backgroundColor: '#52617E',
  },
  actionButton: {
    width: ACTION_WIDTH,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  actionText: {
    fontFamily: 'Plus Jakarta Sans',
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
  cardForeground: {
    width: '100%',
    borderRadius: 16,
  },
  cardUnread: {
    backgroundColor: '#EAF1FF',
    borderWidth: 1.5,
    borderColor: '#C6D9FF',
  },
  cardRead: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E3EAF7',
  },
  pressableContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 76,
  },
  pressed: {
    opacity: 0.85,
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 15,
    lineHeight: 20,
    color: '#0F2347',
  },
  titleUnread: {
    fontWeight: '800',
  },
  titleRead: {
    fontWeight: '600',
  },
  body: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  bodyUnread: {
    color: '#52617E',
  },
  bodyRead: {
    color: '#62718F',
  },
  metaContainer: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    alignSelf: 'flex-start',
    paddingTop: 2,
    minWidth: 50,
  },
  time: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 12,
    textAlign: 'right',
  },
  timeUnread: {
    color: '#1961F7',
    fontWeight: '600',
  },
  timeRead: {
    color: '#62718F',
    fontWeight: '500',
  },
  blueDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1961F7',
    marginTop: 8,
    alignSelf: 'center',
  },
});
