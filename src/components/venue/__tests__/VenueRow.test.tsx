/** GV-2 / T6: the venue row opens the venue sheet; Open in Google Maps and Copy address (AD-5). */
import React from 'react';
import { Clipboard, Linking } from 'react-native';

import { act, pressableLabelled, render, texts } from '../../../test-utils/render';
import type { Instance } from '../../../test-utils/render';
import VenueRow from '../VenueRow';

jest.mock('../../../api/venues', () => ({
  deleteVenueImage: jest.fn(),
  getVenue: jest.fn(),
  reportVenueImage: jest.fn(),
  uploadGameVenueImage: jest.fn(),
  uploadTournamentVenueImage: jest.fn(),
}));

const byId = (root: Instance, id: string): Instance[] => root.findAll(n => n.props.testID === id && typeof n.type === 'string');
const tap = async (root: Instance, label: string): Promise<void> =>
  act(async () => pressableLabelled(root, label).props.onPress());

let openUrl: jest.SpyInstance;
let copy: jest.SpyInstance;
beforeEach(() => {
  openUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
  copy = jest.spyOn(Clipboard, 'setString').mockImplementation(() => undefined);
});
afterEach(() => {
  openUrl.mockRestore();
  copy.mockRestore();
});

const SNAPSHOT = {
  name: 'Our Tampines Hub',
  address: '1 Tampines Walk, Singapore 528523',
  lat: 1.3535,
  lng: 103.9406,
  source: 'catalogue',
};

describe('venue row', () => {
  it('is a plain row: venue name in the row, no sheet until tapped', () => {
    const root = render(<VenueRow snapshot={SNAPSHOT} fallbackText="x" />);
    expect(texts(root)).toContain('Our Tampines Hub');
    expect(byId(root, 'venue-sheet')).toHaveLength(0);
  });

  it('opens the sheet with the caption, name and address, and Close dismisses it', async () => {
    const root = render(<VenueRow snapshot={SNAPSHOT} fallbackText="x" />);
    await act(async () => root.find(n => n.props.testID === 'venue-row' && typeof n.props.onPress === 'function').props.onPress());
    expect(byId(root, 'venue-sheet')).toHaveLength(1);
    expect(texts(root)).toEqual(
      expect.arrayContaining(['Venue', 'Our Tampines Hub', '1 Tampines Walk, Singapore 528523', 'Open in Google Maps', 'Copy address']),
    );
    await act(async () =>
      root.find(n => n.props.testID === 'venue-sheet-close' && typeof n.props.onPress === 'function').props.onPress(),
    );
    expect(texts(root)).not.toContain('Copy address');
  });

  it('T6: Open in Google Maps uses the coordinates and the place id', async () => {
    const root = render(<VenueRow snapshot={SNAPSHOT} venuePlaceId="ChIJhub" />);
    await act(async () => root.find(n => n.props.testID === 'venue-row' && typeof n.props.onPress === 'function').props.onPress());
    await tap(root, 'Open in Google Maps');
    expect(openUrl).toHaveBeenCalledWith(
      'https://www.google.com/maps/search/?api=1&query=1.3535,103.9406&query_place_id=ChIJhub',
    );
  });

  it('T6: without coordinates it falls back to the encoded name and address', async () => {
    const root = render(
      <VenueRow fallbackText="Riverside Courts" venueName="Riverside Courts" venueAddress="123 River Rd" />,
    );
    await act(async () => root.find(n => n.props.testID === 'venue-row' && typeof n.props.onPress === 'function').props.onPress());
    await tap(root, 'Open in Google Maps');
    expect(openUrl).toHaveBeenCalledWith(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Riverside Courts 123 River Rd')}`,
    );
  });

  it('T6: the game payload\'s own coordinates are used when there is no snapshot', async () => {
    const root = render(<VenueRow venueName="Hall" venueLat={1.3} venueLng={103.8} />);
    await act(async () => root.find(n => n.props.testID === 'venue-row' && typeof n.props.onPress === 'function').props.onPress());
    await tap(root, 'Open in Google Maps');
    expect(openUrl).toHaveBeenCalledWith('https://www.google.com/maps/search/?api=1&query=1.3,103.8');
  });

  it('Copy address copies the full address and confirms', async () => {
    const root = render(<VenueRow snapshot={SNAPSHOT} />);
    await act(async () => root.find(n => n.props.testID === 'venue-row' && typeof n.props.onPress === 'function').props.onPress());
    await tap(root, 'Copy address');
    expect(copy).toHaveBeenCalledWith('1 Tampines Walk, Singapore 528523');
    expect(texts(root)).toContain('Address copied');
  });
});
