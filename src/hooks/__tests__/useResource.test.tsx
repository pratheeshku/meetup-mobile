/** `useResource`: EXECUTES the hook through a rendered probe component. */
import React from 'react';

import { act, renderAsync } from '../../test-utils/render';
import { useResource } from '../useResource';
import type { Resource } from '../useResource';

function setup(fetcher: jest.Mock) {
  const ref: { current: Resource<string> | null } = { current: null };
  function Probe(): React.JSX.Element {
    ref.current = useResource<string>(fetcher);
    return <></>;
  }
  return { ref, Probe };
}

describe('useResource', () => {
  it('starts loading, then ready with data', async () => {
    const fetcher = jest.fn().mockResolvedValue('v1');
    const { ref, Probe } = setup(fetcher);
    await renderAsync(<Probe />);
    expect(ref.current?.status).toBe('loading');
    await act(async () => {
      await ref.current?.load('cid');
    });
    expect(ref.current?.status).toBe('ready');
    expect(ref.current?.data).toBe('v1');
    expect(fetcher).toHaveBeenCalledWith({ correlationId: 'cid', resourceName: 'resource' });
  });

  it('reports an error, then recovers on retry', async () => {
    const fetcher = jest.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValue('ok');
    const { ref, Probe } = setup(fetcher);
    await renderAsync(<Probe />);
    await act(async () => {
      await ref.current?.load();
    });
    expect(ref.current?.status).toBe('error');
    expect(ref.current?.data).toBeUndefined();
    await act(async () => {
      await ref.current?.load();
    });
    expect(ref.current?.status).toBe('ready');
    expect(ref.current?.data).toBe('ok');
  });

  it('keeps existing data on screen during and after a failed reload', async () => {
    const fetcher = jest.fn().mockResolvedValueOnce('first').mockRejectedValueOnce(new Error('x'));
    const { ref, Probe } = setup(fetcher);
    await renderAsync(<Probe />);
    await act(async () => {
      await ref.current?.load();
    });
    await act(async () => {
      await ref.current?.load();
    });
    expect(ref.current?.status).toBe('ready');
    expect(ref.current?.data).toBe('first');
  });

  it('ignores a stale response that resolves after a newer request', async () => {
    let resolveFirst!: (value: string) => void;
    const fetcher = jest
      .fn()
      .mockImplementationOnce(() => new Promise<string>(resolve => (resolveFirst = resolve)))
      .mockResolvedValueOnce('second');
    const { ref, Probe } = setup(fetcher);
    await renderAsync(<Probe />);
    let first!: Promise<void>;
    act(() => {
      first = ref.current?.load() as Promise<void>;
    });
    await act(async () => {
      await ref.current?.load();
    });
    await act(async () => {
      resolveFirst('first');
      await first;
    });
    expect(ref.current?.data).toBe('second');
  });
});
