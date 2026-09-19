/**
 * `index.js` registers the FCM background message handler at top level —
 * once, at module load, before the root component is registered — instead of
 * from a component effect (which does not exist when a message wakes a
 * killed app's JS runtime).
 */
import { AppRegistry } from 'react-native';
import * as firebaseMessaging from '@react-native-firebase/messaging';

const mockSetBackgroundMessageHandler = firebaseMessaging.setBackgroundMessageHandler as jest.Mock;

describe('index.js', () => {
  it('registers the background handler exactly once, before registerComponent', () => {
    const registerComponent = jest
      .spyOn(AppRegistry, 'registerComponent')
      .mockImplementation(() => 'Meetup');
    mockSetBackgroundMessageHandler.mockClear();

    // This file has its own module registry, so requiring index runs it once.
    require('../index');

    expect(mockSetBackgroundMessageHandler).toHaveBeenCalledTimes(1);
    expect(registerComponent).toHaveBeenCalledTimes(1);
    expect(mockSetBackgroundMessageHandler.mock.invocationCallOrder[0]).toBeLessThan(
      registerComponent.mock.invocationCallOrder[0],
    );
    registerComponent.mockRestore();
  });

  it('registers a handler that is a no-op resolving without throwing', async () => {
    const [, handler] = mockSetBackgroundMessageHandler.mock.calls[0];
    expect(typeof handler).toBe('function');
    await expect(handler({ data: { notification_type: 'global' } })).resolves.toBeUndefined();
  });
});
