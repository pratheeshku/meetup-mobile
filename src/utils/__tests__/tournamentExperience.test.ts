import {
  committeeNames,
  formatDateRange,
  dayCount,
  keyDateStates,
  overviewKind,
  stripModel,
  stripTone,
  tabEntries,
  unlockLabelKey,
} from '../tournamentExperience';
import { normaliseScoringState, normaliseTabs } from '../tournamentScoring';
import type { TournamentPerson } from '../../types/tournament';

const base = { lifecycle: 'active', closureOutcome: null, phase: 'open', fixturesPublished: false };

describe('status strip model (server facts only)', () => {
  it('registration open: green-dot pill, no chip, stepper on Registration', () => {
    const model = stripModel(base);
    expect(model).toMatchObject({ pill: 'mob.tournament.v2.pill_registration_open', dot: 'open', chip: null });
    expect(model.stages).toEqual({ registration: 'current', fixtures: 'upcoming', play: 'upcoming', results: 'upcoming' });
  });

  it.each(['committee_only', 'frozen'])('registration closed (%s): pill, "Fixtures being prepared" chip, stepper on Fixtures', phase => {
    const model = stripModel({ ...base, phase });
    expect(model).toMatchObject({ pill: 'mob.tournament.v2.pill_registration_closed', chip: 'mob.tournament.v2.chip_fixtures_preparing' });
    expect(model.stages).toEqual({ registration: 'done', fixtures: 'current', play: 'upcoming', results: 'upcoming' });
  });

  it('fixtures published: in progress, stepper on Play; ended but not closed: Pending closure on Results', () => {
    expect(stripModel({ ...base, phase: 'frozen', fixturesPublished: true })).toMatchObject({
      pill: 'mob.tournament.v2.pill_in_progress',
      stages: { registration: 'done', fixtures: 'done', play: 'current', results: 'upcoming' },
    });
    expect(stripModel({ ...base, phase: 'frozen', fixturesPublished: true, lifecycle: 'past' })).toMatchObject({
      pill: 'mob.closure.status.pending',
      stages: { play: 'done', results: 'current' },
    });
  });

  it('closed: completed with every stage done; not held says so; cancelled draws no stepper', () => {
    expect(stripModel({ ...base, lifecycle: 'closed', phase: 'frozen', fixturesPublished: true })).toMatchObject({
      pill: 'mob.tournament.v2.pill_completed',
      stages: { registration: 'done', fixtures: 'done', play: 'done', results: 'done' },
    });
    expect(stripModel({ ...base, lifecycle: 'closed', closureOutcome: 'not_held' }).pill).toBe('mob.closure.status.not_held');
    expect(stripModel({ ...base, lifecycle: 'cancelled' })).toMatchObject({ pill: 'mob.closure.status.cancelled', stages: null });
  });

  it('an unknown phase never claims one', () => {
    expect(stripModel({ ...base, phase: null })).toMatchObject({ pill: 'mob.closure.status.active', stages: null });
  });

  it('overview kind and key-date glyph states follow the same facts', () => {
    expect(overviewKind(base)).toBe('open');
    expect(overviewKind({ ...base, phase: 'frozen' })).toBe('closed');
    expect(overviewKind({ ...base, phase: 'frozen', fixturesPublished: true })).toBe('live');
    expect(overviewKind({ ...base, lifecycle: 'closed' })).toBe('done');
    expect(overviewKind({ ...base, lifecycle: 'cancelled' })).toBe('cancelled');
    expect(overviewKind({ ...base, phase: null })).toBe('unknown');
    expect(keyDateStates('open')).toEqual({ opened: 'done', soft: 'current', hard: 'upcoming', fixtures: 'upcoming', days: 'upcoming' });
    // between the soft and the hard block (committee only) the hard block is the current row; once frozen, fixtures are
    expect(keyDateStates('closed')).toEqual({ opened: 'done', soft: 'done', hard: 'current', fixtures: 'upcoming', days: 'upcoming' });
    expect(keyDateStates('closed', true)).toEqual({ opened: 'done', soft: 'done', hard: 'done', fixtures: 'current', days: 'upcoming' });
    expect(keyDateStates('done')).toEqual({ opened: 'done', soft: 'done', hard: 'done', fixtures: 'done', days: 'done' });
  });
});

describe('banner tone and scrim are the server\'s', () => {
  it('uses what the server stored', () => {
    expect(stripTone('dark', 25)).toEqual({ tone: 'dark', scrim: 25 });
    expect(stripTone('light', 0)).toEqual({ tone: 'light', scrim: 0 });
  });
  it('falls back to the built-in light text and scrim 40 when the server sent none or nonsense', () => {
    expect(stripTone(null, null)).toEqual({ tone: 'light', scrim: 40 });
    expect(stripTone(undefined, 20)).toEqual({ tone: 'light', scrim: 40 });
    expect(stripTone('dark', 99)).toEqual({ tone: 'dark', scrim: 40 });
  });
});

describe('tabs come from the server object only', () => {
  const players = {
    overview: { state: 'open' },
    participants: { state: 'open' },
    fixtures: { state: 'locked', unlocks: 'fixtures_published' },
    standings: { state: 'locked', unlocks: 'fixtures_published' },
    results: { state: 'locked', unlocks: 'tournament_closed' },
    media: { state: 'locked', unlocks: 'play_starts' },
  };

  it('six fixed tabs in order; a player never gets Approvals', () => {
    const entries = tabEntries(normaliseTabs(players)!);
    expect(entries.map(entry => entry.key)).toEqual(['overview', 'participants', 'fixtures', 'standings', 'results', 'media']);
    expect(entries.find(entry => entry.key === 'fixtures')).toMatchObject({ locked: true, unlocks: 'fixtures_published' });
    expect(entries.find(entry => entry.key === 'overview')).toMatchObject({ locked: false, unlocks: null });
  });

  it('Approvals appears last, with its badge, only when the server sent it', () => {
    const entries = tabEntries(normaliseTabs({ ...players, approvals: { state: 'open', badge: 3 } })!);
    expect(entries[entries.length - 1]).toMatchObject({ key: 'approvals', locked: false, badge: 3 });
  });

  it('a tab the server did not send is not drawn; junk is ignored; no tabs object means the legacy page', () => {
    expect(tabEntries({ overview: { state: 'open' } }).map(entry => entry.key)).toEqual(['overview']);
    expect(normaliseTabs({ overview: { state: 'maybe' }, bogus: { state: 'open' } })).toBeNull();
    expect(normaliseTabs(undefined)).toBeNull();
    expect(normaliseScoringState({ enabled: true, applicable: true })).toEqual({ enabled: true, applicable: true });
    expect(normaliseScoringState({ enabled: true, applicable: true, tabs: players, registration_phase: 'open', live_poll_seconds: 10 })).toMatchObject({
      registration_phase: 'open',
      live_poll_seconds: 10,
      tabs: { fixtures: { state: 'locked', unlocks: 'fixtures_published' } },
    });
  });

  it('every unlock code has its own label; an unknown code falls back to the generic title', () => {
    expect(unlockLabelKey('registration_closes')).toBe('mob.tournament.tabs.locked.registration_closes');
    expect(unlockLabelKey('fixtures_published')).toBe('mob.tournament.tabs.locked.fixtures_published');
    expect(unlockLabelKey('play_starts')).toBe('mob.tournament.tabs.locked.play_starts');
    expect(unlockLabelKey('tournament_closed')).toBe('mob.tournament.tabs.locked.tournament_closed');
    expect(unlockLabelKey('something_new')).toBe('mob.tournament.tabs.locked_title');
    expect(unlockLabelKey(null)).toBe('mob.tournament.tabs.locked_title');
  });
});

describe('names, never ids', () => {
  const person = (name: string): TournamentPerson => ({ user_id: `id-${name}`, display_name: name, nickname: null, avatar_url: null });
  it('lists the first two names and the rest as a count', () => {
    expect(committeeNames([person('Alicia'), person('Joyce'), person('Sam')])).toBe('Alicia, Joyce +1');
    expect(committeeNames([person('Alicia'), person('Joyce')])).toBe('Alicia, Joyce');
    expect(committeeNames([person('Alicia')])).toBe('Alicia');
    expect(committeeNames([])).toBe('');
    expect(committeeNames([person('A'), person('B'), person('C')])).not.toContain('id-');
  });
  it('formats a date range in one month, across months and on one day', () => {
    expect(formatDateRange('2026-11-14T01:00:00Z', '2026-11-15T10:00:00Z')).toMatch(/14.*–.*15/);
    expect(formatDateRange('2026-11-14T01:00:00Z', '2026-11-14T10:00:00Z')).not.toContain('–');
    expect(formatDateRange('2026-11-28T01:00:00Z', '2026-12-02T10:00:00Z')).toMatch(/Nov.*–.*Dec/);
    expect(formatDateRange('2026-11-14T01:00:00Z', null)).not.toContain('–');
  });
});

describe('dayCount (Results summary)', () => {
  it('counts the days of the span, at least one, and nothing when a date is missing', () => {
    expect(dayCount('2026-11-14T01:00:00Z', '2026-11-15T10:00:00Z')).toBe(2);
    expect(dayCount('2026-11-14T01:00:00Z', '2026-11-14T10:00:00Z')).toBe(1);
    expect(dayCount('2026-11-14T01:00:00Z', null)).toBeNull();
  });
});
