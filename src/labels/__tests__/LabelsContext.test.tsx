/**
 * `LabelsProvider`/`useLabels()` (bug fix / architecture correction
 * replacing BUG-M02's hardcoded label maps with `GET /api/labels`).
 * Exercises the four-step precedence documented in `LabelsContext.tsx`:
 * fallback → AsyncStorage cache → live fetch → cache write-back, and the
 * network-failure / cache-unavailable degradation paths.
 */
import React from 'react';
import { Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getLabels } from '../../api/labels';
import { act, render, renderAsync, texts } from '../../test-utils/render';
import { FALLBACK_LABELS } from '../fallbackLabels';
import { getLabel, LABELS_CACHE_KEY, LabelsProvider, useLabels } from '../LabelsContext';

jest.mock('../../api/labels', () => ({ getLabels: jest.fn() }));

const mockGetLabels = getLabels as jest.MockedFunction<typeof getLabels>;

function Probe(): React.JSX.Element {
  const labels = useLabels();
  return <Text>{labels['skill_level.beginner'] ?? 'MISSING'}</Text>;
}

/** Lets chained awaits (AsyncStorage read, fetch, cache write) settle. */
async function flush(): Promise<void> {
  for (let i = 0; i < 20; i += 1) {
    await Promise.resolve();
  }
}

beforeEach(async () => {
  await AsyncStorage.clear();
  mockGetLabels.mockReset();
});

describe('getLabel', () => {
  it('reads the key from the given map when present', () => {
    expect(getLabel({ 'team_visibility.public': 'Öffentlich' }, 'team_visibility.public')).toBe(
      'Öffentlich',
    );
  });

  it('falls back to FALLBACK_LABELS when the key is missing from the given map', () => {
    expect(getLabel({}, 'team_visibility.private')).toBe(FALLBACK_LABELS['team_visibility.private']);
  });

  it('falls back to the key itself when missing from both the map and FALLBACK_LABELS', () => {
    expect(getLabel({}, 'some.unknown.key')).toBe('some.unknown.key');
  });
});

describe('useLabels — no LabelsProvider ancestor', () => {
  it('returns FALLBACK_LABELS as the context default (e.g. an unrelated screen test)', () => {
    const root = render(<Probe />);
    expect(texts(root)).toEqual([FALLBACK_LABELS['skill_level.beginner']]);
  });
});

describe('LabelsProvider — cold start, network reachable', () => {
  it('mounts with FALLBACK_LABELS, then applies the fetched map and caches it', async () => {
    let resolveFetch!: (labels: Record<string, string>) => void;
    mockGetLabels.mockReturnValue(new Promise(resolve => (resolveFetch = resolve)));

    const root = render(
      <LabelsProvider>
        <Probe />
      </LabelsProvider>,
    );
    expect(texts(root)).toEqual([FALLBACK_LABELS['skill_level.beginner']]);

    await act(async () => {
      resolveFetch({ 'skill_level.beginner': 'Newbie' });
      await flush();
    });

    expect(texts(root)).toEqual(['Newbie']);
    expect(await AsyncStorage.getItem(LABELS_CACHE_KEY)).toBe(
      JSON.stringify({ 'skill_level.beginner': 'Newbie' }),
    );
  });
});

describe('LabelsProvider — stale AsyncStorage cache present', () => {
  it('shows the cached map immediately, then upgrades once the fetch resolves', async () => {
    await AsyncStorage.setItem(LABELS_CACHE_KEY, JSON.stringify({ 'skill_level.beginner': 'Cached' }));
    let resolveFetch!: (labels: Record<string, string>) => void;
    mockGetLabels.mockReturnValue(new Promise(resolve => (resolveFetch = resolve)));

    const root = await renderAsync(
      <LabelsProvider>
        <Probe />
      </LabelsProvider>,
    );
    expect(texts(root)).toEqual(['Cached']);

    await act(async () => {
      resolveFetch({ 'skill_level.beginner': 'Fresh' });
      await flush();
    });
    expect(texts(root)).toEqual(['Fresh']);
  });
});

describe('LabelsProvider — network fetch fails', () => {
  it('with a cache present, keeps showing the cached map', async () => {
    await AsyncStorage.setItem(LABELS_CACHE_KEY, JSON.stringify({ 'skill_level.beginner': 'Cached' }));
    mockGetLabels.mockRejectedValue(new Error('network down'));

    const root = render(
      <LabelsProvider>
        <Probe />
      </LabelsProvider>,
    );
    await act(async () => {
      await flush();
    });
    expect(texts(root)).toEqual(['Cached']);
  });

  it('with no cache (first launch, offline), falls back to FALLBACK_LABELS', async () => {
    mockGetLabels.mockRejectedValue(new Error('network down'));

    const root = render(
      <LabelsProvider>
        <Probe />
      </LabelsProvider>,
    );
    await act(async () => {
      await flush();
    });
    expect(texts(root)).toEqual([FALLBACK_LABELS['skill_level.beginner']]);
  });
});
