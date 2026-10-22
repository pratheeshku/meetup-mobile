/**
 * Standings, results and bracket screen (match-scoring v1.2 read views). Real renders over a mocked API
 * that returns ms-s4 Appendix A1 shaped data; labels are the bundled English defaults.
 */
import React from 'react';

import { getRegistrations, getTournamentStandings } from '../../api/tournaments';
import { act, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { STANDINGS_RAW } from '../../test-utils/scoringFixtures';
import { normaliseStandings } from '../../utils/tournamentScoring';
import TournamentScoringScreen from '../TournamentScoringScreen';

type Props = React.ComponentProps<typeof TournamentScoringScreen>;

jest.mock('../../api/tournaments', () => ({
  getTournamentStandings: jest.fn(),
  getRegistrations: jest.fn(),
}));
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-me' } }) }));

const mockStandings = getTournamentStandings as jest.MockedFunction<typeof getTournamentStandings>;
const mockRegistrations = getRegistrations as jest.MockedFunction<typeof getRegistrations>;

const setOptions = jest.fn();

const mount = (): Promise<Instance> =>
  renderAsync(
    <TournamentScoringScreen
      {...({
        route: { key: 'k', name: 'TournamentScoring', params: { tournamentId: 't-1' } },
        navigation: { setOptions, isFocused: () => true, addListener: () => () => undefined },
      } as unknown as Props)}
    />,
  );

const tab = (root: Instance, label: string): Instance => {
  const found = root.findAll(
    n => n.props.accessibilityRole === 'tab' && n.props.accessibilityLabel === label && typeof n.props.onPress === 'function',
  );
  if (found.length !== 1) {
    throw new Error(`Expected one tab "${label}", found ${found.length}`);
  }
  return found[0];
};
const press = async (node: Instance): Promise<void> => {
  await act(async () => {
    node.props.onPress();
  });
};
const hasTab = (root: Instance, label: string): boolean =>
  root.findAll(n => n.props.accessibilityRole === 'tab' && n.props.accessibilityLabel === label).length > 0;
const matchIds = (root: Instance): string[] =>
  root
    .findAll(n => (n.type as unknown) === 'View' && typeof n.props.testID === 'string' && /^scoring-match-[^-]+$/.test(n.props.testID))
    .map(n => n.props.testID.replace('scoring-match-', ''));

beforeEach(() => {
  setOptions.mockReset();
  mockStandings.mockReset().mockResolvedValue(normaliseStandings(STANDINGS_RAW));
  mockRegistrations.mockReset().mockResolvedValue([]);
});

describe('groups tab', () => {
  it('shows the backend table in the backend order with P W L and the two differences', async () => {
    const root = await mount();
    const rowA = root.findByProps({ testID: 'scoring-row-r1' });
    expect(texts(rowA)).toEqual(['1', 'Ravi K.', '2', '2', '0', '+3', '+44']);
    const names = root
      .findByProps({ testID: 'scoring-table-A' })
      .findAll(n => (n.type as unknown) === 'View' && typeof n.props.testID === 'string' && n.props.testID.startsWith('scoring-row-'))
      .map(n => texts(n)[1]);
    expect(names).toEqual(['Ravi K.', 'Wei C.', 'Mei Tan', 'Jon Ong']);
    expect(setOptions).toHaveBeenLastCalledWith({ title: 'Group stage' });
  });

  it('highlights qualifiers only once the backend resolved them, and marks tied rows', async () => {
    const root = await mount();
    const flat = (n: Instance): Record<string, unknown> => Object.assign({}, ...[n.props.style].flat(Infinity).filter(Boolean));
    expect(flat(root.findByProps({ testID: 'scoring-row-r1' })).backgroundColor).toBeDefined();
    expect(flat(root.findByProps({ testID: 'scoring-row-r3' })).backgroundColor).toBeUndefined();
    expect(texts(root.findByProps({ testID: 'scoring-row-r3' }))[0]).toBe('=3');
    expect(root.findByProps({ testID: 'scoring-row-r1' }).props.accessibilityLabel).toContain('Qualified');
    expect(root.findByProps({ testID: 'scoring-row-r3' }).props.accessibilityLabel).toContain('Tied');
    expect(texts(root)).toContain('Highlighted players have qualified for the knockout.');
  });

  it('marks an incomplete group Provisional with no qualifier highlight', async () => {
    const root = await mount();
    await press(tab(root, 'B'));
    expect(root.findAllByProps({ testID: 'scoring-provisional' }).length).toBeGreaterThan(0);
    expect(texts(root)).toContain('Provisional');
    expect(texts(root)).toContain('This group has matches still to play, so the table may change.');
    const flat = (n: Instance): Record<string, unknown> => Object.assign({}, ...[n.props.style].flat(Infinity).filter(Boolean));
    expect(flat(root.findByProps({ testID: 'scoring-row-r5' })).backgroundColor).toBeUndefined();
  });

  it('shows result lines for the group matches including a walkover and a retirement', async () => {
    const root = await mount();
    expect(texts(root.findByProps({ testID: 'scoring-match-ga1-a' }))).toEqual(['Ravi K.', '21', '21']);
    expect(texts(root.findByProps({ testID: 'scoring-match-ga1-b' }))).toEqual(['Wei C.', '15', '19']);
    expect(texts(root.findByProps({ testID: 'scoring-match-ga2' }))[0]).toContain('W/O');
    await press(tab(root, 'B'));
    expect(texts(root.findByProps({ testID: 'scoring-match-gb1' }))[0]).toContain('RET');
  });
});

describe('knockout tab', () => {
  it('orders matches by round then fixture order, with a pill per round (3rd before Final)', async () => {
    const root = await mount();
    await press(tab(root, 'Knockout'));
    expect(setOptions).toHaveBeenLastCalledWith({ title: 'Knockout' });
    expect(['QF', 'SF', '3rd', 'Final'].every(l => hasTab(root, l))).toBe(true);
    expect(matchIds(root)).toEqual(['kq1', 'kq2']);
    await press(tab(root, 'Final'));
    expect(matchIds(root)).toEqual(['kf']);
    await press(tab(root, '3rd'));
    expect(matchIds(root)).toEqual(['k3']);
  });

  it('hides All | My matches without a registration of the user, and filters with one', async () => {
    let root = await mount();
    await press(tab(root, 'Knockout'));
    expect(hasTab(root, 'My matches')).toBe(false);

    mockRegistrations.mockResolvedValue([
      { id: 'r1', user_id: 'user-me', nickname: 'Ravi K.', registered_at: '', status: 'registered' },
      { id: 'r9', user_id: 'someone', nickname: 'X', registered_at: '', status: 'registered' },
    ]);
    root = await mount();
    await press(tab(root, 'Knockout'));
    await press(tab(root, 'My matches'));
    expect(matchIds(root)).toEqual(['kq1']);
    expect(texts(root)).toContain('You');
    await press(tab(root, 'All'));
    expect(matchIds(root)).toEqual(['kq1', 'kq2']);
  });

  it('opens straight on the knockout when there are no groups', async () => {
    mockStandings.mockResolvedValue(normaliseStandings({ ...STANDINGS_RAW, groups: [] }));
    const root = await mount();
    expect(hasTab(root, 'Groups')).toBe(false);
    expect(matchIds(root)).toEqual(['kq1', 'kq2']);
  });
});

describe('no scoring data and failures', () => {
  it('says standings are not available when the backend has no scoring data (v1, unpublished, 404)', async () => {
    mockStandings.mockResolvedValue(null);
    const root = await mount();
    expect(texts(root)).toContain('Standings are not available for this tournament.');
  });

  it('shows the error with Retry and recovers', async () => {
    mockStandings.mockRejectedValueOnce(new Error('down'));
    const root = await mount();
    expect(texts(root)).toContain('Could not load the standings. Please try again.');
    const retry = root.findAll(n => n.props.accessibilityRole === 'button' && typeof n.props.onPress === 'function')[0];
    await press(retry);
    expect(root.findAllByProps({ testID: 'tournament-scoring-screen' }).length).toBeGreaterThan(0);
  });

  it('still shows the standings when the registrations cannot be read', async () => {
    mockRegistrations.mockRejectedValue(new Error('403'));
    const root = await mount();
    expect(root.findAllByProps({ testID: 'scoring-table-A' }).length).toBeGreaterThan(0);
  });
});
