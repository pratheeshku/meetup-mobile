/** create-game step 3: games show Date, Start time and Duration in ONE row; tournaments keep two. */
import React from 'react';
import { StyleSheet } from 'react-native';

import { createEvent } from '../../api/events';
import { getMyGroups } from '../../api/groups';
import { getSports } from '../../api/sports';
import { createTournament } from '../../api/tournaments';
import { searchUsers } from '../../api/users';
import { act, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import CreateGameScreen, { isCompactDateRow } from '../CreateGameScreen';

type Props = React.ComponentProps<typeof CreateGameScreen>;

const mockWindow = { width: 360, height: 800, scale: 3, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockWindow,
}));
jest.mock('../../api/sports', () => ({ getSports: jest.fn() }));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn() }));
jest.mock('../../api/events', () => ({ createEvent: jest.fn(), inviteEmailToEvent: jest.fn() }));
jest.mock('../../api/users', () => ({ searchUsers: jest.fn() }));
jest.mock('../../api/tournaments', () => ({ createTournament: jest.fn() }));
jest.mock('../../navigation/showCompletion', () => ({ showCompletion: jest.fn() }));

async function mount(): Promise<Instance> {
  (getSports as jest.Mock).mockResolvedValue([
    { name: 'badminton', display_name: 'Badminton', icon_key: 'badminton', color: '#000' },
  ]);
  (getMyGroups as jest.Mock).mockResolvedValue({ items: [], total: 0, page: 1, page_size: 1 });
  (searchUsers as jest.Mock).mockResolvedValue([]);
  (createEvent as jest.Mock).mockResolvedValue({ id: 'evt-1' });
  (createTournament as jest.Mock).mockResolvedValue({ id: 't-1' });
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
async function toStep3(root: Instance, tournament = false): Promise<void> {
  if (tournament) await press(byLabel(root, 'Tournament'));
  await press(byLabel(root, 'Next'));
  await act(async () => {
    root
      .find(n => (n.type as unknown) === 'TextInput' && /e\.g\./.test(String(n.props.placeholder)))
      .props.onChangeText('Friday');
  });
  await press(byLabel(root, 'Next'));
}
/** The flex row that holds the Date and Start time fields, and the labels it contains. */
const dateRow = (root: Instance): { labels: string[]; columns: number[] } => {
  const row = root
    .findAll(n => typeof n.type === 'string' && StyleSheet.flatten(n.props.style)?.flexDirection === 'row')
    .find(n => texts(n).includes('Date') && texts(n).includes('Start time'));
  if (!row) throw new Error('date row not found');
  const columns = row.children
    .filter((c): c is Instance => typeof c !== 'string')
    .map(c => Number(StyleSheet.flatten(c.props.style)?.flex ?? 0));
  return { labels: texts(row).filter(x => ['Date', 'Start time', 'Duration'].includes(x)), columns };
};

beforeEach(() => {
  (createEvent as jest.Mock).mockReset();
  Object.assign(mockWindow, { width: 360, fontScale: 1 });
});

describe('row layout', () => {
  it('games: Date, Start time and Duration in one row, flex 1.35 / 1 / 1', async () => {
    const root = await mount();
    await toStep3(root);
    const { labels, columns } = dateRow(root);
    expect(labels).toEqual(['Date', 'Start time', 'Duration']);
    expect(columns).toEqual([1.35, 1, 1]);
    expect(texts(root).filter(x => x === 'Duration')).toHaveLength(1); // no old standalone row
  });

  it('tournaments: two columns, no Duration', async () => {
    const root = await mount();
    await toStep3(root, true);
    const { labels, columns } = dateRow(root);
    expect(labels).toEqual(['Date', 'Start time']);
    expect(columns).toEqual([1, 1]);
    expect(texts(root)).not.toContain('Duration');
  });

  it('labels and values never wrap or truncate: one line, fit-to-size', async () => {
    const root = await mount();
    await toStep3(root);
    const row = root
      .findAll(n => typeof n.type === 'string' && StyleSheet.flatten(n.props.style)?.flexDirection === 'row')
      .find(n => texts(n).includes('Duration')) as Instance;
    const oneLine = row
      .findAll(n => (n.type as unknown) === 'Text')
      .filter(n => ['Date', 'Start time', 'Duration'].includes(String(n.props.children)));
    expect(oneLine).toHaveLength(3);
    for (const node of oneLine) {
      expect(node.props.numberOfLines).toBe(1);
      expect(node.props.adjustsFontSizeToFit).toBe(true);
      expect(node.props.minimumFontScale).toBeGreaterThan(0);
    }
  });
});

describe('short date at narrow widths / large fonts', () => {
  it.each([
    ['360dp', 360, 1],
    ['375pt', 375, 1],
    ['360dp at 1.3 font scale', 360, 1.3],
    ['375pt at 1.3 font scale', 375, 1.3],
  ])('%s uses the short date (day and month) with no icons', async (_n, width, fontScale) => {
    Object.assign(mockWindow, { width, fontScale });
    const root = await mount();
    await toStep3(root);
    const all = texts(root);
    expect(all.some(x => /^\d{1,2} [A-Z][a-z]{2}$/.test(x))).toBe(true); // e.g. "17 Oct"
    expect(all.some(x => /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), /.test(x))).toBe(false);
  });

  it('a wide screen at normal font keeps the weekday date', async () => {
    Object.assign(mockWindow, { width: 600, fontScale: 1 });
    const root = await mount();
    await toStep3(root);
    expect(texts(root).some(x => /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), /.test(x))).toBe(true);
  });

  it('the compact rule', () => {
    expect(isCompactDateRow(360, 1)).toBe(true);
    expect(isCompactDateRow(375, 1.3)).toBe(true);
    expect(isCompactDateRow(430, 1)).toBe(false);
    expect(isCompactDateRow(430, 1.3)).toBe(true);
  });

  it('tournaments always keep the long date', async () => {
    const root = await mount();
    await toStep3(root, true);
    expect(texts(root).some(x => /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), /.test(x))).toBe(true);
  });
});

describe('ends_at behaviour unchanged', () => {
  it('still sends starts_at + 2 hrs by default', async () => {
    const root = await mount();
    await toStep3(root);
    for (let i = 0; i < 3; i += 1) await press(byLabel(root, 'Next'));
    await press(byLabel(root, 'Create Game'));
    const body = (createEvent as jest.Mock).mock.calls[0][0];
    expect(Date.parse(body.ends_at) - Date.parse(body.starts_at)).toBe(2 * 3_600_000);
  });

  it('changing Duration in the row still changes ends_at', async () => {
    const root = await mount();
    await toStep3(root);
    await press(byLabel(root, 'Duration'));
    await press(byLabel(root, '5 hrs'));
    for (let i = 0; i < 3; i += 1) await press(byLabel(root, 'Next'));
    await press(byLabel(root, 'Create Game'));
    const body = (createEvent as jest.Mock).mock.calls[0][0];
    expect(Date.parse(body.ends_at) - Date.parse(body.starts_at)).toBe(5 * 3_600_000);
  });
});
