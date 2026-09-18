/**
 * Test-only: mounts a screen inside a REAL native stack and checks its header
 * "+" action. Shared by the Groups/Tournaments header tests, which live in
 * separate files on purpose: React reports a hook-order change once per
 * component name per module registry, so a second screen in the same test
 * file would never see the warning and would pass vacuously.
 */
import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import type { ParamListBase } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { act, pressableLabelled } from './render';

const Stub = () => <Text>stub</Text>;

interface HeaderActionCase {
  screen: React.ComponentType<object>;
  initial: string;
  target: string;
  label: string;
}

export function describeHeaderAction({ screen, initial, target, label }: HeaderActionCase): void {
  const Stack = createNativeStackNavigator();
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await act(async () => {
      renderer?.unmount();
    });
    renderer = undefined;
    errorSpy.mockRestore();
  });

  describe(`${label} header action in a real native stack`, () => {
    it('mounts without a Rules-of-Hooks error and "+" navigates to the registered screen', async () => {
      const ref = createNavigationContainerRef<ParamListBase>();
      await act(async () => {
        renderer = ReactTestRenderer.create(
          <NavigationContainer ref={ref}>
            <Stack.Navigator>
              <Stack.Screen name={initial} component={screen} />
              <Stack.Screen name={target} component={Stub} />
            </Stack.Navigator>
          </NavigationContainer>,
        );
      });

      const logged = errorSpy.mock.calls.map(call => String(call[0]));
      expect(
        logged.filter(message => /order of Hooks|Rules of Hooks|Invalid hook call/i.test(message)),
      ).toEqual([]);
      expect(ref.getCurrentRoute()?.name).toBe(initial);

      await act(async () => pressableLabelled(renderer!.root, label).props.onPress());
      expect(ref.getCurrentRoute()?.name).toBe(target);
    });
  });
}
