/**
 * NavigationContainer `linking` option (deep-links AD-6): React Navigation's own link handling with
 * one custom state builder, `resolveLink`. Prefix = https + this build's link host (one place:
 * `config/appConfig.json`, via `getLinkHost`). A URL with any other host or scheme is not matched
 * and is ignored. Both sources wait for the force-update gate.
 */
import { Linking } from 'react-native';
import type { LinkingOptions, NavigationState, PartialState } from '@react-navigation/native';

import { getLinkHost } from '../../config/env';
import { whenLinksAllowed } from './linkGate';
import { parseLinkPath } from './parseLink';
import { resolveLink } from './resolveLink';

/** Builds the options. `isSignedIn` is read at the moment a link is handled. */
export function createLinking(isSignedIn: () => boolean): LinkingOptions<Record<string, object | undefined>> {
  return {
    prefixes: [`https://${getLinkHost()}`],
    async getInitialURL() {
      await whenLinksAllowed();
      return (await Linking.getInitialURL()) ?? undefined;
    },
    subscribe(listener) {
      const subscription = Linking.addEventListener('url', ({ url }) => {
        whenLinksAllowed().then(() => listener(url));
      });
      return () => subscription.remove();
    },
    getStateFromPath(path): PartialState<NavigationState> | undefined {
      return resolveLink(parseLinkPath(path), isSignedIn());
    },
  };
}
