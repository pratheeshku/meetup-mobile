/**
 * Completion notice (DES-MEETUP-ADDENDUM-nov24-enhancements NV-03): a game saved without its banner shows one toast,
 * "Banner not saved, add it again from Edit game", on the completion screen; none when the notice is absent.
 */
import React from 'react';

import { clearCompletion, showCompletion } from '../../navigation/showCompletion';
import { act, renderAsync, texts } from '../../test-utils/render';
import CompletionScreen from '../CompletionScreen';

jest.mock('../../notifications/notificationRouting', () => ({
  navigationRef: { isReady: () => false, navigate: jest.fn(), dispatch: jest.fn() },
}));

const NOTICE = 'Banner not saved, add it again from Edit game';

afterEach(() => {
  act(() => clearCompletion());
  jest.useRealTimers();
});

describe('completion notice', () => {
  it('shows the notice once as a toast, and it goes after its time', async () => {
    jest.useFakeTimers();
    act(() =>
      showCompletion({ flow: 'game_created', rows: [], primary: 'dashboard', notice: NOTICE }),
    );
    const root = await renderAsync(<CompletionScreen />);
    expect(texts(root).filter(text => text === NOTICE)).toHaveLength(1);

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(texts(root)).not.toContain(NOTICE);
  });

  it('no notice: no toast', async () => {
    act(() => showCompletion({ flow: 'game_updated', rows: [], primary: 'dashboard' }));
    const root = await renderAsync(<CompletionScreen />);
    expect(texts(root)).not.toContain(NOTICE);
  });
});
