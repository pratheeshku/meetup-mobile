/**
 * create-game-duration: step 3 Duration dropdown (games only), ends_at = starts_at + duration.
 */
import React from 'react';

import { createEvent } from '../../api/events';
import { getMyGroups } from '../../api/groups';
import { getSports } from '../../api/sports';
import { createTournament } from '../../api/tournaments';
import { searchUsers } from '../../api/users';
import { showCompletion } from '../../navigation/showCompletion';
import { act, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { computeEndsAtIso, GAME_DURATION_HOURS } from '../../utils/gameDuration';
import CreateGameScreen from '../CreateGameScreen';

type Props = React.ComponentProps<typeof CreateGameScreen>;

jest.mock('../../api/sports', () => ({ getSports: jest.fn() }));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn() }));
jest.mock('../../api/events', () => ({ createEvent: jest.fn() }));
jest.mock('../../api/users', () => ({ searchUsers: jest.fn() }));
jest.mock('../../api/tournaments', () => ({ createTournament: jest.fn() }));
jest.mock('../../navigation/showCompletion', () => ({ showCompletion: jest.fn() }));

const mockCreateEvent = createEvent as jest.Mock;
const mockCreateTournament = createTournament as jest.Mock;
const mockShowCompletion = showCompletion as jest.Mock;

async function mount(): Promise<Instance> {
  (getSports as jest.Mock).mockResolvedValue([
    { name: 'badminton', display_name: 'Badminton', icon_key: 'badminton', color: '#000' },
  ]);
  (getMyGroups as jest.Mock).mockResolvedValue({ items: [], total: 0, page: 1, page_size: 1 });
  (searchUsers as jest.Mock).mockResolvedValue([]);
  mockCreateEvent.mockResolvedValue({ id: 'evt-1' });
  mockCreateTournament.mockResolvedValue({ id: 't-1' });
  const props = { navigation: { popTo: jest.fn(), navigate: jest.fn(), goBack: jest.fn() }, route: { params: undefined } };
  return renderAsync(<CreateGameScreen {...(props as unknown as Props)} />);
}

const byLabel = (root: Instance, label: string): Instance =>
  root.findAll(n => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
const press = async (node: Instance): Promise<void> => {
  await act(async () => {
    node.props.onPress();
  });
};

async function toStep(root: Instance, step: 3 | 6, opts: { tournament?: boolean } = {}): Promise<void> {
  if (opts.tournament) {
    await press(byLabel(root, 'Tournament'));
  }
  await press(byLabel(root, 'Next')); // 1 -> 2
  await act(async () => {
    root
      .find(n => (n.type as unknown) === 'TextInput' && n.props.accessibilityLabel === undefined && /e\.g\./.test(String(n.props.placeholder)))
      .props.onChangeText('Friday');
  });
  await press(byLabel(root, 'Next')); // 2 -> 3
  if (step === 3) return;
  await press(byLabel(root, 'Next')); // 3 -> 4
  await press(byLabel(root, 'Next')); // 4 -> 5
  await press(byLabel(root, 'Next')); // 5 -> 6
}

const selectDuration = async (root: Instance, label: string): Promise<void> => {
  await press(byLabel(root, 'Duration'));
  await press(byLabel(root, label));
};

beforeEach(() => {
  mockCreateEvent.mockReset();
  mockCreateTournament.mockReset();
  mockShowCompletion.mockReset();
});

describe('computeEndsAtIso', () => {
  it('adds whole hours as an absolute instant, across midnight', () => {
    const start = new Date(2026, 9, 20, 23, 30, 0, 0);
    expect(computeEndsAtIso(start, 2)).toBe(new Date(start.getTime() + 2 * 3_600_000).toISOString());
    const end = new Date(computeEndsAtIso(start, 2));
    expect(end.getDate()).toBe(21);
    expect(end.getHours()).toBe(1);
    expect(end.getMinutes()).toBe(30);
  });
});

describe('Duration dropdown (games)', () => {
  it('offers 1-8 hours with 2 hrs selected by default', async () => {
    const root = await mount();
    await toStep(root, 3);
    expect(texts(root)).toContain('Duration');
    expect(texts(root)).toContain('2 hrs');
    await press(byLabel(root, 'Duration'));
    const labels = ['1 hr', ...[2, 3, 4, 5, 6, 7, 8].map(h => `${h} hrs`)];
    for (const label of labels) {
      expect(byLabel(root, label)).toBeDefined();
    }
  });

  it('sends ends_at = starts_at + 2 hrs by default, after starts_at', async () => {
    const root = await mount();
    await toStep(root, 6);
    await press(byLabel(root, 'Create Game'));
    const body = mockCreateEvent.mock.calls[0][0];
    expect(Date.parse(body.ends_at)).toBe(Date.parse(body.starts_at) + 2 * 3_600_000);
    expect(Date.parse(body.ends_at)).toBeGreaterThan(Date.parse(body.starts_at));
  });

  it.each(GAME_DURATION_HOURS.map(h => [h]))('sends starts_at + %i hr(s) when chosen', async hours => {
    const root = await mount();
    await toStep(root, 3);
    await selectDuration(root, hours === 1 ? '1 hr' : `${hours} hrs`);
    for (let i = 0; i < 3; i += 1) await press(byLabel(root, 'Next'));
    await press(byLabel(root, 'Create Game'));
    const body = mockCreateEvent.mock.calls[0][0];
    expect(Date.parse(body.ends_at) - Date.parse(body.starts_at)).toBe(hours * 3_600_000);
  });

  it('crosses midnight correctly (default 19:30 start + 8 hrs ends the next day at 03:30)', async () => {
    const root = await mount();
    await toStep(root, 3);
    await selectDuration(root, '8 hrs');
    for (let i = 0; i < 3; i += 1) await press(byLabel(root, 'Next'));
    await press(byLabel(root, 'Create Game'));
    const body = mockCreateEvent.mock.calls[0][0];
    const start = new Date(body.starts_at);
    const end = new Date(body.ends_at);
    expect(end.getDate()).not.toBe(start.getDate());
    expect(end.getHours()).toBe(3);
    expect(end.getMinutes()).toBe(30);
  });

  it('shows the end time in the review and on the completion screen', async () => {
    const root = await mount();
    await toStep(root, 6);
    expect(texts(root).some(x => /7:30.*–.*9:30/.test(x))).toBe(true);
    await press(byLabel(root, 'Create Game'));
    const rows = mockShowCompletion.mock.calls[0][0].rows as { label: string; value: string }[];
    expect(rows.find(r => r.label === 'Date and time')?.value).toMatch(/7:30.*–.*9:30/);
  });
});

describe('tournaments are unchanged', () => {
  it('has no Duration field and sends no ends_at', async () => {
    const root = await mount();
    await toStep(root, 3, { tournament: true });
    expect(texts(root)).not.toContain('Duration');
    for (let i = 0; i < 3; i += 1) await press(byLabel(root, 'Next'));
    await press(byLabel(root, 'Create Game'));
    expect(mockCreateEvent).not.toHaveBeenCalled();
    expect(mockCreateTournament).toHaveBeenCalledTimes(1);
    expect(mockCreateTournament.mock.calls[0][0]).not.toHaveProperty('ends_at');
  });
});
