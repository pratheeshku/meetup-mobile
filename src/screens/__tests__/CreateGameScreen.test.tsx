import React from 'react';

import { pressables, render, texts } from '../../test-utils/render';
import CreateGameScreen from '../CreateGameScreen';

describe('CreateGameScreen (placeholder)', () => {
  it('shows the Coming Soon title and an explanatory subtitle', () => {
    const t = texts(render(<CreateGameScreen />));
    expect(t).toContain('Create Game — Coming Soon');
    expect(t.some(text => /still being built/i.test(text))).toBe(true);
  });

  it('offers no actions (it is an honest placeholder, not a form)', () => {
    expect(pressables(render(<CreateGameScreen />))).toHaveLength(0);
  });
});
