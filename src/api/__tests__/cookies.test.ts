/**
 * `clearCookieJar`: best-effort wrapper over React Native's
 * `Networking.clearCookies` (the only JS-reachable cookie operation). It must
 * never reject and never hang — on Android the native callback is not invoked
 * at all when there is no WebView provider.
 */
type ClearCookies = (callback: (removed: boolean) => void) => void;

/** Loads a fresh `cookies` module with `react-native`'s `Networking` replaced. */
function loadWith(networking: { clearCookies?: ClearCookies } | (() => never) | undefined): () => Promise<boolean> {
  let clearCookieJar!: () => Promise<boolean>;
  jest.isolateModules(() => {
    const ReactNative = require('react-native');
    jest.spyOn(ReactNative, 'Networking', 'get').mockImplementation(() => {
      if (typeof networking === 'function') {
        return networking();
      }
      return networking;
    });
    clearCookieJar = require('../cookies').clearCookieJar;
  });
  return clearCookieJar;
}

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('clearCookieJar', () => {
  it('resolves true when the native jar reports cookies were removed', async () => {
    const clearCookies = jest.fn((callback: (removed: boolean) => void) => callback(true));

    await expect(loadWith({ clearCookies })()).resolves.toBe(true);
    expect(clearCookies).toHaveBeenCalledTimes(1);
  });

  it('resolves false when the jar was already empty', async () => {
    await expect(loadWith({ clearCookies: callback => callback(false) })()).resolves.toBe(false);
  });

  it('resolves false when the native API is missing', async () => {
    await expect(loadWith({})()).resolves.toBe(false);
    await expect(loadWith(undefined)()).resolves.toBe(false);
  });

  it('resolves false (never rejects) when the native call throws', async () => {
    const clearCookies: ClearCookies = () => {
      throw new Error('native module unavailable');
    };

    await expect(loadWith({ clearCookies })()).resolves.toBe(false);
  });

  it('resolves false (never rejects) when reading Networking throws', async () => {
    await expect(
      loadWith(() => {
        throw new Error('boom');
      })(),
    ).resolves.toBe(false);
  });

  it('does not hang when the native callback is never invoked (no WebView provider)', async () => {
    jest.useFakeTimers();
    const clear = loadWith({ clearCookies: () => undefined });

    const pending = clear();
    jest.advanceTimersByTime(2_000);

    await expect(pending).resolves.toBe(false);
  });
});
