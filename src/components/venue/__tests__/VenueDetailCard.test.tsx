import React from 'react';
import { Linking } from 'react-native';

import VenueDetailCard, { VENUE_ORGANIZER_PHOTOS_ENABLED } from '../VenueDetailCard';
import * as venuesApi from '../../../api/venues';
import type { VenueImage, VenueSnapshot } from '../../../types/venue';
import {
  act,
  pressables,
  renderAsync,
  texts,
} from '../../../test-utils/render';

jest.mock('../../../api/venues');

const mockGetVenue = venuesApi.getVenue as jest.MockedFunction<typeof venuesApi.getVenue>;

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

  describe('vc-m-photos: Feature gating behind VENUE_ORGANIZER_PHOTOS_ENABLED = false', () => {
    it('confirms VENUE_ORGANIZER_PHOTOS_ENABLED constant is false by default', () => {
      expect(VENUE_ORGANIZER_PHOTOS_ENABLED).toBe(false);
    });

    it('hides "Add venue photos" button even for organizers when photo feature is disabled', async () => {
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
      expect(texts(orgRoot)).not.toContain('Add venue photos');
    });

    it('keeps shared admin photos visible but hides report and delete buttons in viewer modal', async () => {
      const root = await renderAsync(
        <VenueDetailCard
          snapshot={sampleSnapshot}
          venueId="venue-1"
          isOrganiser={true}
        />,
      );

      // Shared admin photos are visible in the photo strip
      const photoButtons = pressables(root).filter(
        node => node.props.accessibilityLabel === 'View venue photo',
      );
      expect(photoButtons.length).toBe(2);

      // Open first photo
      await act(async () => {
        photoButtons[0].props.onPress();
      });

      // Report and Delete buttons must NOT be present
      const reportBtnMatches = root.findAll(
        node => node.props.accessibilityLabel === 'Report photo',
      );
      expect(reportBtnMatches).toHaveLength(0);

      const deleteBtnMatches = root.findAll(
        node => node.props.accessibilityLabel === 'Delete photo',
      );
      expect(deleteBtnMatches).toHaveLength(0);
    });

    it('keeps upload modal hidden when feature is disabled', async () => {
      const root = await renderAsync(
        <VenueDetailCard
          snapshot={sampleSnapshot}
          venueId="venue-1"
          eventId="event-123"
          isOrganiser={true}
        />,
      );

      expect(texts(root)).not.toContain('Add Venue Photo');
      expect(texts(root)).not.toContain('I confirm that I own or have permission to upload this photo.');
    });
  });
});
