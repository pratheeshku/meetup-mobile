/**
 * Test for RootNavigator Home tab listeners (Item 3):
 * Verifies tabPress listener navigates to Home -> EventsList with filter: undefined.
 */
import { homeTabListeners } from '../RootNavigator';

describe('RootNavigator Home tab listener', () => {
  it('navigates to Home -> EventsList with filter: undefined on tabPress', () => {
    const mockNavigation = { navigate: jest.fn() };
    const listeners = homeTabListeners({ navigation: mockNavigation });

    expect(listeners.tabPress).toBeDefined();
    listeners.tabPress();

    expect(mockNavigation.navigate).toHaveBeenCalledWith('Home', {
      screen: 'EventsList',
      params: { filter: undefined },
    });
  });
});
