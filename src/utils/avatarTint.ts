/** Deterministic avatar tint + initials for list rows without a photo. */
import { colors } from '../theme/tokens';

const AVATAR_TINTS = [
  { bg: colors.avatarTint1, text: colors.avatarTintText1 },
  { bg: colors.avatarTint2, text: colors.avatarTintText2 },
  { bg: colors.avatarTint3, text: colors.avatarTintText3 },
  { bg: colors.avatarTint4, text: colors.avatarTintText4 },
  { bg: colors.avatarTint5, text: colors.avatarTintText5 },
];

export function getAvatarTint(name: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return AVATAR_TINTS[Math.abs(hash) % AVATAR_TINTS.length];
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  }
  return (name.trim().slice(0, 2) || '?').toUpperCase();
}
