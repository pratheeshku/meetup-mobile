import React from 'react';

import { act, pressableWithText, render, texts } from '../../../test-utils/render';
import type { Instance } from '../../../test-utils/render';
import type { Sport } from '../../../types/sport';
import SkillLevelFlow from '../SkillLevelFlow';
import { control, controls, tap } from '../../../test-utils/skillControls';

const SPORTS: Sport[] = [
  { name: 'badminton', display_name: 'Badminton', slug: 'badminton' },
  { name: 'tennis', display_name: 'Tennis', slug: 'tennis' },
];

function flow(props: Partial<React.ComponentProps<typeof SkillLevelFlow>> = {}) {
  const onSave = jest.fn();
  const root = render(
    <SkillLevelFlow
      sports={SPORTS}
      nextLabel="Next"
      backLabel="Back"
      saveLabel="Save"
      onSave={onSave}
      {...props}
    />,
  );
  return { root, onSave };
}
const press = (root: Instance, text: string): void => {
  act(() => pressableWithText(root, text).props.onPress());
};
const alerts = (root: Instance): Instance[] =>
  root.findAll(node => node.props.accessibilityRole === 'alert', { deep: false });

describe('SkillLevelFlow', () => {
  it('starts on the sport picker with the labelled title and subtitle, and no level cards', () => {
    const { root } = flow();
    expect(texts(root)).toEqual(expect.arrayContaining(['What do you play?', 'Select all that apply. Level comes next.']));
    expect(controls(root, 'checkbox')).toHaveLength(2);
    expect(controls(root, 'radio')).toHaveLength(0);
  });

  it('keeps Next disabled until a sport is picked', () => {
    const { root } = flow();
    expect(pressableWithText(root, 'Next').props.disabled).toBe(true);
    tap(root, 'checkbox', 'Tennis');
    expect(pressableWithText(root, 'Next').props.disabled).toBe(false);
  });

  it('shows one level card per selected sport only, in list order', () => {
    const { root } = flow();
    tap(root, 'checkbox', 'Tennis');
    press(root, 'Next');
    expect(texts(root)).toEqual(expect.arrayContaining(['How good are you?', 'One level per sport. Change it anytime.']));
    expect(controls(root, 'radio').map(node => node.props.accessibilityLabel)).toEqual([
      'Tennis, Beginner',
      'Tennis, Intermediate',
      'Tennis, Expert',
    ]);
  });

  it('has no default level: Save with a sport still unlevelled shows the inline hint and does not save', () => {
    const { root, onSave } = flow();
    tap(root, 'checkbox', 'Badminton');
    tap(root, 'checkbox', 'Tennis');
    press(root, 'Next');
    expect(controls(root, 'radio').filter(node => node.props.accessibilityState.selected)).toHaveLength(0);
    expect(alerts(root)).toHaveLength(0);

    press(root, 'Save');
    expect(onSave).not.toHaveBeenCalled();
    expect(alerts(root)).toHaveLength(1);
    expect(texts(alerts(root)[0])).toEqual(['Pick a level to continue']);

    // Only one of two levelled: still blocked.
    tap(root, 'radio', 'Badminton, Beginner');
    expect(alerts(root)).toHaveLength(0); // hint clears on change
    press(root, 'Save');
    expect(onSave).not.toHaveBeenCalled();
    expect(alerts(root)).toHaveLength(1);
  });

  it('saves a level for every selected sport once all have one', () => {
    const { root, onSave } = flow();
    tap(root, 'checkbox', 'Badminton');
    tap(root, 'checkbox', 'Tennis');
    press(root, 'Next');
    tap(root, 'radio', 'Badminton, Beginner');
    tap(root, 'radio', 'Tennis, Expert');
    tap(root, 'radio', 'Tennis, Intermediate'); // change of mind
    press(root, 'Save');
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({ badminton: 'Beginner', tennis: 'Intermediate' });
  });

  it('deselecting a sport drops it and its level; Back returns to the picker keeping the selection', () => {
    const { root, onSave } = flow();
    tap(root, 'checkbox', 'Badminton');
    tap(root, 'checkbox', 'Tennis');
    press(root, 'Next');
    tap(root, 'radio', 'Tennis, Expert');
    press(root, 'Back');
    expect(control(root, 'checkbox', 'Tennis').props.accessibilityState.checked).toBe(true);
    tap(root, 'checkbox', 'Tennis'); // deselect
    tap(root, 'checkbox', 'Badminton'); // still selected -> deselect too, then reselect
    tap(root, 'checkbox', 'Badminton');
    press(root, 'Next');
    expect(controls(root, 'radio').map(node => node.props.accessibilityLabel)).toEqual([
      'Badminton, Beginner',
      'Badminton, Intermediate',
      'Badminton, Expert',
    ]);
    tap(root, 'radio', 'Badminton, Expert');
    press(root, 'Save');
    expect(onSave).toHaveBeenCalledWith({ badminton: 'Expert' });
  });

  it('pre-selects initial levels and shows them already chosen', () => {
    const { root, onSave } = flow({ initialLevels: { tennis: 'Expert' } });
    expect(control(root, 'checkbox', 'Tennis').props.accessibilityState.checked).toBe(true);
    press(root, 'Next');
    expect(control(root, 'radio', 'Tennis, Expert').props.accessibilityState.selected).toBe(true);
    press(root, 'Save');
    expect(onSave).toHaveBeenCalledWith({ tennis: 'Expert' });
  });

  it('shows a caller-supplied save error inline and renders the footer', () => {
    const { root } = flow({
      initialLevels: { tennis: 'Expert' },
      error: 'Could not save',
      footer: <></>,
    });
    press(root, 'Next');
    expect(texts(alerts(root)[0])).toEqual(['Could not save']);
  });
});
