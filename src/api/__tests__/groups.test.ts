/**
 * Regression tests for the full-contract-audit fixes to `api/groups.ts`
 * (docs/reports/AUDIT-API-CONTRACTS-2026-09-18.md), using fixtures built
 * from the real backend's confirmed OpenAPI schemas
 * (`GroupResponse`, `GroupMembershipResponse`).
 */
import { apiClient } from '../client';
import { createGroup, getGroup, getMyGroups, updateMemberRole } from '../groups';

jest.mock('../client', () => ({
  apiClient: { get: jest.fn(), patch: jest.fn(), post: jest.fn() },
}));

const mockedGet = apiClient.get as jest.Mock;
const mockedPatch = apiClient.patch as jest.Mock;
const mockedPost = apiClient.post as jest.Mock;

describe('getMyGroups', () => {
  afterEach(() => {
    mockedGet.mockReset();
  });

  it('maps GroupResponse items from both settings endpoints and infers current_user_role from source list', async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === '/settings/groups-owned') {
        return Promise.resolve({
          data: [
            {
              id: 'g-owned',
              name: 'My Owned Group',
              description: 'desc',
              owner_id: 'u-1',
              members_can_invite: true,
              created_at: '2026-01-01T00:00:00Z',
            },
          ],
        });
      }
      if (url === '/settings/groups-member') {
        return Promise.resolve({
          data: [
            {
              id: 'g-member',
              name: 'A Group I Joined',
              description: null,
              owner_id: 'u-2',
              members_can_invite: false,
              created_at: '2026-01-02T00:00:00Z',
            },
          ],
        });
      }
      throw new Error(`unexpected url ${url}`);
    });

    const result = await getMyGroups();

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({ id: 'g-owned', current_user_role: 'owner' });
    expect(result.items[1]).toMatchObject({
      id: 'g-member',
      current_user_role: 'member',
      description: '',
    });
    // Real GroupResponse has no member_count/owner_nickname — must not
    // be fabricated for list items (flagged as a gap, not guessed).
    expect(result.items[0].member_count).toBeUndefined();
    expect(result.items[0].owner_nickname).toBeUndefined();
  });
});

describe('getGroup', () => {
  afterEach(() => {
    mockedGet.mockReset();
  });

  it('derives owner_nickname and member_count from the real /members endpoint', async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === '/groups/g-1') {
        return Promise.resolve({
          data: {
            id: 'g-1',
            name: 'Group One',
            description: 'desc',
            owner_id: 'u-owner',
            members_can_invite: true,
            created_at: '2026-01-01T00:00:00Z',
          },
        });
      }
      if (url === '/groups/g-1/members') {
        return Promise.resolve({
          data: [
            {
              id: 'm-1',
              group_id: 'g-1',
              user_id: 'u-owner',
              role: 'owner',
              joined_at: '2026-01-01T00:00:00Z',
              user_display_name: 'Owner Display',
              user_nickname: 'ownernick',
            },
            {
              id: 'm-2',
              group_id: 'g-1',
              user_id: 'u-member',
              role: 'member',
              joined_at: '2026-01-03T00:00:00Z',
              user_display_name: null,
              user_nickname: 'membernick',
            },
          ],
        });
      }
      throw new Error(`unexpected url ${url}`);
    });

    const result = await getGroup('g-1');

    expect(result.owner_nickname).toBe('ownernick');
    expect(result.member_count).toBe(2);
    expect(result.members).toHaveLength(2);
    // current_user_role cannot be known here (no access to the signed-in
    // user's id) — must be the inert placeholder, not a guess.
    expect(result.current_user_role).toBe('none');
  });
});

describe('updateMemberRole', () => {
  afterEach(() => {
    mockedPatch.mockReset();
  });

  it('calls the real path with no /role suffix', async () => {
    mockedPatch.mockResolvedValueOnce({ data: {} });

    await updateMemberRole('g-1', 'u-1', 'admin');

    expect(mockedPatch).toHaveBeenCalledWith(
      '/groups/g-1/members/u-1',
      { role: 'admin' },
      expect.anything(),
    );
  });
});

describe('createGroup', () => {
  const created = {
    id: 'g-new',
    name: 'Sunday Footballers',
    description: null,
    owner_id: 'u-1',
    members_can_invite: true,
    created_at: '2026-09-19T00:00:00Z',
  };

  afterEach(() => {
    mockedPost.mockReset();
  });

  it('POSTs exactly the GroupCreate body (name only when description is empty) and threads the correlation id', async () => {
    mockedPost.mockResolvedValueOnce({ data: created });

    await createGroup({ name: 'Sunday Footballers', description: '' }, { correlationId: 'cid-1' });

    expect(mockedPost).toHaveBeenCalledTimes(1);
    expect(mockedPost).toHaveBeenCalledWith(
      '/groups',
      { name: 'Sunday Footballers' },
      { correlationId: 'cid-1' },
    );
  });

  it('includes description when given, and never sends members_can_invite (not in GroupCreate)', async () => {
    mockedPost.mockResolvedValueOnce({ data: created });

    await createGroup({ name: 'G', description: 'Weekly kickabout' });

    const body = mockedPost.mock.calls[0][1];
    expect(body).toEqual({ name: 'G', description: 'Weekly kickabout' });
    expect(body).not.toHaveProperty('members_can_invite');
  });

  it('maps the GroupResponse to a Group owned by the caller', async () => {
    mockedPost.mockResolvedValueOnce({ data: created });

    const group = await createGroup({ name: 'Sunday Footballers' });

    expect(group).toMatchObject({
      id: 'g-new',
      name: 'Sunday Footballers',
      description: '',
      owner_id: 'u-1',
      current_user_role: 'owner',
    });
  });

  it('propagates a failed request to the caller', async () => {
    mockedPost.mockRejectedValueOnce(new Error('boom'));
    await expect(createGroup({ name: 'G' })).rejects.toThrow('boom');
  });
});
