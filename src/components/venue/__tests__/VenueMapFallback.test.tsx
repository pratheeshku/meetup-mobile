/**
 * venue-map-blank: when the Static Maps image fails to load, show the existing
 * map-pattern placeholder instead of a blank box, keep the caption, and log
 * once without the API key.
 */
import React from 'react';
import { Image } from 'react-native';

import VenueDetailCard from '../VenueDetailCard';
import VenuePicker from '../VenuePicker';
import { resetMapFailureLogForTests } from '../logMapFailure';
import { act, renderAsync, texts } from '../../../test-utils/render';
import type { Instance } from '../../../test-utils/render';
import type { VenueSnapshot } from '../../../types/venue';

jest.mock('../../../api/venues');

const KEY = 'SECRET-MAPS-KEY-123';
const isMapImage = (n: Instance): boolean =>
  n.type === Image && String(n.props.source?.uri).includes('maps.googleapis.com/maps/api/staticmap');
const placeholder = (root: Instance): Instance[] =>
  root.findAll(n => n.props.testID === 'venue-map-placeholder');

const snapshot: VenueSnapshot = {
  name: 'Bishan Sports Hall',
  block: '5',
  street: 'Bishan Street 14',
  postal_code: '579780',
  lat: 1.3548,
  lng: 103.8504,
  source: 'catalogue',
  address: '5 Bishan Street 14',
};

let warn: jest.SpyInstance;
beforeEach(() => {
  resetMapFailureLogForTests();
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

const renderers: Array<{ name: string; mount: () => Promise<Instance> }> = [
  {
    name: 'VenueDetailCard',
    mount: () =>
      renderAsync(
        <VenueDetailCard snapshot={snapshot} fallbackText="x" courtDetails={null} mapsApiKey={KEY} />,
      ),
  },
  {
    name: 'VenuePicker',
    mount: () =>
      renderAsync(
        <VenuePicker
          sportId="s-1"
          sportDisplayName="Badminton"
          selectedVenue={{
            venueId: 'v-1',
            name: 'Bishan Sports Hall',
            address: '5 Bishan Street 14',
            lat: 1.3548,
            lng: 103.8504,
            isOthers: false,
          }}
          onSelectVenue={jest.fn()}
          onSelectOthers={jest.fn()}
          onSaveOthersVenue={jest.fn()}
          onClearVenue={jest.fn()}
          mapsApiKey={KEY}
        />,
      ),
  },
];

describe.each(renderers)('$name static map failure handling', ({ mount }) => {
  it('renders the map image first, then the placeholder after onError; caption stays', async () => {
    const root = await mount();
    const images = root.findAll(isMapImage);
    expect(images.length).toBeGreaterThan(0);
    expect(placeholder(root)).toHaveLength(0);

    await act(async () => {
      images[0].props.onError({ nativeEvent: { error: `failed ${images[0].props.source.uri}` } });
    });

    expect(root.findAll(isMapImage)).toHaveLength(0);
    expect(placeholder(root).length).toBeGreaterThan(0);
    expect(texts(root).some(x => /pin set/i.test(x))).toBe(true);
  });

  it('logs the failure once and never includes the API key', async () => {
    const root = await mount();
    const img = root.findAll(isMapImage)[0];
    await act(async () => {
      img.props.onError({ nativeEvent: { error: img.props.source.uri } });
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls)).not.toContain(KEY);
  });
});
