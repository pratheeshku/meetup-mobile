import type { ScoringMatch, TournamentStandingsView } from '../../types/tournamentScoring';
import {
  applyEntry,
  approvalBucket,
  approvalCards,
  closureBody,
  closureInit,
  closureIssues,
  closureErrorKey,
  formatRuleRows,
  impactOf,
  justSetIds,
  matchesFor,
  mediaErrorKey,
  normaliseApprovals,
  normaliseEntryResponse,
  normaliseMediaPage,
  normalisePreview,
  participantRole,
  participantRows,
  playedCount,
  pollMs,
  readResultRefusal,
  scoreBody,
  scoreErrorKey,
  scoreFormInit,
  scoreIssues,
  starOptions,
  tiebreakKeys,
  usesV2Page,
  winnerSide,
} from '../tournamentTabs';

const side = (id: string | null, name: string | null, mine = false) => ({
  registration_id: id,
  name,
  placeholder: null,
  placeholder_detail: null,
  is_mine: mine,
});

const match = (over: Partial<ScoringMatch> = {}): ScoringMatch => ({
  fixture_id: 'f1',
  match_id: 'G1',
  stage: 'group',
  round_number: 1,
  fixture_order: 1,
  status: 'scheduled',
  scheduled_at: '2026-11-14T03:20:00Z',
  court: 'Court 1',
  side_a: side('ra', 'Ravi K.'),
  side_b: side('rb', 'Alicia Lim'),
  winner_registration_id: null,
  result: null,
  ...over,
});

const played = (): ScoringMatch =>
  match({
    status: 'completed',
    winner_registration_id: 'ra',
    result: { result_type: 'normal', sets: [{ a: 21, b: 17 }, { a: 18, b: 21 }, { a: 21, b: 19 }], advancing_side: null, version: 2 },
  });

const view = (over: Partial<TournamentStandingsView> = {}): TournamentStandingsView => ({
  tournament_id: 't1',
  published: true,
  groups: [
    {
      group_key: 'A',
      complete: false,
      provisional: true,
      unresolved_tie: false,
      needs_override: false,
      adjusted_by_committee: false,
      qualifiers_resolved: false,
      matches_total: 1,
      matches_played: 0,
      advance_per_group: 2,
      table: [
        { rank: 1, tied: false, registration_id: 'ra', name: 'Ravi K.', played: 0, won: 0, lost: 0, sets_for: 0, sets_against: 0, set_diff: 0, points_for: 0, points_against: 0, point_diff: 0, qualifies: null },
        { rank: 2, tied: false, registration_id: 'rb', name: 'Alicia Lim', played: 0, won: 0, lost: 0, sets_for: 0, sets_against: 0, set_diff: 0, points_for: 0, points_against: 0, point_diff: 0, qualifies: null },
      ],
      matches: [match()],
    },
  ],
  knockout: [match({ fixture_id: 'k1', match_id: 'SF1', stage: 'semifinal', side_a: side(null, null), side_b: side(null, null) })],
  ...over,
});

describe('which page and the refresh interval', () => {
  it('lifecycle_version decides; an older server falls back to the server tabs object', () => {
    expect(usesV2Page({ lifecycle_version: 2 }, null)).toBe(true);
    expect(usesV2Page({ lifecycle_version: 1 }, { tabs: { overview: { state: 'open' } } })).toBe(false);
    expect(usesV2Page({ lifecycle_version: null }, { tabs: { overview: { state: 'open' } } })).toBe(true);
    expect(usesV2Page({ lifecycle_version: undefined }, null)).toBe(false);
    expect(usesV2Page({}, undefined)).toBe(false);
  });

  it('the poll interval is the one the server sent, never a default', () => {
    expect(pollMs({ live_poll_seconds: 10 })).toBe(10000);
    expect(pollMs({ live_poll_seconds: 2.5 })).toBe(2500);
    expect(pollMs({ live_poll_seconds: 1 })).toBe(0);
    expect(pollMs({ live_poll_seconds: null })).toBe(0);
    expect(pollMs(null)).toBe(0);
  });
});

describe('Format rows (A2): only values the server stored', () => {
  it('draws sets, points and entrants; elimination and courts are never drawn', () => {
    const rows = formatRuleRows({ elimination: 'single', sets_best_of: 3, points_to_win: 21, courts: 4, min_participants: 6, max_participants: 32 });
    expect(rows.map(r => r.key)).toEqual(['sets', 'points', 'entrants']);
    expect(rows[2].params).toEqual({ min: 6, max: 32 });
  });

  it('skips every null and the whole card when there are no rules', () => {
    expect(formatRuleRows({ elimination: null, sets_best_of: null, points_to_win: 21, courts: null, min_participants: 6, max_participants: null })).toEqual([
      { key: 'points', labelKey: 'mob.tournament.v2.format_points', params: { count: 21 } },
    ]);
    expect(formatRuleRows(null)).toEqual([]);
  });
});

describe('fixtures lists', () => {
  it('filters All, Group stage, Knockouts and My matches from the board as it is', () => {
    const board = view({ groups: [{ ...view().groups[0], matches: [match({ side_a: side('ra', 'Ravi K.', true) }), match({ fixture_id: 'f2', scheduled_at: '2026-11-14T01:00:00Z' })] }] });
    expect(matchesFor(board, 'all').map(e => e.match.fixture_id)).toEqual(['f2', 'f1', 'k1']);
    expect(matchesFor(board, 'group').every(e => e.group === 'A')).toBe(true);
    expect(matchesFor(board, 'knockouts').map(e => e.match.fixture_id)).toEqual(['k1']);
    expect(matchesFor(board, 'mine').map(e => e.match.fixture_id)).toEqual(['f1']);
    expect(matchesFor(null, 'all')).toEqual([]);
  });

  it('counts played from the results the server sent', () => {
    const board = view({ groups: [{ ...view().groups[0], matches: [played(), match({ fixture_id: 'f2' })] }] });
    expect(playedCount(matchesFor(board, 'group'))).toEqual({ played: 1, total: 2 });
  });

  it('reads the winner side the server named; it decides nothing', () => {
    expect(winnerSide(played())).toBe('a');
    expect(winnerSide(match())).toBeNull();
    expect(winnerSide(match({ winner_registration_id: 'rb', result: played().result }))).toBe('b');
  });
});

describe('score body: never a winner (AD-T8)', () => {
  it('sends sets and a result type only', () => {
    const form = scoreFormInit(match());
    form.sets[0] = { a: '21', b: '17' };
    form.sets[1] = { a: '18', b: '21' };
    const body = scoreBody(form, { requestId: 'req-1' });
    expect(body).toEqual({
      result_type: 'normal',
      sets: [{ a: 21, b: 17 }, { a: 18, b: 21 }],
      advancing_side: null,
      expected_version: 0,
      client_request_id: 'req-1',
    });
    expect(Object.keys(body).filter(key => /winner/i.test(key))).toEqual([]);
  });

  it('sends the reason on a correction only, and the saved version', () => {
    const form = scoreFormInit(played());
    expect(form.mode).toBe('correct');
    expect(form.expectedVersion).toBe(2);
    form.reason = '  wrong way round ';
    expect(scoreBody(form, { withReason: true }).reason).toBe('wrong way round');
    expect(scoreBody(form).reason).toBeUndefined();
    expect(scoreBody(scoreFormInit(match()), { withReason: true }).reason).toBeUndefined();
  });

  it('a walkover carries no sets and a side; a completed match carries no side', () => {
    const form = scoreFormInit(match());
    form.resultType = 'walkover';
    form.advancing = 'b';
    form.sets[0] = { a: '21', b: '3' };
    expect(scoreBody(form)).toMatchObject({ result_type: 'walkover', sets: [], advancing_side: 'b' });
    form.resultType = 'normal';
    expect(scoreBody(form).advancing_side).toBeNull();
  });
});

describe('score shape problems (the server checks everything again)', () => {
  const blank = () => scoreFormInit(match());

  it('set 1 is required for a completed match', () => {
    expect(scoreIssues(blank())).toContain('SET1_REQUIRED');
  });

  it('set 3 only with set 2', () => {
    const form = blank();
    form.sets[0] = { a: '21', b: '10' };
    form.sets[2] = { a: '21', b: '10' };
    expect(scoreIssues(form)).toEqual(['SET_GAP']);
  });

  it('a half-filled set is flagged', () => {
    const form = blank();
    form.sets[0] = { a: '21', b: '' };
    expect(scoreIssues(form)).toContain('SET_INCOMPLETE');
  });

  it('level sets are NOT flagged: only the server applies the winner rule', () => {
    const form = blank();
    form.sets[0] = { a: '21', b: '19' };
    form.sets[1] = { a: '19', b: '21' };
    expect(scoreIssues(form)).toEqual([]);
  });

  it('a walkover needs a side; a correction needs a reason', () => {
    const form = scoreFormInit(played());
    expect(scoreIssues(form)).toEqual(['REASON_REQUIRED']);
    form.resultType = 'retired';
    expect(scoreIssues(form)).toContain('ADVANCING_REQUIRED');
  });
});

describe('refusals', () => {
  const refusal = (status: number, data: unknown) => readResultRefusal({ response: { status, data } });

  it('MATCH_TIED has its new text; NO_DERIVABLE_WINNER (an old server) reads the same', () => {
    expect(scoreErrorKey(refusal(422, { code: 'MATCH_TIED', errors: [{ column: 'sets', code: 'MATCH_TIED' }] }))).toBe('mob.tournament.score.err.MATCH_TIED');
    expect(scoreErrorKey(refusal(422, { code: 'RESULT_INVALID', errors: [{ code: 'NO_DERIVABLE_WINNER' }] }))).toBe('mob.tournament.score.err.MATCH_TIED');
  });

  it('RESULTS_LOCKED and REASON_REQUIRED have their own text; anything else is a plain failure', () => {
    expect(scoreErrorKey(refusal(409, { code: 'RESULTS_LOCKED' }))).toBe('mob.tournament.score.err.RESULTS_LOCKED');
    expect(scoreErrorKey(refusal(422, { code: 'REASON_REQUIRED' }))).toBe('mob.tournament.score.err.REASON_REQUIRED');
    expect(scoreErrorKey(refusal(500, {}))).toBe('mob.tournament.score.save_failed');
  });

  it('a winner change is read as "needs approval", a stale match carries the current one', () => {
    expect(refusal(409, { code: 'CORRECTION_NEEDS_APPROVAL' }).needsApproval).toBe(true);
    const stale = refusal(409, { code: 'RESULT_STALE', match: { fixture_id: 'f1', side_a: {}, side_b: {} } });
    expect(stale.currentMatch?.fixture_id).toBe('f1');
  });
});

describe('the impact box reads the server preview', () => {
  const preview = () =>
    normalisePreview({
      was: { ...played(), result: { ...played().result, sets: [{ a: 21, b: 12 }] } },
      will_be: { ...played(), winner_registration_id: 'rb', result: { result_type: 'normal', sets: [{ a: 17, b: 21 }, { a: 21, b: 13 }, { a: 18, b: 21 }], advancing_side: null, version: 3 } },
      standings_delta: [{ ...view().groups[0], table: [{ ...view().groups[0].table[1], rank: 1 }, { ...view().groups[0].table[0], rank: 2 }] }],
      advanced: [{ match_id: 'SF1', fixture_id: 'k1', side: 'A', name: 'Alicia Lim', registration_id: 'rb', change: 'slot_replaced' }],
      blocked_by: [{ code: 'CORRECTION_NEEDS_APPROVAL', detail: 'x' }],
    });

  it('names the new score, the new winner, the rank moves and the refilled slot', () => {
    const impact = impactOf(preview(), view());
    expect(impact.needsApproval).toBe(true);
    expect(impact.from).toBe('1–0');
    expect(impact.to).toBe('1–2');
    expect(impact.winnerChanged).toBe(true);
    expect(impact.newWinner).toBe('Alicia Lim');
    expect(impact.rankMoves).toEqual([
      { group: 'A', name: 'Alicia Lim', from: 2, to: 1 },
      { group: 'A', name: 'Ravi K.', from: 1, to: 2 },
    ]);
    expect(impact.advances).toHaveLength(1);
    expect(impact.advances[0].newName).toBe('Alicia Lim');
  });

  it('a downstream-played block has no will_be and names the later matches', () => {
    const impact = impactOf(
      normalisePreview({ was: played(), will_be: null, standings_delta: [], advanced: [], blocked_by: [{ code: 'DOWNSTREAM_PLAYED', detail: 'x', matches: [{ match_id: 'SF1', stage: 'semifinal', round_number: 2 }] }] }),
      view(),
    );
    expect(impact.hasWillBe).toBe(false);
    expect(impact.downstream).toEqual([{ stage: 'semifinal', matchId: 'SF1' }]);
  });
});

describe('live fill: only what the entry response names changes', () => {
  const entry = () =>
    normaliseEntryResponse({
      outcome: 'posted',
      match: { ...played(), fixture_id: 'f1' },
      standings_delta: [{ ...view().groups[0], matches_played: 1, provisional: false, table: [{ ...view().groups[0].table[0], played: 1, won: 1 }] }],
      advanced: [{ match_id: 'SF1', fixture_id: 'k1', side: 'A', name: 'Ravi K.', registration_id: 'ra', change: 'slot_filled' }],
      qualified: [{ group_key: 'A', place: 1, registration_id: 'ra', name: 'Ravi K.' }],
      changed_matches: [{ ...view().knockout[0], side_a: side('ra', 'Ravi K.') }],
      bracket_version: 4,
    });

  it('replaces the saved match, the moved knockout match and the group table, and keeps the rest', () => {
    const before = view();
    const after = applyEntry(before, entry()) as TournamentStandingsView;
    expect(after.groups[0].matches[0].result?.sets).toHaveLength(3);
    expect(after.groups[0].table).toHaveLength(1);
    expect(after.groups[0].provisional).toBe(false);
    expect(after.knockout[0].side_a.name).toBe('Ravi K.');
    expect(after.groups[0].matches).toHaveLength(1);
    expect(entry().bracket_version).toBe(4);
    expect(entry().qualified[0].name).toBe('Ravi K.');
  });

  it('a board not loaded yet stays as it is', () => {
    expect(applyEntry(null, entry())).toBeNull();
  });

  it('"Just set" marks a knockout match that got a name', () => {
    const before = view();
    const after = applyEntry(before, entry());
    expect([...justSetIds(before, after)]).toEqual(['k1']);
    expect(justSetIds(null, after).size).toBe(0);
  });
});

describe('Participants', () => {
  const regs = [
    { id: 'r2', user_id: 'u2', nickname: 'Daniel Soh', registered_at: '2026-10-14T00:00:00Z', status: 'registered' as const },
    { id: 'r1', user_id: 'u1', nickname: 'Ravi K.', registered_at: '2026-10-13T00:00:00Z', status: 'registered' as const },
    { id: 'r3', user_id: 'u3', nickname: 'Gone', registered_at: '2026-10-15T00:00:00Z', status: 'withdrawn' as never },
  ];

  it('lists active registrations oldest first and marks only the people the server named organizer or committee', () => {
    const rows = participantRows(regs);
    expect(rows.map(r => r.name)).toEqual(['Ravi K.', 'Daniel Soh']);
    const tournament = { organizer: { user_id: 'u1', display_name: 'Ravi K.', nickname: null, avatar_url: null }, committee: [{ user_id: 'u2', display_name: 'Daniel Soh', nickname: null, avatar_url: null }] };
    expect(participantRole(rows[0], tournament)).toBe('organizer');
    expect(participantRole(rows[1], tournament)).toBe('committee');
    expect(participantRole({ ...rows[1], user_id: null }, tournament)).toBeNull();
  });
});

describe('Approvals', () => {
  const requests = normaliseApprovals([
    { id: 'a1', action_type: 'result_winner_change', command_payload: { fixture_id: 'f1', reason: 'Wrong way round' }, consequence_description: 'Change fixture 9b1d... in tournament 77aa...', initiator_user_id: 'U-ALICIA', approver_user_id: null, status: 'pending', created_at: '2026-11-14T01:00:00Z', resolved_at: null },
    { id: 'a2', action_type: 'fixture_publication', command_payload: {}, consequence_description: '', initiator_user_id: 'u-me', approver_user_id: null, status: 'pending', created_at: '2026-11-13T01:00:00Z', resolved_at: null },
    { id: 'a3', action_type: 'fixture_publication', command_payload: {}, consequence_description: '', initiator_user_id: 'u-me', approver_user_id: 'u-joyce', status: 'executed', created_at: '2026-11-10T01:00:00Z', resolved_at: '2026-11-11T01:00:00Z' },
    { id: 'a4', action_type: 'committee_membership_change', command_payload: {}, consequence_description: '', initiator_user_id: 'u-me', approver_user_id: null, status: 'pending', created_at: '2026-11-09T01:00:00Z', resolved_at: null },
  ]);
  const names = new Map([['u-alicia', 'Alicia Lim'], ['u-me', 'Ravi K.'], ['u-joyce', 'Joyce Lee']]);
  const cards = approvalCards(requests, {
    viewerId: 'u-me',
    names,
    activeMemberIds: ['u-me', 'u-alicia', 'u-joyce'],
    isActiveMember: true,
    view: view(),
    matchLabel: (a, b) => `${a} against ${b}`,
    groupLabel: g => `Group ${g}`,
  });

  it('puts someone else\'s pending request under "needs", the viewer\'s own under "waiting", decided ones in history', () => {
    expect(cards.map(c => [c.id, c.bucket])).toEqual([['a1', 'needs'], ['a2', 'waiting'], ['a3', 'history']]);
    expect(approvalBucket(requests[0], 'u-me')).toBe('needs');
  });

  it('describes a request with names and never an id; types the page does not describe are left out', () => {
    expect(cards[0].subject).toBe('Ravi K. against Alicia Lim');
    expect(cards[0].initiatorName).toBe('Alicia Lim');
    expect(cards[0].reason).toBe('Wrong way round');
    expect(JSON.stringify(cards.map(c => [c.subject, c.initiatorName, c.approverName, c.waitingFor]))).not.toMatch(/9b1d|77aa|f1\b/);
    expect(cards[1].waitingFor).toBe('Alicia Lim, Joyce Lee');
    expect(cards[2].approverName).toBe('Joyce Lee');
  });

  it('decide and withdraw are UX hints: decide on others\' pending, withdraw on the maker\'s own', () => {
    expect(cards[0]).toMatchObject({ canDecide: true, canWithdraw: false });
    expect(cards[1]).toMatchObject({ canDecide: false, canWithdraw: true });
    expect(cards[2]).toMatchObject({ canDecide: false, canWithdraw: false });
  });
});

describe('Close tournament form (AD-T9)', () => {
  const closure = {
    can_close: true,
    version: 3,
    candidates: [
      { registration_id: 'ra', display_name: 'Ravi K.', user_id: 'u1', members: [{ user_id: 'u1', display_name: 'Ravi K.' }] },
      { registration_id: 'team', display_name: 'Smash Bros', members: [{ user_id: 'u5', display_name: 'Jo' }, { user_id: 'u6', display_name: 'Mel' }] },
      { registration_id: 'rc', display_name: 'Priya Nair', user_id: 'u3', members: [{ user_id: 'u3', display_name: 'Priya Nair' }] },
    ],
    prefill: { winner: { registration_id: 'rc', display_name: 'Priya Nair' }, runner_up: { registration_id: 'ra', display_name: 'Ravi K.' }, attendees: [{ registration_id: 'ra', display_name: 'Ravi K.' }, { registration_id: 'rc', display_name: 'Priya Nair' }, { registration_id: 'team', display_name: 'Smash Bros' }] },
  };

  it('starts from the server prefill while no report is saved', () => {
    const form = closureInit(closure);
    expect(form).toMatchObject({ outcome: 'completed', winner: 'rc', runnerUp: 'ra', third: '', star: '', version: 3 });
    expect(form.attendees).toEqual(['ra', 'rc', 'team']);
  });

  it('builds the body with third place, star and trimmed comments; "not held" carries none of them', () => {
    const form = { ...closureInit(closure), third: 'team', star: 'u5', comments: '  Great weekend  ' };
    expect(closureBody(form)).toMatchObject({
      outcome: 'completed',
      winner_registration_id: 'rc',
      runner_up_registration_id: 'ra',
      third_place_registration_id: 'team',
      star_user_id: 'u5',
      comments: 'Great weekend',
      expected_version: 3,
    });
    expect(closureBody({ ...form, outcome: 'not_held' })).toMatchObject({
      attendee_registration_ids: [],
      winner_registration_id: null,
      third_place_registration_id: null,
      star_user_id: null,
      comments: 'Great weekend',
    });
  });

  it('a team registration offers its players for the star', () => {
    expect(starOptions(closure.candidates, ['ra', 'team'])).toEqual([
      { userId: 'u1', name: 'Ravi K.' },
      { userId: 'u5', name: 'Jo' },
      { userId: 'u6', name: 'Mel' },
    ]);
  });

  it('checks the shape before asking: third differs, the star attended, comments up to 500', () => {
    const form = { ...closureInit(closure), third: 'rc', star: 'u9', comments: 'x'.repeat(501) };
    expect(closureIssues(form, closure.candidates)).toEqual(['comments_too_long', 'third_place_equals_winner', 'star_not_attendee']);
    expect(closureIssues({ ...form, third: 'team', star: 'u6', comments: 'x'.repeat(500) }, closure.candidates)).toEqual([]);
  });

  it('maps a coded refusal to its label', () => {
    expect(closureErrorKey({ response: { data: { code: 'star_not_attendee' } } })).toBe('mob.tournament.closure.err.star_not_attendee');
    expect(closureErrorKey({ response: { data: { detail: 'third_place_not_allowed' } } })).toBe('mob.tournament.closure.err.third_place_not_allowed');
    expect(closureErrorKey({ response: { data: { code: 'other' } } })).toBeNull();
  });
});

describe('Media and standings', () => {
  it('reads the media page defensively and drops items without a url', () => {
    const page = normaliseMediaPage({ items: [{ id: 'm1', kind: 'photo', url: 'https://x/1.jpg', created_at: 'now', uploaded_by: 'Ravi K.', can_remove: true }, { id: 'm2', kind: 'photo', url: '' }], total: 5 });
    expect(page.items.map(i => i.id)).toEqual(['m1']);
    expect(page.total).toBe(5);
    expect(page.items[0].can_remove).toBe(true);
  });

  it('shows the server code text for a refused upload', () => {
    const err = (code: string) => ({ response: { data: { detail: { code, message: 'm' } } } });
    expect(mediaErrorKey(err('MEDIA_LIMIT_REACHED'))).toBe('mob.tournament.media.err.MEDIA_LIMIT_REACHED');
    expect(mediaErrorKey(err('MEDIA_TOO_LARGE'))).toBe('mob.tournament.media.err.MEDIA_TOO_LARGE');
    expect(mediaErrorKey(err('IMAGE_INVALID'))).toBe('mob.tournament.media.err.IMAGE_INVALID');
    expect(mediaErrorKey(err('MEDIA_NOT_ALLOWED'))).toBe('mob.tournament.media.err.MEDIA_NOT_ALLOWED');
    expect(mediaErrorKey(err('SOMETHING'))).toBeNull();
  });

  it('turns the server tie-break codes into words and skips a code it has no words for', () => {
    expect(tiebreakKeys(view({ tiebreakers: ['matches_won', 'head_to_head', 'unknown', 'override'] }))).toEqual([
      'mob.tournament.standings.tb_matches_won',
      'mob.tournament.standings.tb_head_to_head',
      'mob.tournament.standings.tb_override',
    ]);
    expect(tiebreakKeys(null)).toEqual([]);
  });
});
