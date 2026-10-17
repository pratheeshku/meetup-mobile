/**
 * AD-14 / AD-15 / AD-9 list rules. EXECUTES the shared selectors against
 * fixture games (no source-string checks).
 */
import { makeEvent } from '../../test-utils/makeEvent';
import type { Event } from '../../types/event';
import type { Sport } from '../../types/sport';
import type { SkillLevel } from '../../types/user';
import {
  compareGames,
  countMyGames,
  effectiveSportSelection,
  filteredEmptyMessage,
  getDefaultSportSelection,
  getGameBadge,
  getSportOptions,
  isOrganiserOf,
  selectGames,
  selectMyGames,
  selectMyGamesWithHistory,
  selectNextGame,
  selectOpenGames,
  toggleSportSelection,
} from '../gameLists';

const NOW = Date.parse('2026-10-01T12:00:00Z');
const ME = 'user-me';
const iso = (hoursFromNow: number): string => new Date(NOW + hoursFromNow * 3_600_000).toISOString();
const ids = (events: Event[]): string[] => events.map(event => event.id);
const opts = { userId: ME, now: NOW };

const FEED: Event[] = [
  makeEvent({ id: 'hosted', organiser_id: ME, starts_at: iso(30) }),
  makeEvent({ id: 'going', current_user_rsvp_status: 'going', starts_at: iso(10) }),
  makeEvent({ id: 'wait', current_user_rsvp_status: 'waitlisted', starts_at: iso(20) }),
  makeEvent({ id: 'open-a', starts_at: iso(5) }),
  makeEvent({ id: 'open-b', starts_at: iso(40) }),
  // Never appear anywhere:
  makeEvent({ id: 'past-going', current_user_rsvp_status: 'going', starts_at: iso(-3) }),
  makeEvent({ id: 'past-open', starts_at: iso(-30) }),
  makeEvent({ id: 'cancelled-hosted', organiser_id: ME, status: 'cancelled', starts_at: iso(8) }),
  makeEvent({ id: 'cancelled-open', status: 'cancelled', starts_at: iso(9) }),
  // Group games the user can see are joinable, so they count as open.
  makeEvent({ id: 'group-open', visibility: 'group', starts_at: iso(6) }),
  // Not open: invite-only (needs accept step), declined/withdrawn (non-"none" status).
  makeEvent({ id: 'invite-only', visibility: 'invite_only', starts_at: iso(7) }),
  makeEvent({ id: 'declined', current_user_rsvp_status: 'withdrawn', starts_at: iso(11) }),
];

describe('My games (AD-14)', () => {
  it('includes hosted, going and waitlisted games, earliest first', () => {
    expect(ids(selectMyGames(FEED, opts))).toEqual(['going', 'wait', 'hosted']);
  });

  it('never includes past or cancelled games, even when hosted or going', () => {
    const mine = ids(selectMyGames(FEED, opts));
    expect(mine).not.toContain('past-going');
    expect(mine).not.toContain('cancelled-hosted');
  });

  it('detects the organiser from organiser_id although is_organiser is always false', () => {
    const hosted = FEED.find(event => event.id === 'hosted') as Event;
    expect(hosted.is_organiser).toBe(false);
    expect(isOrganiserOf(hosted, ME)).toBe(true);
    expect(isOrganiserOf(hosted, undefined)).toBe(false);
  });
});

describe('Open / Recommended games (AD-14)', () => {
  it('lists future public and group games the user does not organise and has not accepted, earliest first', () => {
    expect(ids(selectOpenGames(FEED, opts))).toEqual(['open-a', 'group-open', 'open-b']);
  });

  it('excludes hosted, going, waitlisted, declined, cancelled, past and invite-only games', () => {
    const open = ids(selectOpenGames(FEED, opts));
    for (const excluded of [
      'hosted',
      'going',
      'wait',
      'declined',
      'cancelled-open',
      'past-open',
      'invite-only',
    ]) {
      expect(open).not.toContain(excluded);
    }
  });
});

describe('ordering', () => {
  it('sorts by start time ascending regardless of feed order', () => {
    const shuffled = [...FEED].reverse();
    expect(ids(selectGames(shuffled, 'all', opts))).toEqual([
      'open-a',
      'group-open',
      'going',
      'wait',
      'hosted',
      'open-b',
    ]);
  });

  it('breaks start-time ties by creation time, earliest first', () => {
    const tie = iso(12);
    const a = makeEvent({ id: 'later-created', starts_at: tie, created_at: iso(-1) });
    const b = makeEvent({ id: 'earlier-created', starts_at: tie, created_at: iso(-50) });
    expect(ids(selectOpenGames([a, b], opts))).toEqual(['earlier-created', 'later-created']);
  });

  it('puts unparseable start times last and keeps the comparator total', () => {
    const bad = makeEvent({ id: 'bad', starts_at: 'not-a-date' });
    const good = makeEvent({ id: 'good', starts_at: iso(2) });
    expect(compareGames(bad, good)).toBe(1);
    expect(compareGames(good, bad)).toBe(-1);
    expect(compareGames(bad, bad)).toBe(0);
  });
});

describe('Games screen union and scope (AD-15)', () => {
  it('"all" is the union of My games and Open games, earliest first', () => {
    expect(ids(selectGames(FEED, 'all', opts))).toEqual([
      'open-a',
      'group-open',
      'going',
      'wait',
      'hosted',
      'open-b',
    ]);
  });

  it('"mine" is My games only and "open" is Open games only', () => {
    expect(ids(selectGames(FEED, 'mine', opts))).toEqual(['going', 'wait', 'hosted']);
    expect(ids(selectGames(FEED, 'open', opts))).toEqual(['open-a', 'group-open', 'open-b']);
  });

  it('scope combines with the sport filter', () => {
    const feed = [
      makeEvent({ id: 'b-mine', sport: 'badminton', current_user_rsvp_status: 'going', starts_at: iso(1) }),
      makeEvent({ id: 't-mine', sport: 'Tennis', current_user_rsvp_status: 'going', starts_at: iso(2) }),
      makeEvent({ id: 'b-open', sport: 'badminton', starts_at: iso(3) }),
      makeEvent({ id: 't-open', sport: 'tennis', starts_at: iso(4) }),
    ];
    expect(ids(selectGames(feed, 'mine', { ...opts, sportKeys: ['tennis'] }))).toEqual(['t-mine']);
    expect(ids(selectGames(feed, 'open', { ...opts, sportKeys: ['badminton'] }))).toEqual(['b-open']);
    expect(ids(selectGames(feed, 'all', { ...opts, sportKeys: ['badminton', 'tennis'] }))).toEqual([
      'b-mine',
      't-mine',
      'b-open',
      't-open',
    ]);
  });
});

describe('badges (AD-15)', () => {
  const byId = (id: string): Event => FEED.find(event => event.id === id) as Event;

  it('gives exactly one badge: Hosting, Going, Waitlisted or Open', () => {
    expect(getGameBadge(byId('hosted'), ME)).toBe('Hosting');
    expect(getGameBadge(byId('going'), ME)).toBe('Going');
    expect(getGameBadge(byId('wait'), ME)).toBe('Waitlisted');
    expect(getGameBadge(byId('open-a'), ME)).toBe('Open');
    expect(getGameBadge(byId('group-open'), ME)).toBe('Open');
  });

  it('Hosting wins when the user hosts a game they are also going to', () => {
    const both = makeEvent({ organiser_id: ME, current_user_rsvp_status: 'going' });
    expect(getGameBadge(both, ME)).toBe('Hosting');
  });

  it('has no badge for a game that is neither mine nor open', () => {
    expect(getGameBadge(byId('invite-only'), ME)).toBeNull();
    expect(getGameBadge(byId('declined'), ME)).toBeNull();
  });
});

describe('next game card and tile count (AD-7, AD-9)', () => {
  it('the next game is the soonest registered game, and My games repeats it', () => {
    const next = selectNextGame(FEED, opts) as Event;
    expect(next.id).toBe('going');
    expect(ids(selectMyGames(FEED, opts).slice(0, 2))).toContain(next.id);
  });

  it('a single registered game appears as both the next game and in My games', () => {
    const single = [makeEvent({ id: 'only', current_user_rsvp_status: 'going', starts_at: iso(3) })];
    expect(selectNextGame(single, opts)?.id).toBe('only');
    expect(ids(selectMyGames(single, opts))).toEqual(['only']);
  });

  it('when filtered, the next game is the soonest matching game', () => {
    const feed = [
      makeEvent({ id: 'b', sport: 'badminton', current_user_rsvp_status: 'going', starts_at: iso(1) }),
      makeEvent({ id: 't', sport: 'tennis', current_user_rsvp_status: 'going', starts_at: iso(2) }),
    ];
    expect(selectNextGame(feed, { ...opts, sportKeys: ['tennis'] })?.id).toBe('t');
    expect(selectNextGame(feed, { ...opts, sportKeys: ['football'] })).toBeNull();
  });

  it('counts the unfiltered My games set', () => {
    expect(countMyGames(FEED, ME, NOW)).toBe(3);
  });
});

describe('sport chip selection (AD-9)', () => {
  const sports: Sport[] = [
    { name: 'Tennis', display_name: 'Tennis', slug: 'tennis' },
    { name: 'badminton', display_name: 'Badminton', slug: 'Badminton' },
    { name: 'football', display_name: 'Football' },
  ];
  const options = getSportOptions(sports);

  it('builds one option per admin sport, sorted by label, keyed case-insensitively', () => {
    expect(options.map(option => [option.key, option.label, option.slug])).toEqual([
      ['badminton', 'Badminton', 'badminton'],
      ['football', 'Football', 'football'],
      ['tennis', 'Tennis', 'tennis'],
    ]);
  });

  it('toggles a sport on and off; clearing every sport selects All', () => {
    let selection = toggleSportSelection([], 'tennis');
    expect(selection).toEqual(['tennis']);
    selection = toggleSportSelection(selection, 'badminton');
    expect(selection).toEqual(['tennis', 'badminton']);
    selection = toggleSportSelection(selection, 'tennis');
    expect(selection).toEqual(['badminton']);
    selection = toggleSportSelection(selection, 'badminton');
    expect(selection).toEqual([]);
  });

  it('All is exclusive: tapping it clears the others', () => {
    expect(toggleSportSelection(['tennis', 'badminton'], null)).toEqual([]);
  });

  it('defaults to the skill sports that exist in the admin list', () => {
    const skills: SkillLevel[] = [
      { sport: 'Tennis', skill_level: 'beginner' },
      { sport: 'badminton', skill_level: 'expert' },
      { sport: 'rugby', skill_level: 'expert' },
      { sport: 'tennis', skill_level: 'intermediate' },
    ];
    expect(getDefaultSportSelection(skills, options)).toEqual(['tennis', 'badminton']);
  });

  it('defaults to All when the user has no skill sports or none match the admin list', () => {
    expect(getDefaultSportSelection([], options)).toEqual([]);
    expect(getDefaultSportSelection([{ sport: 'rugby', skill_level: 'expert' }], options)).toEqual([]);
  });

  it('ignores selected keys that left the admin list, without rewriting them', () => {
    const stored = ['tennis', 'rugby'];
    expect(effectiveSportSelection(stored, options)).toEqual(['tennis']);
    expect(stored).toEqual(['tennis', 'rugby']);
  });

  it('writes the filtered-empty message with the selected sport names', () => {
    expect(filteredEmptyMessage(['tennis'], options)).toBe(
      'No Tennis games here — clear the filter to see all',
    );
    expect(filteredEmptyMessage(['badminton', 'tennis'], options)).toBe(
      'No Badminton and Tennis games here — clear the filter to see all',
    );
    expect(filteredEmptyMessage(['badminton', 'football', 'tennis'], options)).toBe(
      'No Badminton, Football and Tennis games here — clear the filter to see all',
    );
  });
});

describe('display status in the lists', () => {
  const MIXED: Event[] = [
    makeEvent({ id: 'later', organiser_id: ME, starts_at: iso(30), display_status: 'active' }),
    makeEvent({ id: 'soon', current_user_rsvp_status: 'going', starts_at: iso(10), display_status: 'active' }),
    makeEvent({ id: 'done-old', current_user_rsvp_status: 'going', starts_at: iso(-50), display_status: 'completed' }),
    makeEvent({ id: 'done-new', current_user_rsvp_status: 'going', starts_at: iso(-5), display_status: 'completed' }),
    makeEvent({ id: 'cancelled-past', organiser_id: ME, status: 'cancelled', starts_at: iso(-20), display_status: 'cancelled' }),
    makeEvent({ id: 'cancelled-future', organiser_id: ME, status: 'cancelled', starts_at: iso(15), display_status: 'cancelled' }),
    makeEvent({ id: 'not-mine', starts_at: iso(-1), display_status: 'completed' }),
  ];

  it('My games with history: upcoming active earliest first, then past (completed and cancelled) most recent first', () => {
    expect(ids(selectMyGamesWithHistory(MIXED, opts))).toEqual([
      'soon',
      'later',
      'cancelled-future',
      'done-new',
      'cancelled-past',
      'done-old',
    ]);
  });

  it('applies the sport filter to the history list too', () => {
    const feed = [
      makeEvent({ id: 'a', sport: 'tennis', organiser_id: ME, starts_at: iso(-3), display_status: 'completed' }),
      makeEvent({ id: 'b', sport: 'football', organiser_id: ME, starts_at: iso(-4), display_status: 'completed' }),
    ];
    expect(ids(selectMyGamesWithHistory(feed, { ...opts, sportKeys: ['tennis'] }))).toEqual(['a']);
  });

  it('keeps cancelled and completed games out of My games, Open games and the next-game card', () => {
    const feed = [
      makeEvent({ id: 'open-done', starts_at: iso(5), display_status: 'completed' }),
      makeEvent({ id: 'open-cancelled', starts_at: iso(6), display_status: 'cancelled' }),
      makeEvent({ id: 'open-ok', starts_at: iso(7), display_status: 'active' }),
      makeEvent({ id: 'mine-done', current_user_rsvp_status: 'going', starts_at: iso(3), display_status: 'completed' }),
    ];
    expect(ids(selectOpenGames(feed, opts))).toEqual(['open-ok']);
    expect(ids(selectGames(feed, 'open', opts))).toEqual(['open-ok']);
    expect(selectMyGames(feed, opts)).toEqual([]);
    expect(selectNextGame(feed, opts)).toBeNull();
  });
});
