/**
 * Skill-level metadata, keyed by the STORED level value (`SkillLevelValue`,
 * unchanged on the wire). Order, dot count and colour all derive from this
 * one list; display text comes from `LabelsContext` via the label keys below
 * (never from the stored value, never `skill_level.all_levels`).
 */
import { levelColors, levelColorsUnknown } from '../../theme/tokens';
import type { SkillLevelValue } from '../../types/user';

export const SKILL_LEVEL_ORDER: readonly SkillLevelValue[] = ['beginner', 'intermediate', 'expert'];

/** 1-based position in `SKILL_LEVEL_ORDER`; 0 for a stored value this build does not know. */
export function levelDotCount(level: string): number {
  const normalized = level.toLowerCase() as SkillLevelValue;
  return SKILL_LEVEL_ORDER.indexOf(normalized) + 1;
}

export function levelLabelKey(level: string): string {
  return `skill_level.${level.toLowerCase()}`;
}

export function levelDescKey(level: string): string {
  return `${levelLabelKey(level)}.desc`;
}

export function levelTint(level: string): { bg: string; text: string; border: string } {
  const normalized = level.toLowerCase() as SkillLevelValue;
  return levelColors[normalized] ?? (levelColors as any)[level] ?? levelColorsUnknown;
}
