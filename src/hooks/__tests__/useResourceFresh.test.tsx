/** `load(..., { fresh: true })` drops held rows for the loading state; a failure shows the error state. */
import React from 'react';

import { act, renderAsync } from '../../test-utils/render';
import { useResource } from '../useResource';
import type { Resource } from '../useResource';

let resource!: Resource<string[]>;
let fetcher: jest.Mock;

function Probe(): null {
  resource = useResource<string[]>(() => fetcher(), 'probe');
  return null;
}

beforeEach(() => {
  fetcher = jest.fn().mockResolvedValue(['a', 'b']);
});

it('a normal reload keeps the rows while it runs, a fresh one does not', async () => {
  await renderAsync(<Probe />);
  await act(async () => resource.load());
  expect(resource.data).toEqual(['a', 'b']);

  let release!: (rows: string[]) => void;
  fetcher.mockReturnValueOnce(new Promise<string[]>(resolve => (release = resolve)));
  await act(async () => {
    resource.load();
  });
  expect(resource.data).toEqual(['a', 'b']);
  await act(async () => release(['a']));

  fetcher.mockReturnValueOnce(new Promise<string[]>(resolve => (release = resolve)));
  await act(async () => {
    resource.load(undefined, { fresh: true });
  });
  expect(resource.status).toBe('loading');
  expect(resource.data).toBeUndefined();
  await act(async () => release(['c']));
  expect(resource.data).toEqual(['c']);
});

it('a failed normal reload keeps the rows, a failed fresh one shows the error state', async () => {
  await renderAsync(<Probe />);
  await act(async () => resource.load());
  fetcher.mockRejectedValueOnce(new Error('offline'));
  await act(async () => resource.load());
  expect(resource.data).toEqual(['a', 'b']);
  expect(resource.status).toBe('ready');

  fetcher.mockRejectedValueOnce(new Error('offline'));
  await act(async () => resource.load(undefined, { fresh: true }));
  expect(resource.status).toBe('error');
  expect(resource.data).toBeUndefined();
});
