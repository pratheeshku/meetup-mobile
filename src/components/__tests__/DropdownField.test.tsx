import React from 'react';

import {
  act,
  pressableLabelled,
  pressables,
  render,
  texts,
} from '../../test-utils/render';
import DropdownField from '../DropdownField';

const OPTIONS = [
  { value: 'g-1', label: 'Sunday Footballers' },
  { value: 'g-2', label: 'Weekend Warriors' },
];

describe('DropdownField', () => {
  it('shows the placeholder when nothing is selected, and the option label once chosen', () => {
    const root = render(
      <DropdownField
        options={OPTIONS}
        value={null}
        onChange={jest.fn()}
        placeholder="Select a group"
        accessibilityLabel="Group"
      />,
    );
    expect(texts(root)).toContain('Select a group');

    const selected = render(
      <DropdownField
        options={OPTIONS}
        value="g-2"
        onChange={jest.fn()}
        placeholder="Select a group"
        accessibilityLabel="Group"
      />,
    );
    expect(texts(selected)).toContain('Weekend Warriors');
  });

  it('opening the trigger reveals every option, and tapping one selects it and closes', () => {
    const onChange = jest.fn();
    const root = render(
      <DropdownField
        options={OPTIONS}
        value={null}
        onChange={onChange}
        placeholder="Select a group"
        accessibilityLabel="Group"
      />,
    );

    act(() => pressableLabelled(root, 'Group').props.onPress());
    expect(pressableLabelled(root, 'Sunday Footballers')).toBeDefined();
    expect(pressableLabelled(root, 'Weekend Warriors')).toBeDefined();

    act(() => pressableLabelled(root, 'Weekend Warriors').props.onPress());
    expect(onChange).toHaveBeenCalledWith('g-2');
  });

  it('Cancel closes the sheet without calling onChange', () => {
    const onChange = jest.fn();
    const root = render(
      <DropdownField
        options={OPTIONS}
        value={null}
        onChange={onChange}
        placeholder="Select a group"
        accessibilityLabel="Group"
      />,
    );
    act(() => pressableLabelled(root, 'Group').props.onPress());
    act(() => pressableLabelled(root, 'Cancel').props.onPress());
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not open when disabled', () => {
    const root = render(
      <DropdownField
        options={OPTIONS}
        value={null}
        onChange={jest.fn()}
        placeholder="Select a group"
        accessibilityLabel="Group"
        disabled
      />,
    );
    expect(pressableLabelled(root, 'Group').props.disabled).toBe(true);
    expect(
      pressables(root).some(
        p => p.props.accessibilityLabel === 'Sunday Footballers',
      ),
    ).toBe(false);
  });
});
