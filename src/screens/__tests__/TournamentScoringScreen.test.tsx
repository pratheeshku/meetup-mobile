/**
 * Standings, results and bracket screen (match-scoring v1.2 read views). Real renders over a mocked API
 * that returns ms-s4 Appendix A1 shaped data; labels are the bundled English defaults.
 */
import React from 'react';

import { getTournamentScoringState, getTournamentStandings } from '../../api/tournaments';
import { act, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { STANDINGS_RAW, withMine } from '../../test-utils/scoringFixtures';
import { normaliseStandings } from '../../utils/tournamentScoring';
import TournamentScoringScreen from '../TournamentScoringScreen';

type Props = React.ComponentProps<typeof TournamentScoringScreen>;

jest.mock('../../api/tournaments', () => ({
  getTournamentStandings: jest.fn(),
  getTournamentScoringState: jest.fn(),
}));

const mockStandings = getTournamentStandings as jest.MockedFunction<typeof getTournamentStandings>;
const mockState = getTournamentScoringState as jest.MockedFunction<typeof getTournamentScoringState>;

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
const flat = (n: Instance): Record<string, unknown> =>
  Object.assign({}, ...[n.props.style].flat(Infinity).filter(Boolean));
const hasTab = (root: Instance, label: string): boolean =>
  root.findAll(n => n.props.accessibilityRole === 'tab' && n.props.accessibilityLabel === label).length > 0;
const matchIds = (root: Instance): string[] =>
  root
    .findAll(n => (n.type as unknown) === 'View' && typeof n.props.testID === 'string' && /^scoring-match-[^-]+$/.test(n.props.testID))
    .map(n => n.props.testID.replace('scoring-match-', ''));

beforeEach(() => {
  setOptions.mockReset();
  mockStandings.mockReset().mockResolvedValue(normaliseStandings(STANDINGS_RAW));
  mockState.mockReset().mockResolvedValue({ enabled: true, applicable: true });
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

  it('highlights the rows the backend marks qualifies: true, and no others', async () => {
    const root = await mount();
    expect(flat(root.findByProps({ testID: 'scoring-row-r1' })).backgroundColor).toBeDefined();
    expect(flat(root.findByProps({ testID: 'scoring-row-r2' })).backgroundColor).toBeDefined();
    expect(flat(root.findByProps({ testID: 'scoring-row-r3' })).backgroundColor).toBeUndefined(); // qualifies: false
    expect(root.findByProps({ testID: 'scoring-row-r1' }).props.accessibilityLabel).toContain('Qualified');
    expect(root.findByProps({ testID: 'scoring-row-r3' }).props.accessibilityLabel).not.toContain('Qualified');
    expect(texts(root)).toContain('Highlighted players have qualified for the knockout.');
  });

  it('shows no marker where qualifies is null: a provisional group and an unresolved tie', async () => {
    const root = await mount();
    await press(tab(root, 'B'));
    expect(root.findAllByProps({ testID: 'scoring-provisional' }).length).toBeGreaterThan(0);
    expect(texts(root)).toContain('Provisional');
    expect(texts(root)).toContain('This group has matches still to play, so the table may change.');
    expect(flat(root.findByProps({ testID: 'scoring-row-r5' })).backgroundColor).toBeUndefined();
    await press(tab(root, 'C'));
    expect(texts(root.findByProps({ testID: 'scoring-row-r7' }))[0]).toBe('=1');
    expect(root.findByProps({ testID: 'scoring-row-r7' }).props.accessibilityLabel).toContain('Tied');
    expect([ 'r7', 'r8', 'r9' ].every(id => flat(root.findByProps({ testID: `scoring-row-${id}` })).backgroundColor === undefined)).toBe(true);
    expect(texts(root)).toContain('Tied players share a place until the committee settles it.');
    expect(root.findAllByProps({ testID: 'scoring-provisional' })).toHaveLength(0);
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

  it('draws placeholders from the server detail: C1, Winner of QF1, Loser of SF1, generic when unknown', async () => {
    const root = await mount();
    await press(tab(root, 'Knockout'));
    const qf = texts(root);
    expect(qf).toEqual(expect.arrayContaining(['C1', 'D2']));
    await press(tab(root, 'SF'));
    expect(texts(root)).toEqual(expect.arrayContaining(['Winner of QF1', 'Winner of QF2']));
    await press(tab(root, 'Final'));
    expect(texts(root)).toContain('Winner of SF1');
    expect(texts(root)).toContain('Winner of an earlier match'); // match_id not in the response
    await press(tab(root, '3rd'));
    expect(texts(root)).toContain('Loser of SF1');
    expect(texts(root)).toContain('Loser of an earlier match'); // match_id null
  });

  it('hides All | My matches when no side is mine, and filters by the server is_mine when one is', async () => {
    let root = await mount();
    await press(tab(root, 'Knockout'));
    expect(hasTab(root, 'My matches')).toBe(false);

    // Works for a team member too: only the server flag matters, no registration lookup is made.
    mockStandings.mockResolvedValue(normaliseStandings(withMine(STANDINGS_RAW, ['r1'])));
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

describe('gating by the scoring state, no scoring data and failures', () => {
  it('asks the state first and loads the standings only when scoring is enabled and applicable', async () => {
    await mount();
    expect(mockState).toHaveBeenCalledWith('t-1', expect.any(Object));
    expect(mockStandings).toHaveBeenCalledWith('t-1', expect.any(Object));
  });

  it.each([
    ['switched off', { enabled: false, applicable: true }],
    ['not applicable', { enabled: true, applicable: false }],
    ['no state (404)', null],
  ])('shows "not available" and never calls the standings when scoring is %s', async (_name, state) => {
    mockState.mockResolvedValue(state);
    const root = await mount();
    expect(texts(root)).toContain('Standings are not available for this tournament.');
    expect(mockStandings).not.toHaveBeenCalled();
  });

  it('says standings are not available when the standings have no scoring data (v1 shape, unpublished)', async () => {
    mockStandings.mockResolvedValue(null);
    const root = await mount();
    expect(texts(root)).toContain('Standings are not available for this tournament.');
  });

  it.each([
    ['the state call', () => mockState.mockRejectedValueOnce(new Error('down'))],
    ['the standings call', () => mockStandings.mockRejectedValueOnce(new Error('down'))],
  ])('shows the error with Retry when %s fails, and recovers', async (_name, arrange) => {
    arrange();
    const root = await mount();
    expect(texts(root)).toContain('Could not load the standings. Please try again.');
    const retry = root.findAll(n => n.props.accessibilityRole === 'button' && typeof n.props.onPress === 'function')[0];
    await press(retry);
    expect(root.findAllByProps({ testID: 'tournament-scoring-screen' }).length).toBeGreaterThan(0);
  });
});
