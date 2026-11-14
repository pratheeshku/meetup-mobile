/**
 * NavigationContainer `linking` option (deep-links AD-6): React Navigation's own link handling with
 * one custom state builder, `resolveLink`. Prefix = https + this build's link host (one place:
 * `config/appConfig.json`, via `getLinkHost`). A URL with any other host or scheme is not matched
 * and is ignored.
 *
 * The force-update gate runs before any link is handled, but never delays start-up:
 * - `getInitialURL` resolves at once. A launch URL that is not an `/l/` link on this host is dropped
 *   (undefined). An `/l/` launch link is NOT returned (NavigationContainer would hold its first render
 *   for it); it is held and handed to the container's own URL listener once the version check has
 *   answered and the app is not blocked, exactly like a link that arrives while the app is open.
 * - URL events while the app is open wait for the same gate.
 * - A blocked app never handles a link.
 */
import { Linking } from 'react-native';
import type { LinkingOptions, NavigationState, PartialState } from '@react-navigation/native';

import { getLinkHost } from '../../config/env';
import { linksAllowed, whenLinksAllowed } from './linkGate';
import { parseLinkPath } from './parseLink';
import { resolveLink } from './resolveLink';

/** True for `https://{this host}/l/...` (host compared case-insensitively). */
export function isOwnLink(url: string | null | undefined): url is string {
  return typeof url === 'string' && url.toLowerCase().startsWith(`https://${getLinkHost().toLowerCase()}/l/`);
}

/** Builds the options. `isSignedIn` is read at the moment a link is handled. */
export function createLinking(isSignedIn: () => boolean): LinkingOptions<Record<string, object | undefined>> {
  // A launch link waiting for the gate, and the container's listener it is delivered to.
  let heldLaunchUrl: string | undefined;
  let listener: ((url: string) => void) | undefined;

  const deliverHeld = (): void => {
    if (heldLaunchUrl !== undefined && listener && linksAllowed()) {
      const url = heldLaunchUrl;
      heldLaunchUrl = undefined;
      listener(url);
    }
  };

  return {
    prefixes: [`https://${getLinkHost()}`],
    async getInitialURL() {
      const url = await Linking.getInitialURL();
      if (isOwnLink(url)) {
        heldLaunchUrl = url;
        whenLinksAllowed().then(deliverHeld);
      }
      return undefined;
    },
    subscribe(onUrl) {
      listener = onUrl;
      deliverHeld();
      const subscription = Linking.addEventListener('url', ({ url }) => {
        whenLinksAllowed().then(() => onUrl(url));
      });
      return () => {
        listener = undefined;
        subscription.remove();
      };
    },
    getStateFromPath(path): PartialState<NavigationState> | undefined {
      return resolveLink(parseLinkPath(path), isSignedIn());
    },
  };
}
