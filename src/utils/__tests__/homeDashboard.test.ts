/**
 * Selector rules behind the Home dashboard. Includes the negative cases the
 * brief's filters are most likely to get wrong: the `is_organiser` field is a
 * stub that is always `false` from the API mapper, so organiser exclusion
 * must work from `organiser_id` alone.
 */
import { makeEvent } from '../../test-utils/makeEvent';
import {
  DEFAULT_SPORT_EMOJI,
  MAX_SECTION_ITEMS,
  countMyGames,
  getRecommendedGames,
  getSportOptions,
  getUpcomingGames,
  isOrganiserOf,
  sportEmoji,
  sportKey,
  sportLabel,
} from '../homeDashboard';

const ME = 'user-me';

const ids = (events: { id: string }[]): string[] => events.map(event => event.id);

describe('sport display', () => {
  it.each([
    ['badminton', '🏸'],
    ['football', '⚽'],
    ['tennis', '🎾'],
    ['basketball', '🏀'],
    ['volleyball', '🏐'],
  ])('maps %s to %s', (sport, emoji) => {
    expect(sportEmoji(sport)).toBe(emoji);
  });

  it('matches case-insensitively and ignores surrounding whitespace', () => {
    expect(sportEmoji('  BadMinton ')).toBe('🏸');
    expect(sportKey('  BadMinton ')).toBe('badminton');
  });

  it('falls back to the default emoji for an unmapped or empty sport', () => {
    expect(sportEmoji('curling')).toBe(DEFAULT_SPORT_EMOJI);
    expect(sportEmoji('')).toBe(DEFAULT_SPORT_EMOJI);
    expect(DEFAULT_SPORT_EMOJI).toBe('🎯');
  });

  it('title-cases each word of the label', () => {
    expect(sportLabel('badminton')).toBe('Badminton');
    expect(sportLabel('table   tennis')).toBe('Table Tennis');
  });
});

describe('getSportOptions', () => {
  it('returns one option per distinct sport, de-duplicated case-insensitively and sorted by label', () => {
    const options = getSportOptions([
      makeEvent({ id: 'a', sport: 'tennis' }),
      makeEvent({ id: 'b', sport: 'Badminton' }),
      makeEvent({ id: 'c', sport: 'badminton' }),
      makeEvent({ id: 'd', sport: 'football' }),
    ]);
    expect(options.map(o => o.label)).toEqual(['Badminton', 'Football', 'Tennis']);
    expect(options.map(o => o.key)).toEqual(['badminton', 'football', 'tennis']);
    expect(options[0].emoji).toBe('🏸');
  });

  it('is sorted independently of feed order', () => {
    const a = getSportOptions([makeEvent({ sport: 'tennis' }), makeEvent({ sport: 'football' })]);
    const b = getSportOptions([makeEvent({ sport: 'football' }), makeEvent({ sport: 'tennis' })]);
    expect(a).toEqual(b);
  });

  it('omits sports that only have cancelled/completed events, and empty sports', () => {
    const options = getSportOptions([
      makeEvent({ sport: 'tennis', status: 'cancelled' }),
      makeEvent({ sport: 'football', status: 'completed' }),
      makeEvent({ sport: '   ' }),
      makeEvent({ sport: 'badminton' }),
    ]);
    expect(options.map(o => o.key)).toEqual(['badminton']);
  });

  it('returns an empty list for an empty feed', () => {
    expect(getSportOptions([])).toEqual([]);
  });
});

describe('isOrganiserOf', () => {
  it('detects an organiser by organiser_id even though is_organiser is a stub `false`', () => {
    const event = makeEvent({ organiser_id: ME, is_organiser: false });
    expect(isOrganiserOf(event, ME)).toBe(true);
  });

  it('honours is_organiser if the backend/mapper ever sets it', () => {
    expect(isOrganiserOf(makeEvent({ is_organiser: true }), ME)).toBe(true);
  });

  it('is false for someone else’s event, and never matches on an unknown user', () => {
    expect(isOrganiserOf(makeEvent({ organiser_id: 'other' }), ME)).toBe(false);
    expect(isOrganiserOf(makeEvent({ organiser_id: '' }), undefined)).toBe(false);
    expect(isOrganiserOf(makeEvent({ organiser_id: '' }), '')).toBe(false);
  });
});

describe('getUpcomingGames', () => {
  it('keeps only going/waitlisted events, soonest first', () => {
    const events = [
      makeEvent({ id: 'late', current_user_rsvp_status: 'going', starts_at: '2026-10-05T10:00:00Z' }),
      makeEvent({ id: 'none', current_user_rsvp_status: 'none', starts_at: '2026-09-20T10:00:00Z' }),
      makeEvent({ id: 'wait', current_user_rsvp_status: 'waitlisted', starts_at: '2026-09-21T10:00:00Z' }),
      makeEvent({ id: 'withdrawn', current_user_rsvp_status: 'withdrawn' }),
      makeEvent({ id: 'early', current_user_rsvp_status: 'going', starts_at: '2026-09-22T10:00:00Z' }),
    ];
    expect(ids(getUpcomingGames(events, null))).toEqual(['wait', 'early', 'late']);
  });

  it('does not mutate the input array', () => {
    const events = [
      makeEvent({ id: 'b', current_user_rsvp_status: 'going', starts_at: '2026-10-05T10:00:00Z' }),
      makeEvent({ id: 'a', current_user_rsvp_status: 'going', starts_at: '2026-09-20T10:00:00Z' }),
    ];
    getUpcomingGames(events, null);
    expect(ids(events)).toEqual(['b', 'a']);
  });

  it('excludes cancelled and completed events even when the user is going', () => {
    const events = [
      makeEvent({ id: 'x', current_user_rsvp_status: 'going', status: 'cancelled' }),
      makeEvent({ id: 'y', current_user_rsvp_status: 'going', status: 'completed' }),
      makeEvent({ id: 'z', current_user_rsvp_status: 'going', status: 'active' }),
    ];
    expect(ids(getUpcomingGames(events, null))).toEqual(['z']);
  });

  it('filters by sport, case-insensitively', () => {
    const events = [
      makeEvent({ id: 'b', sport: 'Badminton', current_user_rsvp_status: 'going' }),
      makeEvent({ id: 't', sport: 'tennis', current_user_rsvp_status: 'going' }),
    ];
    expect(ids(getUpcomingGames(events, 'badminton'))).toEqual(['b']);
    expect(ids(getUpcomingGames(events, null))).toHaveLength(2);
  });

  it('sorts an unparseable start time last without breaking the order of the rest', () => {
    const events = [
      makeEvent({ id: 'bad', current_user_rsvp_status: 'going', starts_at: 'not-a-date' }),
      makeEvent({ id: 'b', current_user_rsvp_status: 'going', starts_at: '2026-10-01T10:00:00Z' }),
      makeEvent({ id: 'a', current_user_rsvp_status: 'going', starts_at: '2026-09-21T10:00:00Z' }),
    ];
    expect(ids(getUpcomingGames(events, null))).toEqual(['a', 'b', 'bad']);
  });

  it('returns every match (unbounded); the 3-item cap belongs to the section', () => {
    const events = Array.from({ length: 5 }, (_, i) =>
      makeEvent({ id: `e${i}`, current_user_rsvp_status: 'going' }),
    );
    expect(getUpcomingGames(events, null)).toHaveLength(5);
    expect(MAX_SECTION_ITEMS).toBe(3);
  });
});

describe('getRecommendedGames', () => {
  it('keeps only public events the user has not joined, in feed order', () => {
    const events = [
      makeEvent({ id: 'p2', visibility: 'public' }),
      makeEvent({ id: 'group', visibility: 'group' }),
      makeEvent({ id: 'invite', visibility: 'invite_only' }),
      makeEvent({ id: 'going', current_user_rsvp_status: 'going' }),
      makeEvent({ id: 'wait', current_user_rsvp_status: 'waitlisted' }),
      makeEvent({ id: 'p1', visibility: 'public' }),
    ];
    expect(ids(getRecommendedGames(events, ME, null))).toEqual(['p2', 'p1']);
  });

  it('excludes events the user organises, detected by organiser_id (is_organiser stays false)', () => {
    const events = [
      makeEvent({ id: 'mine', organiser_id: ME, is_organiser: false }),
      makeEvent({ id: 'theirs', organiser_id: 'other' }),
    ];
    expect(ids(getRecommendedGames(events, ME, null))).toEqual(['theirs']);
  });

  it('excludes events flagged is_organiser even if the id does not match', () => {
    const events = [makeEvent({ id: 'flagged', is_organiser: true })];
    expect(getRecommendedGames(events, ME, null)).toEqual([]);
  });

  it('excludes cancelled and completed events', () => {
    const events = [
      makeEvent({ id: 'c', status: 'cancelled' }),
      makeEvent({ id: 'd', status: 'completed' }),
      makeEvent({ id: 'ok', status: 'upcoming' }),
    ];
    expect(ids(getRecommendedGames(events, ME, null))).toEqual(['ok']);
  });

  it('filters by sport', () => {
    const events = [
      makeEvent({ id: 'b', sport: 'badminton' }),
      makeEvent({ id: 't', sport: 'tennis' }),
    ];
    expect(ids(getRecommendedGames(events, ME, 'tennis'))).toEqual(['t']);
  });

  it('with no known user, still returns public un-joined events (does not crash or over-exclude)', () => {
    const events = [makeEvent({ id: 'a', organiser_id: 'anyone' })];
    expect(ids(getRecommendedGames(events, undefined, null))).toEqual(['a']);
  });
});

describe('countMyGames', () => {
  it('counts events the user organises or is going to, without double-counting both', () => {
    const events = [
      makeEvent({ id: 'org', organiser_id: ME }),
      makeEvent({ id: 'going', current_user_rsvp_status: 'going' }),
      makeEvent({ id: 'both', organiser_id: ME, current_user_rsvp_status: 'going' }),
      makeEvent({ id: 'wait', current_user_rsvp_status: 'waitlisted' }),
      makeEvent({ id: 'none' }),
    ];
    expect(countMyGames(events, ME)).toBe(3);
  });

  it('does not count cancelled or completed events', () => {
    const events = [
      makeEvent({ organiser_id: ME, status: 'cancelled' }),
      makeEvent({ current_user_rsvp_status: 'going', status: 'completed' }),
    ];
    expect(countMyGames(events, ME)).toBe(0);
  });

  it('is zero for an empty feed', () => {
    expect(countMyGames([], ME)).toBe(0);
  });
});
