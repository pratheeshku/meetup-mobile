/**
 * Cookie-jar access for the API layer.
 *
 * The backend keeps the refresh token in an HttpOnly cookie (`refresh_token`,
 * Path=/auth), so JavaScript can neither read nor write it — the networking
 * layer does. On Android that is OkHttp with React Native's cookie jar
 * (`ReactCookieJarContainer` -> `ForwardingCookieHandler`), which forwards to
 * the process-wide WebView `android.webkit.CookieManager`. Cookies are sent
 * and stored only for requests with `withCredentials` true (React Native's
 * `XMLHttpRequest` default; set explicitly in `client.ts`).
 *
 * The only JS-reachable operation is "remove every cookie".
 * `Networking.clearCookies` exists at runtime on the `react-native` entry
 * point but is not in its TypeScript types, hence the narrow local typing.
 */
import * as ReactNative from 'react-native';

interface CookieClearingNetworking {
  clearCookies?: (callback: (removed: boolean) => void) => void;
}

/**
 * The native callback is never invoked when Android has no usable WebView
 * provider (`cookieManager?.removeAllCookies { ... }` no-ops on a null
 * manager), so an unguarded await could hang sign-out forever.
 */
const CLEAR_COOKIES_TIMEOUT_MS = 2_000;

/**
 * Removes ALL cookies from the app's shared cookie store (not just ours — the
 * app has no other cookie consumer). Best-effort: NEVER rejects; resolves
 * `false` if the native API is missing, throws, times out, or reports that
 * nothing was removed (which is also the normal result when the jar was
 * already empty).
 */
export function clearCookieJar(): Promise<boolean> {
  return new Promise<boolean>(resolve => {
    const timer = setTimeout(() => resolve(false), CLEAR_COOKIES_TIMEOUT_MS);
    const settle = (removed: boolean): void => {
      clearTimeout(timer);
      resolve(removed);
    };

    try {
      const networking = (ReactNative as unknown as { Networking?: CookieClearingNetworking })
        .Networking;
      if (typeof networking?.clearCookies !== 'function') {
        settle(false);
        return;
      }
      networking.clearCookies(removed => settle(removed === true));
    } catch {
      settle(false);
    }
  });
}
