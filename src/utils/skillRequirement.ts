/**
 * Display + option helpers for an event's `skill_level_requirement`
 * (wire values `all_levels | beginner | intermediate | expert`). The UI
 * label for `expert` is "Advanced"; `all_levels` shows "All levels". This is
 * the game requirement, not a player's own skill (`components/skills`).
 */
import type { LabelKey } from '../labels/fallbackLabels';
import type { EventSkillLevel } from '../types/event';

/** Pill order: row 1 = All levels, Beginner; row 2 = Intermediate, Advanced. */
export const SKILL_REQUIREMENT_OPTIONS: readonly EventSkillLevel[] = [
  'all_levels',
  'beginner',
  'intermediate',
  'expert',
];

export const DEFAULT_SKILL_REQUIREMENT: EventSkillLevel = 'all_levels';

export function skillRequirementLabelKey(level: EventSkillLevel): LabelKey {
  switch (level) {
    case 'all_levels':
      return 'mob.skill_requirement.all_levels';
    case 'beginner':
      return 'mob.skill_requirement.beginner';
    case 'intermediate':
      return 'mob.skill_requirement.intermediate';
    case 'expert':
      return 'mob.skill_requirement.expert';
    default: {
      const exhaustive: never = level;
      return exhaustive;
    }
  }
}

/** Narrow an API string to a known level; null/unknown → `fallback`. */
export function toSkillRequirement(
  raw: string | null | undefined,
  fallback: EventSkillLevel = DEFAULT_SKILL_REQUIREMENT,
): EventSkillLevel {
  return SKILL_REQUIREMENT_OPTIONS.includes(raw as EventSkillLevel)
    ? (raw as EventSkillLevel)
    : fallback;
}
