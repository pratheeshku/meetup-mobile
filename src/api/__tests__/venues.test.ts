import { apiClient } from '../client';
import {
  deleteVenueImage,
  getPostalVenue,
  getVenue,
  getVenues,
  MOCK_VENUES,
  reportVenueImage,
  uploadGameVenueImage,
  uploadTournamentVenueImage,
} from '../venues';

jest.mock('../client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockedGet = apiClient.get as jest.Mock;
const mockedPost = apiClient.post as jest.Mock;
const mockedDelete = apiClient.delete as jest.Mock;

describe('Venues API Client', () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedPost.mockReset();
    mockedDelete.mockReset();
  });

  describe('getVenues', () => {
    it('calls GET /venues with sport_id, query, and cursor', async () => {
      const mockResponse = {
        items: [MOCK_VENUES[0]],
        next_cursor: 'cursor-2',
      };
      mockedGet.mockResolvedValueOnce({ data: mockResponse });

      const res = await getVenues(
        { sport_id: 'badminton', q: 'bishan', cursor: 'cur-1' },
        { correlationId: 'cid-1' },
      );

      expect(mockedGet).toHaveBeenCalledWith('/venues', {
        params: {
          sport_id: 'badminton',
          q: 'bishan',
          cursor: 'cur-1',
        },
        correlationId: 'cid-1',
      });
      expect(res).toEqual(mockResponse);
    });

    it('falls back to typed mock venues on 404 without crashing', async () => {
      mockedGet.mockRejectedValueOnce({ response: { status: 404 } });

      const res = await getVenues({ sport_id: 'badminton', q: 'bishan' });
      expect(res.items.length).toBeGreaterThan(0);
      expect(res.items[0].name).toContain('Bishan');
    });
  });

  describe('getVenue', () => {
    it('calls GET /venues/{id}', async () => {
      const mockDetail = {
        venue: MOCK_VENUES[0],
        images: [],
      };
      mockedGet.mockResolvedValueOnce({ data: mockDetail });

      const res = await getVenue('venue-1', { correlationId: 'cid-v' });
      expect(mockedGet).toHaveBeenCalledWith('/venues/venue-1', {
        correlationId: 'cid-v',
      });
      expect(res).toEqual(mockDetail);
    });

    it('falls back to mock venue on 404', async () => {
      mockedGet.mockRejectedValueOnce({ response: { status: 404 } });

      const res = await getVenue(MOCK_VENUES[0].id);
      expect(res.venue.id).toBe(MOCK_VENUES[0].id);
    });
  });

  describe('getPostalVenue', () => {
    it('calls GET /venues/postal/{code}', async () => {
      const mockPostal = {
        postal_code: '579780',
        name: 'Bishan Sports Hall',
        address: '5 Bishan Street 14 Singapore 579780',
        lat: 1.3548,
        lng: 103.8504,
        geocoding_status: 'resolved' as const,
      };
      mockedGet.mockResolvedValueOnce({ data: mockPostal });

      const res = await getPostalVenue('579780', { correlationId: 'cid-post' });
      expect(mockedGet).toHaveBeenCalledWith('/venues/postal/579780', {
        correlationId: 'cid-post',
      });
      expect(res).toEqual(mockPostal);
    });

    it('falls back to mock postal resolution on 404 for valid 6-digit code', async () => {
      mockedGet.mockRejectedValueOnce({ response: { status: 404 } });

      const res = await getPostalVenue('579780');
      expect(res.postal_code).toBe('579780');
      expect(res.geocoding_status).toBe('resolved');
      expect(res.lat).toBeDefined();
    });
  });

  describe('uploadGameVenueImage & uploadTournamentVenueImage', () => {
    it('uploads game venue image via POST /games/{id}/venue-images', async () => {
      mockedPost.mockResolvedValueOnce({
        data: {
          id: 'img-1',
          url: 'https://example.com/photo.jpg',
          status: 'active',
        },
      });

      const res = await uploadGameVenueImage(
        'game-123',
        { uri: 'file:///path/to/img.jpg', type: 'image/jpeg', name: 'photo.jpg' },
        true,
        { correlationId: 'cid-up' },
      );

      expect(mockedPost).toHaveBeenCalledWith(
        '/games/game-123/venue-images',
        expect.any(FormData),
        expect.objectContaining({
          headers: { 'Content-Type': 'multipart/form-data' },
          correlationId: 'cid-up',
        }),
      );
      expect(res.id).toBe('img-1');
    });

    it('uploads tournament venue image via POST /tournaments/{id}/venue-images', async () => {
      mockedPost.mockResolvedValueOnce({
        data: {
          id: 'img-tourn-1',
          url: 'https://example.com/tourn.jpg',
          status: 'active',
        },
      });

      const res = await uploadTournamentVenueImage(
        'tourn-123',
        { uri: 'file:///path/to/tourn.jpg', type: 'image/jpeg', name: 'tourn.jpg' },
        true,
      );

      expect(mockedPost).toHaveBeenCalledWith(
        '/tournaments/tourn-123/venue-images',
        expect.any(FormData),
        expect.objectContaining({
          headers: { 'Content-Type': 'multipart/form-data' },
        }),
      );
      expect(res.id).toBe('img-tourn-1');
    });
  });

  describe('deleteVenueImage & reportVenueImage', () => {
    it('deletes venue image via DELETE /venue-images/{id}', async () => {
      mockedDelete.mockResolvedValueOnce({ status: 204 });

      await deleteVenueImage('img-999', { correlationId: 'cid-del' });
      expect(mockedDelete).toHaveBeenCalledWith('/venue-images/img-999', {
        correlationId: 'cid-del',
      });
    });

    it('reports venue image via POST /venue-images/{id}/report', async () => {
      mockedPost.mockResolvedValueOnce({ status: 200 });

      await reportVenueImage('img-999', 'Inappropriate picture', {
        correlationId: 'cid-rep',
      });
      expect(mockedPost).toHaveBeenCalledWith(
        '/venue-images/img-999/report',
        { reason: 'Inappropriate picture' },
        { correlationId: 'cid-rep' },
      );
    });
  });
});
