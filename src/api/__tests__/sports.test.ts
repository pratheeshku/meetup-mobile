/** `GET /admin/sports/public`, fixture shaped like the live `SportResponse`. */
import { apiClient } from '../client';
import { getSports } from '../sports';

jest.mock('../client', () => ({ apiClient: { get: jest.fn() } }));

const mockedGet = apiClient.get as jest.Mock;

afterEach(() => {
  mockedGet.mockReset();
});

describe('getSports', () => {
  it('returns only active sports in API order, including icon_key and color when sent', async () => {
    mockedGet.mockResolvedValueOnce({
      data: [
        {
          id: '1',
          name: 'badminton',
          slug: 'badminton',
          display_name: 'Badminton',
          is_active: true,
          icon_key: 'badminton',
          color: '#2A7B72',
        },
        { id: '2', name: 'rugby', slug: 'rugby', display_name: 'Rugby', is_active: false },
        {
          id: '3',
          name: 'football',
          slug: 'football',
          display_name: 'Football',
          is_active: true,
          icon_key: '  ',
          color: '',
        },
        { id: '4', name: 'tennis', slug: 'tennis', display_name: 'Tennis', is_active: true },
      ],
    });

    const sports = await getSports({ correlationId: 'cid' });

    expect(mockedGet).toHaveBeenCalledWith('/admin/sports/public', { correlationId: 'cid' });
    expect(sports.map(sport => sport.name)).toEqual(['badminton', 'football', 'tennis']);
    expect(sports[0]).toEqual({
      id: '1',
      name: 'badminton',
      display_name: 'Badminton',
      slug: 'badminton',
      icon_key: 'badminton',
      color: '#2A7B72',
    });
    expect(sports[1].icon_key).toBeNull();
    expect(sports[1].color).toBeNull();
    expect(sports[2].icon_key).toBeNull();
    expect(sports[2].color).toBeNull();
  });
});
