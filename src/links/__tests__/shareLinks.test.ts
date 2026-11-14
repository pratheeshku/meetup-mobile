import { buildShareLink } from '../shareLinks';

const EVENT = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b';
const USER = '9a8b7c6d-1e2f-4a3b-8c4d-5e6f7a8b9c0d';
const BASE = 'https://links.example.test';

describe('buildShareLink (AD-11)', () => {
  it('switch on: the /l/ form', () => {
    const config = { link_base_url: BASE, app_links_enabled: true };
    expect(buildShareLink(config, { kind: 'game', eventId: EVENT }, USER)).toEqual({
      url: `${BASE}/l/game/${EVENT}?ref=${USER}`,
      form: 'path',
    });
    expect(buildShareLink(config, { kind: 'tournament', tournamentId: EVENT }, USER)).toEqual({
      url: `${BASE}/l/tournament/${EVENT}`,
      form: 'path',
    });
  });

  it('switch off or absent: the hash form', () => {
    for (const config of [{ link_base_url: BASE, app_links_enabled: false }, { link_base_url: BASE }]) {
      expect(buildShareLink(config, { kind: 'game', eventId: EVENT }, USER)).toEqual({
        url: `${BASE}/#event-detail/${EVENT}?ref=${USER}`,
        form: 'hash',
      });
      expect(buildShareLink(config, { kind: 'tournament', tournamentId: EVENT }, USER)).toEqual({
        url: `${BASE}/#tournament-detail/${EVENT}`,
        form: 'hash',
      });
    }
  });

  it('a trailing slash on the base is dropped; ref is left out when the sharer is unknown', () => {
    expect(buildShareLink({ link_base_url: `${BASE}/`, app_links_enabled: true }, { kind: 'game', eventId: EVENT }, '')?.url).toBe(
      `${BASE}/l/game/${EVENT}`,
    );
  });

  it.each([
    ['missing', undefined],
    ['null', null],
    ['empty', ''],
    ['http', 'http://links.example.test'],
    ['carries a path', 'https://links.example.test/app'],
    ['not a URL', 'links.example.test'],
    ['has userinfo', 'https://user@links.example.test'],
  ])('no link (message only) when the base is %s', (_name, base) => {
    expect(buildShareLink({ link_base_url: base as string | null | undefined, app_links_enabled: true }, { kind: 'game', eventId: EVENT }, USER)).toBeNull();
  });

  it('no config at all: no link', () => {
    expect(buildShareLink(null, { kind: 'tournament', tournamentId: EVENT })).toBeNull();
  });
});
