import { Linking } from 'react-native';
import { getActionFromState } from '@react-navigation/native';

import { _resetLinkGateForTesting, reportUpdatePolicy } from '../linkGate';
import { createLinking } from '../linking';
import { _resetLinkStoreForTesting, getResetToken } from '../linkStore';
import type { LinkState } from '../resolveLink';

jest.mock('../../diagnostics/perfLog', () => ({ perfLog: jest.fn() }));

const ID = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b';
const RESET = 'Zk3-_abcdefghijklmnopqrstuvwxyz0123456789ABCDE';
const flush = (): Promise<void> => new Promise(resolve => setImmediate(resolve));

beforeEach(() => {
  _resetLinkGateForTesting();
  _resetLinkStoreForTesting();
  jest.restoreAllMocks();
});

describe('createLinking', () => {
  it('claims only https and this build\'s link host (production in tests)', () => {
    expect(createLinking(() => false).prefixes).toEqual(['https://meetupaws.duckdns.org']);
  });

  it('getStateFromPath uses the sign-in state at the moment of the call (closed or open app)', () => {
    let signedIn = false;
    const linking = createLinking(() => signedIn);
    const out = linking.getStateFromPath!(`/l/game/${ID}`, { screens: {} }) as LinkState;
    expect(out.routes.map(r => r.name)).toEqual(['Login', 'GamePreview']);
    signedIn = true;
    const inn = linking.getStateFromPath!(`/l/game/${ID}`, { screens: {} }) as LinkState;
    expect(inn.routes[0].name).toBe('Tabs');
    expect(getActionFromState(inn)).toBeDefined();
  });

  it('closed app: the initial URL waits for the force-update gate and never resolves while blocked', async () => {
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(`https://meetupaws.duckdns.org/l/reset#token=${RESET}`);
    const linking = createLinking(() => false);
    const spy = jest.fn();
    Promise.resolve(linking.getInitialURL!()).then(spy);
    await flush();
    expect(spy).not.toHaveBeenCalled();

    reportUpdatePolicy(true); // blocked: no link may navigate behind the blocking screen
    await flush();
    expect(spy).not.toHaveBeenCalled();

    reportUpdatePolicy(false); // a later re-check says the build is fine
    await flush();
    expect(spy).toHaveBeenCalledWith(`https://meetupaws.duckdns.org/l/reset#token=${RESET}`);
  });

  it('open app: URL events are held until the gate opens, then delivered', async () => {
    let handler: ((event: { url: string }) => void) | undefined;
    const remove = jest.fn();
    jest.spyOn(Linking, 'addEventListener').mockImplementation(((_type: string, cb: (event: { url: string }) => void) => {
      handler = cb;
      return { remove };
    }) as never);
    const listener = jest.fn();
    const unsubscribe = createLinking(() => true).subscribe!(listener);

    handler!({ url: `https://meetupaws.duckdns.org/l/game/${ID}` });
    await flush();
    expect(listener).not.toHaveBeenCalled();

    reportUpdatePolicy(false);
    await flush();
    expect(listener).toHaveBeenCalledWith(`https://meetupaws.duckdns.org/l/game/${ID}`);
    (unsubscribe as () => void)();
    expect(remove).toHaveBeenCalled();
  });

  it('keeps the reset token out of the returned navigation state', () => {
    const linking = createLinking(() => false);
    const state = linking.getStateFromPath!(`/l/reset#token=${RESET}`, { screens: {} });
    expect(JSON.stringify(state)).not.toContain(RESET);
    expect(getResetToken()).toBe(RESET);
  });
});
