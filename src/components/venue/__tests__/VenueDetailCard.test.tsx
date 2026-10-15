import React from 'react';
import { Linking } from 'react-native';

import VenueDetailCard from '../VenueDetailCard';
import * as venuesApi from '../../../api/venues';
import type { VenueImage, VenueSnapshot } from '../../../types/venue';
import {
  act,
  pressableLabelled,
  pressables,
  renderAsync,
  texts,
} from '../../../test-utils/render';

jest.mock('../../../api/venues');

const mockGetVenue = venuesApi.getVenue as jest.MockedFunction<typeof venuesApi.getVenue>;
const mockUploadGameVenueImage = venuesApi.uploadGameVenueImage as jest.MockedFunction<
  typeof venuesApi.uploadGameVenueImage
>;
const mockUploadTournamentVenueImage = venuesApi.uploadTournamentVenueImage as jest.MockedFunction<
  typeof venuesApi.uploadTournamentVenueImage
>;
const mockDeleteVenueImage = venuesApi.deleteVenueImage as jest.MockedFunction<
  typeof venuesApi.deleteVenueImage
>;
const mockReportVenueImage = venuesApi.reportVenueImage as jest.MockedFunction<
  typeof venuesApi.reportVenueImage
>;

const sampleSnapshot: VenueSnapshot = {
  name: 'Bishan Sports Hall',
  block: '5',
  street: 'Bishan Street 14',
  postal_code: '579780',
  lat: 1.3548,
  lng: 103.8504,
  source: 'catalogue',
  operating_hours: 'Daily 07:00 - 22:00',
  info_url: 'https://www.myactivesg.com/facilities/bishan-sports-hall',
  address: '5 Bishan Street 14',
};

const sampleImages: VenueImage[] = [
  {
    id: 'img-1',
    venue_id: 'venue-1',
    url: 'https://example.com/photos/bishan-1.jpg',
    content_type: 'image/jpeg',
    bytes: 1024,
    sha256: 'sha256-hash',
    status: 'active',
    created_at: '2026-10-15T00:00:00Z',
  },
  {
    id: 'img-2',
    venue_id: 'venue-1',
    url: 'https://example.com/photos/bishan-2.jpg',
    content_type: 'image/png',
    bytes: 2048,
    sha256: 'sha256-hash-2',
    status: 'active',
    created_at: '2026-10-15T01:00:00Z',
  },
];

describe('VenueDetailCard (vc-m-detail & vc-m-photos)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVenue.mockResolvedValue({
      venue: {
        id: 'venue-1',
        provider: 'activesg',
        provider_venue_key: 'key-1',
        name: 'Bishan Sports Hall',
        status: 'active',
      },
      images: sampleImages,
    });
  });

  describe('vc-m-detail: Venue snapshot rendering and legacy fallback', () => {
    it('renders snapshot name, address, "Listed hours", info link and fixed pin caption', async () => {
      const root = await renderAsync(
        <VenueDetailCard
          snapshot={sampleSnapshot}
          courtDetails="Court 3"
          venueId="venue-1"
        />,
      );

      const allTexts = texts(root);
      expect(allTexts).toContain('Bishan Sports Hall, Court 3');
      expect(allTexts).toContain('5 Bishan Street 14');
      expect(allTexts.some(t => t.includes('Listed hours: Daily 07:00 - 22:00'))).toBe(true);
      expect(allTexts).toContain('More information');
      expect(allTexts).toContain('Pin set from the venue address');
    });

    it('falls back to fallbackText when snapshot is missing or empty', async () => {
      const root = await renderAsync(
        <VenueDetailCard
          snapshot={null}
          fallbackText="Old Custom Sports Hall"
        />,
      );

      const allTexts = texts(root);
      expect(allTexts).toContain('Old Custom Sports Hall');
      // No pin caption when no coordinates
      expect(allTexts).not.toContain('Pin set from the venue address');
    });

    it('loads fresh signed photos on mount via venueId without caching and displays photo strip', async () => {
      const root = await renderAsync(
        <VenueDetailCard
          snapshot={sampleSnapshot}
          venueId="venue-1"
        />,
      );

      expect(mockGetVenue).toHaveBeenCalledWith('venue-1');
      const allTexts = texts(root);
      expect(allTexts).toContain('Venue photos');
      expect(allTexts).toContain('5 Bishan Street 14');

      // Check photo strip buttons exist for each image
      const photoButtons = pressables(root).filter(
        node => node.props.accessibilityLabel === 'View venue photo',
      );
      expect(photoButtons.length).toBe(2);
    });

    it('handles clicking information link via Linking.openURL', async () => {
      const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any);

      const root = await renderAsync(
        <VenueDetailCard
          snapshot={sampleSnapshot}
          venueId="venue-1"
        />,
      );

      const infoLink = root.find(
        node => node.props.accessibilityRole === 'link',
      );
      expect(infoLink).toBeTruthy();

      await act(async () => {
        infoLink.props.onPress();
      });

      expect(openSpy).toHaveBeenCalledWith('https://www.myactivesg.com/facilities/bishan-sports-hall');
      openSpy.mockRestore();
    });
  });

  describe('vc-m-photos: Organizer upload, delete, and neutral viewer report', () => {
    it('shows "Add venue photos" button for organizers only', async () => {
      const memberRoot = await renderAsync(
        <VenueDetailCard
          snapshot={sampleSnapshot}
          venueId="venue-1"
          isOrganiser={false}
        />,
      );
      expect(texts(memberRoot)).not.toContain('Add venue photos');

      const orgRoot = await renderAsync(
        <VenueDetailCard
          snapshot={sampleSnapshot}
          venueId="venue-1"
          isOrganiser={true}
        />,
      );
      expect(texts(orgRoot)).toContain('Add venue photos');
    });

    it('allows viewer to open photo modal and report with neutral confirmation message without identity', async () => {
      mockReportVenueImage.mockResolvedValue();

      const root = await renderAsync(
        <VenueDetailCard
          snapshot={sampleSnapshot}
          venueId="venue-1"
          isOrganiser={false}
        />,
      );

      const photoButtons = root.findAll(
        node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === 'View venue photo',
      );
      expect(photoButtons.length).toBeGreaterThan(0);

      // Open first photo
      await act(async () => {
        photoButtons[0].props.onPress();
      });

      // Report button should be present
      const reportBtn = pressableLabelled(root, 'Report photo');
      expect(reportBtn).toBeTruthy();

      // Submit report
      await act(async () => {
        reportBtn.props.onPress();
      });

      expect(mockReportVenueImage).toHaveBeenCalledWith('img-1', 'Reported by user');
      const updatedTexts = texts(root);
      expect(
        updatedTexts.some(t => t.includes('Photo reported. Our moderation team will review it.')),
      ).toBe(true);
    });

    it('allows organizer to delete a photo', async () => {
      mockDeleteVenueImage.mockResolvedValue();

      const root = await renderAsync(
        <VenueDetailCard
          snapshot={sampleSnapshot}
          venueId="venue-1"
          isOrganiser={true}
        />,
      );

      const photoButtons = root.findAll(
        node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === 'View venue photo',
      );

      // Open first photo
      await act(async () => {
        photoButtons[0].props.onPress();
      });

      const deleteBtn = pressableLabelled(root, 'Delete photo');
      expect(deleteBtn).toBeTruthy();

      await act(async () => {
        deleteBtn.props.onPress();
      });

      expect(mockDeleteVenueImage).toHaveBeenCalledWith('img-1');
    });

    it('requires ownership statement checkbox before uploading a photo', async () => {
      const root = await renderAsync(
        <VenueDetailCard
          snapshot={sampleSnapshot}
          venueId="venue-1"
          eventId="event-123"
          isOrganiser={true}
        />,
      );

      const addBtn = pressableLabelled(root, 'Add venue photos');
      await act(async () => {
        addBtn.props.onPress();
      });

      expect(texts(root)).toContain('Add Venue Photo');
      expect(texts(root)).toContain('I confirm that I own or have permission to upload this photo.');

      const checkbox = root.find(node => node.props.accessibilityRole === 'checkbox');
      expect(checkbox.props.accessibilityState.checked).toBe(false);

      const uploadBtn = pressableLabelled(root, 'Confirm upload');
      expect(uploadBtn.props.disabled).toBe(true);

      // Check the statement
      await act(async () => {
        checkbox.props.onPress();
      });

      expect(checkbox.props.accessibilityState.checked).toBe(true);
      expect(uploadBtn.props.disabled).toBe(false);
    });

    it('successfully uploads photo for game when accepted statement is checked', async () => {
      const uploadedImage: VenueImage = {
        id: 'img-new',
        venue_id: 'venue-1',
        game_id: 'event-123',
        url: 'https://example.com/new-photo.jpg',
        content_type: 'image/jpeg',
        bytes: 5000,
        sha256: 'sha-new',
        status: 'active',
        created_at: '2026-10-15T02:00:00Z',
      };
      mockUploadGameVenueImage.mockResolvedValue(uploadedImage);

      const root = await renderAsync(
        <VenueDetailCard
          snapshot={sampleSnapshot}
          venueId="venue-1"
          eventId="event-123"
          isOrganiser={true}
        />,
      );

      // Open modal
      const addBtn = pressableLabelled(root, 'Add venue photos');
      await act(async () => {
        addBtn.props.onPress();
      });

      // Enter URL
      const textInput = root.find(node => (node.type as any) === 'TextInput');
      await act(async () => {
        textInput.props.onChangeText('https://example.com/new-photo.jpg');
      });

      // Check ownership
      const checkbox = root.find(node => node.props.accessibilityRole === 'checkbox');
      await act(async () => {
        checkbox.props.onPress();
      });

      // Click upload
      const uploadBtn = pressableLabelled(root, 'Confirm upload');
      await act(async () => {
        await uploadBtn.props.onPress();
      });

      expect(mockUploadGameVenueImage).toHaveBeenCalledWith(
        'event-123',
        expect.objectContaining({
          uri: 'https://example.com/new-photo.jpg',
          type: 'image/jpeg',
        }),
        true,
      );
    });

    it('successfully uploads photo for tournament', async () => {
      const uploadedImage: VenueImage = {
        id: 'img-tourn',
        venue_id: 'venue-1',
        tournament_id: 'tourn-456',
        url: 'https://example.com/tourn-photo.jpg',
        content_type: 'image/jpeg',
        bytes: 5000,
        sha256: 'sha-tourn',
        status: 'active',
        created_at: '2026-10-15T02:00:00Z',
      };
      mockUploadTournamentVenueImage.mockResolvedValue(uploadedImage);

      const root = await renderAsync(
        <VenueDetailCard
          snapshot={sampleSnapshot}
          venueId="venue-1"
          tournamentId="tourn-456"
          isOrganiser={true}
        />,
      );

      const addBtn = pressableLabelled(root, 'Add venue photos');
      await act(async () => {
        addBtn.props.onPress();
      });

      const textInput = root.find(node => (node.type as any) === 'TextInput');
      await act(async () => {
        textInput.props.onChangeText('https://example.com/tourn-photo.jpg');
      });

      const checkbox = root.find(node => node.props.accessibilityRole === 'checkbox');
      await act(async () => {
        checkbox.props.onPress();
      });

      const uploadBtn = pressableLabelled(root, 'Confirm upload');
      await act(async () => {
        await uploadBtn.props.onPress();
      });

      expect(mockUploadTournamentVenueImage).toHaveBeenCalledWith(
        'tourn-456',
        expect.objectContaining({
          uri: 'https://example.com/tourn-photo.jpg',
          type: 'image/jpeg',
        }),
        true,
      );
    });
  });
});
