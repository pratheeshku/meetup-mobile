import React from 'react';
import { StyleSheet } from 'react-native';

import { render, texts } from '../../../test-utils/render';
import type { Sport } from '../../../types/sport';
import SportPicker from '../SportPicker';
import { control, controls, hostViews, styleOf, tap } from '../../../test-utils/skillControls';

const SPORTS: Sport[] = [
  { name: 'badminton', display_name: 'Badminton', slug: 'badminton' },
  { name: 'tennis', display_name: 'Tennis', slug: 'tennis' },
  { name: 'table_tennis', display_name: 'Table Tennis' },
];

describe('SportPicker', () => {
  it('renders one checkbox tile per sport, showing the display name', () => {
    const root = render(<SportPicker sports={SPORTS} selected={[]} onToggle={jest.fn()} />);
    expect(controls(root, 'checkbox').map(node => node.props.accessibilityLabel)).toEqual([
      'Badminton',
      'Tennis',
      'Table Tennis',
    ]);
    expect(texts(root)).toEqual(['Badminton', 'Tennis', 'Table Tennis']);
  });

  it('lays tiles out in two wrapping columns', () => {
    const root = render(<SportPicker sports={SPORTS} selected={[]} onToggle={jest.fn()} />);
    const grid = root.findAll(
      node => (node.type as unknown) === 'View' && StyleSheet.flatten(node.props.style)?.flexWrap === 'wrap',
    );
    expect(grid).toHaveLength(1);
    expect(styleOf(control(root, 'checkbox', 'Tennis')).width).toBe('48%');
  });

  it('marks selected tiles checked and shows a tick badge only on them', () => {
    const root = render(
      <SportPicker sports={SPORTS} selected={['tennis']} onToggle={jest.fn()} />,
    );
    expect(control(root, 'checkbox', 'Tennis').props.accessibilityState.checked).toBe(true);
    expect(control(root, 'checkbox', 'Badminton').props.accessibilityState.checked).toBe(false);
    expect(hostViews(root, 'sport-tick')).toHaveLength(1);
  });

  it('reports the sport name (not the label) when a tile is tapped', () => {
    const onToggle = jest.fn();
    const root = render(<SportPicker sports={SPORTS} selected={[]} onToggle={onToggle} />);
    tap(root, 'checkbox', 'Table Tennis');
    expect(onToggle).toHaveBeenCalledWith('table_tennis');
  });

  it('keeps touch targets at least 44pt', () => {
    const root = render(<SportPicker sports={SPORTS} selected={[]} onToggle={jest.fn()} />);
    expect(styleOf(control(root, 'checkbox', 'Badminton')).minHeight as number).toBeGreaterThanOrEqual(44);
  });

  it('does not report taps while disabled', () => {
    const root = render(<SportPicker sports={SPORTS} selected={[]} onToggle={jest.fn()} disabled />);
    expect(control(root, 'checkbox', 'Tennis').props.disabled).toBe(true);
  });
});
