import { parseLinkPath, parseLinkUrl } from '../parseLink';

const ID = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b';
const OTHER = '9a8b7c6d-1e2f-4a3b-8c4d-5e6f7a8b9c0d';
const RESET = 'Zk3-_abcdefghijklmnopqrstuvwxyz0123456789ABCDE';
const HOST = 'meetupaws.duckdns.org';

describe('parseLinkPath (AD-2 grammar)', () => {
  it('password reset: token from the fragment', () => {
    expect(parseLinkPath(`/l/reset#token=${RESET}`)).toEqual({ kind: 'reset', token: RESET });
  });

  it('game: id in the path, ref in the query, invite in the fragment', () => {
    expect(parseLinkPath(`/l/game/${ID}?ref=${OTHER}#invite=${OTHER}`)).toEqual({
      kind: 'game',
      eventId: ID,
      ref: OTHER,
      invite: OTHER,
    });
    expect(parseLinkPath(`/l/game/${ID}`)).toEqual({ kind: 'game', eventId: ID, ref: undefined, invite: undefined });
  });

  it('game: an invalid optional ref or invite is dropped, the link still opens', () => {
    expect(parseLinkPath(`/l/game/${ID}?ref=nope#invite=%00`)).toEqual({
      kind: 'game',
      eventId: ID,
      ref: undefined,
      invite: undefined,
    });
  });

  it('tournament: id in the path, invite in the fragment', () => {
    expect(parseLinkPath(`/l/tournament/${ID}#invite=${OTHER}`)).toEqual({
      kind: 'tournament',
      tournamentId: ID,
      invite: OTHER,
    });
    expect(parseLinkPath(`/l/tournament/${ID}/`)).toEqual({ kind: 'tournament', tournamentId: ID, invite: undefined });
  });

  it('group invitation: token (a UUID) from the fragment', () => {
    expect(parseLinkPath(`/l/group-invite#token=${ID}`)).toEqual({ kind: 'group_invite', token: ID });
  });

  it('normalises ids to lower case', () => {
    expect(parseLinkPath(`/l/game/${ID.toUpperCase()}`)).toMatchObject({ kind: 'game', eventId: ID });
  });

  it.each([
    ['empty', ''],
    ['no leading slash', `l/game/${ID}`],
    ['not under /l/', `/game/${ID}`],
    ['/l/ only', '/l/'],
    ['unknown kind', `/l/profile/${ID}`],
    ['game without id', '/l/game'],
    ['game with a non-UUID id', '/l/game/12345'],
    ['game with a path-traversal id', '/l/game/..%2F..%2Fetc'],
    ['game with extra segment', `/l/game/${ID}/extra`],
    ['tournament with a non-UUID id', '/l/tournament/abc'],
    ['reset without token', '/l/reset'],
    ['reset token in the query instead of the fragment', `/l/reset?token=${RESET}`],
    ['reset token too short', '/l/reset#token=abc'],
    ['reset token with illegal characters', '/l/reset#token=aaaaaaaaaaaaaaaaaaaaaaaa<script>'],
    ['group token not a UUID', '/l/group-invite#token=not-a-uuid'],
    ['group token in the query', `/l/group-invite?token=${ID}`],
  ])('malformed: %s', (_name, path) => {
    expect(parseLinkPath(path)).toEqual({ kind: 'malformed' });
  });

  it('a broken percent escape in an OPTIONAL field only drops that field', () => {
    expect(parseLinkPath(`/l/game/${ID}?ref=%E0%A4%A#invite=%`)).toEqual({
      kind: 'game',
      eventId: ID,
      ref: undefined,
      invite: undefined,
    });
  });
});

describe('parseLinkUrl (host check)', () => {
  it('accepts https and the exact host', () => {
    expect(parseLinkUrl(`https://${HOST}/l/game/${ID}`, HOST)).toMatchObject({ kind: 'game' });
    expect(parseLinkUrl(`HTTPS://${HOST.toUpperCase()}/l/game/${ID}`, HOST)).toMatchObject({ kind: 'game' });
  });

  it.each([
    ['http', `http://${HOST}/l/game/${ID}`],
    ['another host', `https://example.org/l/game/${ID}`],
    ['the staging host in a production build', `https://meetupstg.duckdns.org/l/game/${ID}`],
    ['a host that only starts with ours', `https://${HOST}.evil.example/l/game/${ID}`],
    ['userinfo trick', `https://${HOST}@evil.example/l/game/${ID}`],
    ['a custom scheme', `gameonsg://l/game/${ID}`],
  ])('malformed: %s', (_name, url) => {
    expect(parseLinkUrl(url, HOST)).toEqual({ kind: 'malformed' });
  });
});
