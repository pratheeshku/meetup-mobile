/**
 * The force-update gate at the level of the whole app: the REAL `App`
 * (providers, navigation, login screen) over a faked transport. When the
 * installed build is below the minimum, the blocking screen must sit above ALL
 * navigation — the login screen included — and nothing behind it may be
 * reachable.
 */
import React from 'react';
import { AppState, BackHandler } from 'react-native';
import Config from 'react-native-config';
import ReactTestRenderer from 'react-test-renderer';

import App from '../App';
import { installFakeBackend } from '../src/test-utils/apiHarness';
import type { FakeBackend } from '../src/test-utils/apiHarness';
import { pressables, texts } from '../src/test-utils/render';

// SafeAreaProvider renders nothing until native insets arrive (never, in Jest);
// the library ships an official mock for exactly this.
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

const INSTALLED = 5;
const STORE = 'https://play.google.com/store/apps/details?id=org.duckdns.meetups';

let backend: FakeBackend;
let renderer: ReactTestRenderer.ReactTestRenderer | null = null;
let backHandlers: Array<() => boolean>;

const servePolicy = (min: number): void => {
  backend.route = config => {
    if (config.url === '/app/version-policy') {
      return { data: { android: { min_version_code: min, store_url: STORE } } };
    }
    if (config.url === '/auth/refresh') {
      return { data: { access_token: null } }; // signed out: no session to restore
    }
    return { status: 404 };
  };
};

const mountApp = async (): Promise<ReactTestRenderer.ReactTestRendererJSON | ReactTestRenderer.ReactTestRendererJSON[] | null> => {
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });
  return (renderer as unknown as ReactTestRenderer.ReactTestRenderer).toJSON();
};
const root = () => (renderer as unknown as ReactTestRenderer.ReactTestRenderer).root;

beforeEach(() => {
  backend = installFakeBackend();
  (Config as Record<string, unknown>).VERSION_CODE = INSTALLED;
  jest.spyOn(console, 'log').mockImplementation(() => {});
  (AppState as unknown as { currentState: string }).currentState = 'active';
  backHandlers = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((_e: string, handler: () => boolean) => {
    backHandlers.push(handler);
    return { remove: () => {
        backHandlers.splice(backHandlers.indexOf(handler), 1);
      },
    };
  }) as never);
});

afterEach(() => {
  ReactTestRenderer.act(() => {
    renderer?.unmount();
  });
  renderer = null;
  delete (Config as Record<string, unknown>).VERSION_CODE;
  jest.restoreAllMocks();
});

describe('App with the force-update gate', () => {
  it('below the minimum: the blocking screen replaces the login screen and all navigation', async () => {
    servePolicy(INSTALLED + 1);

    await mountApp();

    const visible = texts(root());
    expect(visible).toEqual(expect.arrayContaining(['Update required', 'Please update Shuttlr to continue.', 'Update']));
    expect(visible).not.toContain('Sign In'); // the login screen is not reachable
    expect(visible).not.toContain("Don't have an account? Register");
    expect(pressables(root())).toHaveLength(1); // only "Update": no tabs, links or sign-in controls
  });

  it('below the minimum: the back button is consumed', async () => {
    servePolicy(INSTALLED + 1);

    await mountApp();

    expect(backHandlers.length).toBeGreaterThanOrEqual(1);
    expect(backHandlers[backHandlers.length - 1]()).toBe(true);
    expect(texts(root())).toContain('Update required');
  });

  it('at or above the minimum: the normal app (login screen) is shown, no blocking screen', async () => {
    servePolicy(INSTALLED);

    await mountApp();

    const visible = texts(root());
    expect(visible).toContain('Sign In');
    expect(visible).not.toContain('Update required');
  });

  it('when the policy check fails: the normal app is shown (fails open)', async () => {
    backend.route = config =>
      config.url === '/app/version-policy' ? { network: true } : { data: { access_token: null } };

    await mountApp();

    const visible = texts(root());
    expect(visible).toContain('Sign In');
    expect(visible).not.toContain('Update required');
  });
});
