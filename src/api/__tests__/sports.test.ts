/** `GET /admin/sports/public`, fixture shaped like the live `SportResponse`. */
import { apiClient } from '../client';
import { getSports } from '../sports';

jest.mock('../client', () => ({ apiClient: { get: jest.fn() } }));

const mockedGet = apiClient.get as jest.Mock;

afterEach(() => {
  mockedGet.mockReset();
});

describe('getSports', () => {
  it('calls the public sports endpoint and returns only active sports as name/display_name', async () => {
    mockedGet.mockResolvedValueOnce({
      data: [
        { id: '1', name: 'badminton', slug: 'badminton', display_name: 'Badminton', is_active: true },
        { id: '2', name: 'rugby', slug: 'rugby', display_name: 'Rugby', is_active: false },
        { id: '3', name: 'tennis', slug: 'tennis', display_name: 'Tennis', is_active: true },
      ],
    });

    const sports = await getSports({ correlationId: 'cid' });

    expect(mockedGet).toHaveBeenCalledWith('/admin/sports/public', { correlationId: 'cid' });
    expect(sports).toEqual([
      { name: 'badminton', display_name: 'Badminton' },
      { name: 'tennis', display_name: 'Tennis' },
    ]);
  });
});
