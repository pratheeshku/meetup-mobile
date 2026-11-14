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

  describe('closed app (cold start)', () => {
    const OWN = `https://meetupaws.duckdns.org/l/reset#token=${RESET}`;
    const subscribeWith = (linking: ReturnType<typeof createLinking>, listener: (url: string) => void): void => {
      jest.spyOn(Linking, 'addEventListener').mockReturnValue({ remove: jest.fn() } as never);
      linking.subscribe!(listener);
    };

    it('check never answers and there is no launch URL: getInitialURL still resolves at once', async () => {
      jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
      await expect(createLinking(() => false).getInitialURL!()).resolves.toBeUndefined();
    });

    it.each([
      ['another host', `https://example.org/l/game/${ID}`],
      ['the staging host in a production build', `https://meetupstg.duckdns.org/l/game/${ID}`],
      ['this host but not /l/', 'https://meetupaws.duckdns.org/privacy'],
      ['http', `http://meetupaws.duckdns.org/l/game/${ID}`],
      ['a custom scheme', `gameonsg://l/game/${ID}`],
    ])('a launch URL on %s resolves at once, without waiting for the check, and is never delivered', async (_n, url) => {
      jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(url);
      const linking = createLinking(() => false);
      const listener = jest.fn();
      await expect(linking.getInitialURL!()).resolves.toBeUndefined();
      subscribeWith(linking, listener);
      reportUpdatePolicy(false);
      await flush();
      expect(listener).not.toHaveBeenCalled();
    });

    it('an /l/ launch link does not hold the first render: getInitialURL resolves at once with no URL', async () => {
      jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(OWN);
      await expect(createLinking(() => false).getInitialURL!()).resolves.toBeUndefined();
    });

    it('an /l/ launch link is handled only after the check answers, through the container listener', async () => {
      jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(OWN);
      const linking = createLinking(() => false);
      const listener = jest.fn();
      await linking.getInitialURL!();
      subscribeWith(linking, listener); // the navigator has rendered and subscribed
      await flush();
      expect(listener).not.toHaveBeenCalled(); // check has not answered

      reportUpdatePolicy(false);
      await flush();
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(OWN);
    });

    it('the check answering before the navigator subscribes still delivers the link once, on subscribe', async () => {
      jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(OWN);
      const linking = createLinking(() => false);
      await linking.getInitialURL!();
      reportUpdatePolicy(false);
      await flush();
      const listener = jest.fn();
      subscribeWith(linking, listener);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(OWN);
    });

    it('a blocked app never handles the launch link', async () => {
      jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(OWN);
      const linking = createLinking(() => false);
      const listener = jest.fn();
      await linking.getInitialURL!();
      subscribeWith(linking, listener);
      reportUpdatePolicy(true);
      await flush();
      expect(listener).not.toHaveBeenCalled();
      expect(getResetToken()).toBeNull(); // nothing was resolved, so no token was even stored
    });
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

  it('open app: a blocked app never handles the URL event', async () => {
    let handler: ((event: { url: string }) => void) | undefined;
    jest.spyOn(Linking, 'addEventListener').mockImplementation(((_t: string, cb: (event: { url: string }) => void) => {
      handler = cb;
      return { remove: jest.fn() };
    }) as never);
    const listener = jest.fn();
    createLinking(() => true).subscribe!(listener);
    reportUpdatePolicy(true);
    handler!({ url: `https://meetupaws.duckdns.org/l/game/${ID}` });
    await flush();
    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps the reset token out of the returned navigation state', () => {
    const linking = createLinking(() => false);
    const state = linking.getStateFromPath!(`/l/reset#token=${RESET}`, { screens: {} });
    expect(JSON.stringify(state)).not.toContain(RESET);
    expect(getResetToken()).toBe(RESET);
  });
});
