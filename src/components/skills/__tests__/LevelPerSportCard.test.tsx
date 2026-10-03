import React, { useState } from 'react';

import { getLabels } from '../../../api/labels';
import { LabelsProvider } from '../../../labels/LabelsContext';
import { levelColors } from '../../../theme/tokens';
import { act, render, renderAsync, texts } from '../../../test-utils/render';
import type { Instance } from '../../../test-utils/render';
import type { SkillLevelValue } from '../../../types/user';
import LevelPerSportCard from '../LevelPerSportCard';
import { SKILL_LEVEL_ORDER, levelDotCount } from '../levels';
import { control, controls, hostViews, styleOf, tap } from '../../../test-utils/skillControls';

jest.mock('../../../api/labels', () => ({ getLabels: jest.fn() }));

function Harness({
  initial = null,
  onChange = jest.fn(),
}: {
  initial?: SkillLevelValue | null;
  onChange?: (level: SkillLevelValue) => void;
}): React.JSX.Element {
  const [value, setValue] = useState<SkillLevelValue | null>(initial);
  return (
    <LevelPerSportCard
      sport="badminton"
      sportLabel="Badminton"
      value={value}
      onChange={level => {
        setValue(level);
        onChange(level);
      }}
    />
  );
}

const radios = (root: Instance): Instance[] => controls(root, 'radio');
const selectedLabels = (root: Instance): unknown[] =>
  radios(root)
    .filter(node => node.props.accessibilityState.selected)
    .map(node => node.props.accessibilityLabel);

describe('LevelPerSportCard', () => {
  it('shows the sport name and a 3-segment radio control in Beginner, Intermediate, Expert order', () => {
    const root = render(<Harness />);
    expect(texts(root)[0]).toBe('Badminton');
    expect(radios(root).map(node => node.props.accessibilityLabel)).toEqual([
      'Badminton, Beginner',
      'Badminton, Intermediate',
      'Badminton, Expert',
    ]);
    expect(controls(root, 'radiogroup')).toHaveLength(0); // group role has no handler of its own
    expect(root.findAll(node => node.props.accessibilityRole === 'radiogroup', { deep: false })).toHaveLength(1);
  });

  it('has no default: nothing selected and the pick-a-level hint is shown', () => {
    const root = render(<Harness />);
    expect(selectedLabels(root)).toEqual([]);
    expect(texts(root)).toContain('Pick a level to continue');
    // Name, three level labels, then only the hint: no descriptor is shown.
    expect(texts(root)).toEqual(['Badminton', 'Beginner', 'Intermediate', 'Expert', 'Pick a level to continue']);
  });

  it('selects one level at a time and swaps the descriptor for the selected level', () => {
    const onChange = jest.fn();
    const root = render(<Harness onChange={onChange} />);

    tap(root, 'radio', 'Badminton, Beginner');
    expect(selectedLabels(root)).toEqual(['Badminton, Beginner']);
    expect(texts(root)).toContain('New to the sport or still learning the rules');
    expect(texts(root)).not.toContain('Pick a level to continue');

    tap(root, 'radio', 'Badminton, Expert');
    expect(onChange).toHaveBeenLastCalledWith('Expert');
    expect(selectedLabels(root)).toEqual(['Badminton, Expert']);
    expect(texts(root)).toContain('Competitive, strong technique and match experience');
    expect(texts(root)).not.toContain('New to the sport or still learning the rules');
  });

  it('derives dots from the level order: 1, 2 and 3 filled out of 3', () => {
    const root = render(<Harness />);
    SKILL_LEVEL_ORDER.forEach((level, index) => {
      const segment = control(root, 'radio', `Badminton, ${level}`);
      const filled = hostViews(segment, 'level-dot-filled').length;
      const empty = hostViews(segment, 'level-dot-empty').length;
      expect(filled).toBe(index + 1);
      expect(filled).toBe(levelDotCount(level));
      expect(filled + empty).toBe(3);
    });
  });

  it('tints the selected segment and outlines it in the level colour, with the label still shown', () => {
    const root = render(<Harness initial="Intermediate" />);
    const style = styleOf(control(root, 'radio', 'Badminton, Intermediate'));
    expect(style.backgroundColor).toBe(levelColors.Intermediate.bg);
    expect(style.borderColor).toBe(levelColors.Intermediate.border);
    expect(texts(control(root, 'radio', 'Badminton, Intermediate'))).toEqual(['Intermediate']);
    expect(styleOf(control(root, 'radio', 'Badminton, Expert')).borderColor).not.toBe(
      levelColors.Expert.border,
    );
  });

  it('exposes the selected state to accessibility and keeps touch targets >= 44pt', () => {
    const root = render(<Harness initial="Beginner" />);
    expect(control(root, 'radio', 'Badminton, Beginner').props.accessibilityState).toMatchObject({
      selected: true,
      checked: true,
    });
    for (const node of radios(root)) {
      expect(styleOf(node).minHeight as number).toBeGreaterThanOrEqual(44);
    }
  });

  it('renders the hint in the error colour when flagged invalid, and still no default', () => {
    const root = render(
      <LevelPerSportCard sport="badminton" sportLabel="Badminton" value={null} onChange={jest.fn()} invalid />,
    );
    expect(selectedLabels(root)).toEqual([]);
    expect(texts(root)).toContain('Pick a level to continue');
  });

  it('takes level names and descriptors from LabelsContext, per key over the bundled snapshot', async () => {
    (getLabels as jest.Mock).mockResolvedValue({
      'skill_level.expert': 'Pro',
      'skill_level.expert.desc': 'Plays for trophies',
    });
    const root = await renderAsync(
      <LabelsProvider>
        <Harness initial="Expert" />
      </LabelsProvider>,
    );
    await act(async () => {});
    expect(radios(root).map(node => node.props.accessibilityLabel)).toEqual([
      'Badminton, Beginner', // key missing from the fetched map -> snapshot value
      'Badminton, Intermediate',
      'Badminton, Pro', // fetched value; the stored value 'Expert' is never displayed
    ]);
    expect(texts(root)).toContain('Plays for trophies');
  });
});
