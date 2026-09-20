/**
 * Test-only fake backend for the REAL `apiClient` / `refreshClient`.
 *
 * Stubs only the transport (the axios adapter of both instances) and the
 * native Keychain, so the production interceptors, single-flight refresh and
 * token storage all run unmodified. Not imported by any production module.
 *
 * Call `installFakeBackend()` from `beforeEach`; it (re)installs the adapters
 * and Keychain implementations on the already-mocked `react-native-keychain`
 * (see `jest.setup.js`).
 */
import { AxiosError } from 'axios';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import * as Keychain from 'react-native-keychain';

import { apiClient, refreshClient } from '../api/client';

export const ACCESS_SERVICE = 'com.meetupmobile.auth.accessToken';
export const REFRESH_SERVICE = 'com.meetupmobile.auth.refreshToken';

/** What the fake server answers. `network: true` simulates no connectivity. */
export interface FakeReply {
  status?: number;
  data?: unknown;
  network?: boolean;
}

export type Route = (config: InternalAxiosRequestConfig) => FakeReply | Promise<FakeReply>;

/**
 * A request as it was when it reached the transport. Snapshotted because the
 * client's retry re-sends the SAME config object with a new header, which
 * would otherwise rewrite the recorded original.
 */
export interface RecordedRequest {
  url: string;
  method: string | undefined;
  data: unknown;
  withCredentials: boolean | undefined;
  authorization: string | undefined;
}

export interface FakeBackend {
  /** Replace to change what the server answers (default: 200 `{}`). */
  route: Route;
  /** Keychain contents by service (the fake Keystore). */
  stored: Record<string, string>;
  /** Every request that reached the transport, in order (snapshots). */
  requests: RecordedRequest[];
  /** URLs of every request, in order. */
  urls: () => string[];
  /** Recorded requests to one URL. */
  callsTo: (url: string) => RecordedRequest[];
  /** The live `Authorization` header of a config — for use inside `route`. */
  authorizationOf: (config: InternalAxiosRequestConfig) => string | undefined;
}

function toResponse(config: InternalAxiosRequestConfig, reply: FakeReply): Promise<AxiosResponse> {
  if (reply.network) {
    return Promise.reject(new AxiosError('Network Error', 'ERR_NETWORK', config));
  }
  const status = reply.status ?? 200;
  const response = { status, statusText: String(status), data: reply.data ?? {}, headers: {}, config } as AxiosResponse;
  if (status >= 200 && status < 300) {
    return Promise.resolve(response);
  }
  return Promise.reject(new AxiosError(`HTTP ${status}`, 'ERR_BAD_REQUEST', config, {}, response));
}

export function installFakeBackend(): FakeBackend {
  const backend: FakeBackend = {
    route: () => ({ status: 200, data: {} }),
    stored: {},
    requests: [],
    urls: () => backend.requests.map(request => request.url),
    callsTo: url => backend.requests.filter(request => request.url === url),
    authorizationOf: config => {
      const value = config.headers?.get?.('Authorization');
      return typeof value === 'string' ? value : undefined;
    },
  };

  const adapter = jest.fn(async (config: InternalAxiosRequestConfig) => {
    backend.requests.push({
      url: config.url as string,
      method: config.method,
      data: config.data,
      withCredentials: config.withCredentials,
      authorization: backend.authorizationOf(config),
    });
    return toResponse(config, await backend.route(config));
  });
  apiClient.defaults.adapter = adapter;
  refreshClient.defaults.adapter = adapter;

  (Keychain.getGenericPassword as jest.Mock).mockImplementation(async (options: { service: string }) =>
    backend.stored[options.service] ? { password: backend.stored[options.service] } : false,
  );
  // Mirrors the native module: an empty/null password is REJECTED.
  (Keychain.setGenericPassword as jest.Mock).mockImplementation(
    async (_username: string, password: string, options: { service: string }) => {
      if (!password) {
        throw new Error('you passed empty or null username/password');
      }
      backend.stored[options.service] = password;
      return { service: 'mock', storage: 'KeystoreAESGCM_NoAuth' };
    },
  );
  (Keychain.resetGenericPassword as jest.Mock).mockImplementation(async (options: { service: string }) => {
    delete backend.stored[options.service];
    return true;
  });

  return backend;
}

/** A promise you resolve by hand — to order concurrent requests deterministically. */
export function deferred<T = void>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => {
    resolve = res;
  });
  return { promise, resolve };
}
