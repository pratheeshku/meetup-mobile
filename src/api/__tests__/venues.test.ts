import { apiClient } from '../client';
import {
  deleteVenueImage,
  getPostalVenue,
  getVenue,
  getVenues,
  reportVenueImage,
  uploadGameVenueImage,
  uploadTournamentVenueImage,
} from '../venues';
import type { VenueDetail, VenueItem, VenuesListResponse } from '../../types/venue';

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

const sampleVenue: VenueItem = {
  id: 'venue-1',
  provider: 'sportsg',
  provider_venue_key: 'sportsg:579780:bishan',
  name: 'Bishan Sports Hall',
  status: 'active',
};

describe('Venues API Client', () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedPost.mockReset();
    mockedDelete.mockReset();
  });

  describe('getVenues', () => {
    it('calls GET /venues with sport_id, query, and cursor', async () => {
      const mockResponse: VenuesListResponse = {
        items: [sampleVenue],
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

    it('propagates 404 error and does not return mock data', async () => {
      mockedGet.mockRejectedValueOnce({ response: { status: 404 } });
      await expect(getVenues({ sport_id: 'badminton', q: 'bishan' })).rejects.toEqual({
        response: { status: 404 },
      });
    });

    it('propagates network error and does not return mock data', async () => {
      const netError = new Error('Network Error');
      mockedGet.mockRejectedValueOnce(netError);
      await expect(getVenues({ sport_id: 'badminton' })).rejects.toThrow('Network Error');
    });

    it('propagates 5xx server error', async () => {
      mockedGet.mockRejectedValueOnce({ response: { status: 500, data: 'Server Error' } });
      await expect(getVenues({ sport_id: 'badminton' })).rejects.toEqual({
        response: { status: 500, data: 'Server Error' },
      });
    });
  });

  describe('getVenue', () => {
    it('calls GET /venues/{id}', async () => {
      const mockDetail: VenueDetail = {
        venue: sampleVenue,
        images: [],
      };
      mockedGet.mockResolvedValueOnce({ data: mockDetail });

      const res = await getVenue('venue-1', { correlationId: 'cid-v' });
      expect(mockedGet).toHaveBeenCalledWith('/venues/venue-1', {
        correlationId: 'cid-v',
      });
      expect(res).toEqual(mockDetail);
    });

    it('propagates 404 error and does not return mock data', async () => {
      mockedGet.mockRejectedValueOnce({ response: { status: 404 } });
      await expect(getVenue('venue-1')).rejects.toEqual({ response: { status: 404 } });
    });

    it('propagates network error and does not return mock data', async () => {
      mockedGet.mockRejectedValueOnce(new Error('Network offline'));
      await expect(getVenue('venue-1')).rejects.toThrow('Network offline');
    });

    it('propagates 5xx server error', async () => {
      mockedGet.mockRejectedValueOnce({ response: { status: 502 } });
      await expect(getVenue('venue-1')).rejects.toEqual({ response: { status: 502 } });
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

    it('defaults geocoding_status to pending when backend returns only postal_code, address, block, street without geocoding_status', async () => {
      const mockRawBackend = {
        postal_code: '579780',
        block: '5',
        street: 'Bishan Street 14',
        address: '5 Bishan Street 14 Singapore 579780',
      };
      mockedGet.mockResolvedValueOnce({ data: mockRawBackend });

      const res = await getPostalVenue('579780');
      expect(res.geocoding_status).toBe('pending');
      expect(res.name).toBeUndefined();
      expect(res.lat).toBeUndefined();
      expect(res.lng).toBeUndefined();
    });

    it('propagates 404 error and does not return mock data', async () => {
      mockedGet.mockRejectedValueOnce({ response: { status: 404 } });
      await expect(getPostalVenue('579780')).rejects.toEqual({ response: { status: 404 } });
    });

    it('propagates network error and does not return mock data', async () => {
      mockedGet.mockRejectedValueOnce(new Error('Timeout'));
      await expect(getPostalVenue('579780')).rejects.toThrow('Timeout');
    });

    it('propagates 5xx server error', async () => {
      mockedGet.mockRejectedValueOnce({ response: { status: 503 } });
      await expect(getPostalVenue('579780')).rejects.toEqual({ response: { status: 503 } });
    });
  });

  describe('uploadGameVenueImage & uploadTournamentVenueImage', () => {
    it('uploads game venue image via POST /games/{id}/venue-images with ownership_accepted field', async () => {
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
      const passedFormData = mockedPost.mock.calls[0][1] as any;
      if (passedFormData._parts) {
        expect(passedFormData._parts).toContainEqual(['ownership_accepted', 'true']);
        expect(passedFormData._parts.some(([k]: [string]) => k === 'accepted_statement')).toBe(false);
      }
      expect(res.id).toBe('img-1');
    });

    it('fails upload when server returns error (404, 5xx, or network) and does not mock success', async () => {
      mockedPost.mockRejectedValueOnce({ response: { status: 404, data: { message: 'Not found' } } });
      await expect(
        uploadGameVenueImage(
          'game-123',
          { uri: 'file:///path/to/img.jpg', type: 'image/jpeg', name: 'photo.jpg' },
          true,
        ),
      ).rejects.toEqual({ response: { status: 404, data: { message: 'Not found' } } });
    });

    it('uploads tournament venue image via POST /tournaments/{id}/venue-images with ownership_accepted field', async () => {
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
      const passedFormData = mockedPost.mock.calls[0][1] as any;
      if (passedFormData._parts) {
        expect(passedFormData._parts).toContainEqual(['ownership_accepted', 'true']);
        expect(passedFormData._parts.some(([k]: [string]) => k === 'accepted_statement')).toBe(false);
      }
      expect(res.id).toBe('img-tourn-1');
    });

    it('fails tournament upload when server returns error and does not mock success', async () => {
      mockedPost.mockRejectedValueOnce({ response: { status: 500 } });
      await expect(
        uploadTournamentVenueImage(
          'tourn-123',
          { uri: 'file:///path/to/tourn.jpg', type: 'image/jpeg', name: 'tourn.jpg' },
          true,
        ),
      ).rejects.toEqual({ response: { status: 500 } });
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

    it('fails delete on 404 or server failure and throws error', async () => {
      mockedDelete.mockRejectedValueOnce({ response: { status: 404 } });
      await expect(deleteVenueImage('img-999')).rejects.toEqual({ response: { status: 404 } });
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

    it('fails report on server failure and throws error', async () => {
      mockedPost.mockRejectedValueOnce(new Error('Network error'));
      await expect(reportVenueImage('img-999', 'reason')).rejects.toThrow('Network error');
    });
  });
});
