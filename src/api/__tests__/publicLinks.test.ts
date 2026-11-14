import { apiClient } from '../client';
import { getPublicEventPreview, getPublicGroupInvitation } from '../publicLinks';

jest.mock('../client', () => ({ apiClient: { get: jest.fn() } }));

const ID = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b';
const REF = '9a8b7c6d-1e2f-4a3b-8c4d-5e6f7a8b9c0d';

beforeEach(() => jest.clearAllMocks());

describe('getPublicEventPreview', () => {
  it('GETs /public/events/{id} with the optional ref and returns exactly the 7 fields', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: {
        sport: 'badminton',
        starts_at: '2026-12-01T10:00:00Z',
        ends_at: null,
        venue_name: 'Hall',
        capacity: 8,
        organizer_display_name: 'Asha',
        going_count: 3,
        participants: [{ id: 'leak' }],
      },
    });
    const preview = await getPublicEventPreview(ID, REF);
    expect(apiClient.get).toHaveBeenCalledWith(`/public/events/${ID}`, { params: { ref: REF } });
    expect(Object.keys(preview).sort()).toEqual(
      ['capacity', 'ends_at', 'going_count', 'organizer_display_name', 'sport', 'starts_at', 'venue_name'],
    );
    expect(preview.ends_at).toBeNull();
  });

  it('sends no query when there is no ref, and tolerates missing fields', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ data: {} });
    const preview = await getPublicEventPreview(ID);
    expect(apiClient.get).toHaveBeenCalledWith(`/public/events/${ID}`, undefined);
    expect(preview.capacity).toBeNull();
  });
});

describe('getPublicGroupInvitation', () => {
  it('GETs /public/groups/invitations/{token} and returns group_name only', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ data: { group_name: 'Sunday Smashers', extra: 1 } });
    await expect(getPublicGroupInvitation(ID)).resolves.toEqual({ group_name: 'Sunday Smashers' });
    expect(apiClient.get).toHaveBeenCalledWith(`/public/groups/invitations/${ID}`);
  });
});
