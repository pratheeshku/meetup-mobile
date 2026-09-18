import React from 'react';

import { act, pressableLabelled, render } from '../../test-utils/render';
import HeaderAddButton from '../HeaderAddButton';

describe('HeaderAddButton', () => {
  it('is a labelled button that fires onPress', () => {
    const onPress = jest.fn();
    const root = render(<HeaderAddButton label="Create Group" onPress={onPress} />);
    act(() => pressableLabelled(root, 'Create Group').props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
