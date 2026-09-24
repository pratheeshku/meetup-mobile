/**
 * Unit tests for DateTimePickerField.
 * Covers:
 * - Empty vs populated rendering
 * - iOS modal open, Done (commit), Cancel (discard) for 'date' and 'datetime'
 * - Android native dialog flow for 'date' and two-step 'datetime' (date -> time)
 * - Dismissal handling and disabled state
 */
import React from 'react';
import { Platform } from 'react-native';

import { act, pressableLabelled, render, texts } from '../../test-utils/render';
import DateTimePickerField from '../DateTimePickerField';

describe('DateTimePickerField — Presentation', () => {
  it('renders the placeholder when value is empty', () => {
    const root = render(
      <DateTimePickerField
        accessibilityLabel="Start Date & Time"
        mode="datetime"
        placeholder="Select a date"
        value=""
        onChange={jest.fn()}
      />,
    );
    expect(texts(root)).toContain('Select a date');
  });

  it('renders default placeholder when none provided and value is empty', () => {
    const rootDate = render(
      <DateTimePickerField
        accessibilityLabel="Start Date"
        mode="date"
        value=""
        onChange={jest.fn()}
      />,
    );
    expect(texts(rootDate)).toContain('YYYY-MM-DD');

    const rootDateTime = render(
      <DateTimePickerField
        accessibilityLabel="Start Date & Time"
        mode="datetime"
        value=""
        onChange={jest.fn()}
      />,
    );
    expect(texts(rootDateTime)).toContain('YYYY-MM-DD HH:mm');
  });

  it('renders the formatted value when provided', () => {
    const root = render(
      <DateTimePickerField
        accessibilityLabel="Start Date & Time"
        mode="datetime"
        value="2026-10-01 18:30"
        onChange={jest.fn()}
      />,
    );
    expect(texts(root)).toContain('2026-10-01 18:30');
  });

  it('does not open when disabled', () => {
    const root = render(
      <DateTimePickerField
        accessibilityLabel="Start Date & Time"
        mode="datetime"
        value=""
        onChange={jest.fn()}
        disabled
        testID="test-picker"
      />,
    );
    const trigger = pressableLabelled(root, 'Start Date & Time');
    act(() => {
      trigger.props.onPress();
    });
    expect(root.findAll(n => n.props.testID === 'test-picker-picker')).toHaveLength(0);
  });
});

describe('DateTimePickerField — iOS flow', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    Platform.OS = 'ios';
  });

  afterEach(() => {
    Platform.OS = originalPlatform;
  });

  it('opens modal on trigger tap, and Done commits formatted datetime', () => {
    const onChange = jest.fn();
    const root = render(
      <DateTimePickerField
        accessibilityLabel="Event Start"
        mode="datetime"
        value="2026-09-01 10:00"
        onChange={onChange}
        testID="dt-ios"
      />,
    );

    // Open modal
    act(() => {
      pressableLabelled(root, 'Event Start').props.onPress();
    });

    // Find DateTimePicker mock inside modal
    const picker = root.find(n => n.props.testID === 'dt-ios-picker');
    expect(picker).toBeDefined();
    expect(picker.props.mode).toBe('datetime');
    expect(picker.props.display).toBe('spinner');

    // Simulate picker date change
    act(() => {
      picker.props.onChange({ type: 'set' }, new Date(2026, 9, 15, 14, 30));
    });

    // Tap Done
    act(() => {
      pressableLabelled(root, 'Done').props.onPress();
    });

    expect(onChange).toHaveBeenCalledWith('2026-10-15 14:30');
  });

  it('Cancel discards changes without calling onChange', () => {
    const onChange = jest.fn();
    const root = render(
      <DateTimePickerField
        accessibilityLabel="Event Start"
        mode="datetime"
        value="2026-09-01 10:00"
        onChange={onChange}
        testID="dt-ios-cancel"
      />,
    );

    act(() => {
      pressableLabelled(root, 'Event Start').props.onPress();
    });

    const picker = root.find(n => n.props.testID === 'dt-ios-cancel-picker');
    act(() => {
      picker.props.onChange({ type: 'set' }, new Date(2026, 9, 20, 12, 0));
    });

    act(() => {
      pressableLabelled(root, 'Cancel').props.onPress();
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('commits formatted date-only for mode="date"', () => {
    const onChange = jest.fn();
    const root = render(
      <DateTimePickerField
        accessibilityLabel="Tournament Start"
        mode="date"
        value=""
        onChange={onChange}
        testID="dt-ios-date"
      />,
    );

    act(() => {
      pressableLabelled(root, 'Tournament Start').props.onPress();
    });

    const picker = root.find(n => n.props.testID === 'dt-ios-date-picker');
    expect(picker.props.mode).toBe('date');

    act(() => {
      picker.props.onChange({ type: 'set' }, new Date(2026, 11, 25));
    });

    act(() => {
      pressableLabelled(root, 'Done').props.onPress();
    });

    expect(onChange).toHaveBeenCalledWith('2026-12-25');
  });
});

describe('DateTimePickerField — Android flow', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    Platform.OS = 'android';
  });

  afterEach(() => {
    Platform.OS = originalPlatform;
  });

  it('mode="date": sets date directly upon Android dialog confirmation', () => {
    const onChange = jest.fn();
    const root = render(
      <DateTimePickerField
        accessibilityLabel="Game Date"
        mode="date"
        value=""
        onChange={onChange}
        testID="dt-android-date"
      />,
    );

    act(() => {
      pressableLabelled(root, 'Game Date').props.onPress();
    });

    const picker = root.find(n => n.props.testID === 'dt-android-date-picker');
    expect(picker.props.mode).toBe('date');

    act(() => {
      picker.props.onChange({ type: 'set' }, new Date(2026, 7, 10));
    });

    expect(onChange).toHaveBeenCalledWith('2026-08-10');
    // Picker unmounts after confirmation
    expect(root.findAll(n => n.props.testID === 'dt-android-date-picker')).toHaveLength(0);
  });

  it('mode="datetime": executes two-step Android flow (date then time)', () => {
    const onChange = jest.fn();
    const root = render(
      <DateTimePickerField
        accessibilityLabel="Game Date & Time"
        mode="datetime"
        value=""
        onChange={onChange}
        testID="dt-android-dt"
      />,
    );

    // Step 0: Open picker
    act(() => {
      pressableLabelled(root, 'Game Date & Time').props.onPress();
    });

    // Step 1: Date dialog
    const datePicker = root.find(n => n.props.testID === 'dt-android-dt-picker');
    expect(datePicker.props.mode).toBe('date');

    act(() => {
      datePicker.props.onChange({ type: 'set' }, new Date(2026, 5, 20));
    });

    // Step 2: Time dialog automatically rendered
    const timePicker = root.find(n => n.props.testID === 'dt-android-dt-picker');
    expect(timePicker.props.mode).toBe('time');
    expect(onChange).not.toHaveBeenCalled(); // Not yet committed

    // User confirms time
    const timeDate = new Date();
    timeDate.setHours(19, 45, 0, 0);
    act(() => {
      timePicker.props.onChange({ type: 'set' }, timeDate);
    });

    expect(onChange).toHaveBeenCalledWith('2026-06-20 19:45');
    expect(root.findAll(n => n.props.testID === 'dt-android-dt-picker')).toHaveLength(0);
  });

  it('dismissing the Android dialog closes the picker without updating', () => {
    const onChange = jest.fn();
    const root = render(
      <DateTimePickerField
        accessibilityLabel="Game Date"
        mode="date"
        value=""
        onChange={onChange}
        testID="dt-android-dismiss"
      />,
    );

    act(() => {
      pressableLabelled(root, 'Game Date').props.onPress();
    });

    const picker = root.find(n => n.props.testID === 'dt-android-dismiss-picker');
    act(() => {
      picker.props.onChange({ type: 'dismissed' });
    });

    expect(onChange).not.toHaveBeenCalled();
    expect(root.findAll(n => n.props.testID === 'dt-android-dismiss-picker')).toHaveLength(0);
  });
});
