/**
 * My venues in the venue picker (DES-MEETUP-ADDENDUM-nov24-enhancements NV-01, AD-2): shown above the catalogue
 * rows, filtered by the same search text, picked, removed after a confirm; absent with no saved venues or when the
 * screen does not ask for it (tournament screens).
 */
import React from 'react';
import { Alert, TextInput } from 'react-native';

import VenuePicker, { savedVenueSelection } from '../VenuePicker';
import * as venuesApi from '../../../api/venues';
import type { SavedVenue, VenueItem } from '../../../types/venue';
import { bundledT } from '../../../labels/LabelsContext';
import { act, pressableLabelled, renderAsync, texts } from '../../../test-utils/render';

jest.mock('../../../api/venues');

const BADMINTON_ID = 'a9325056-87e0-4f3f-9087-96a1c0463e64';

const mockGetVenues = venuesApi.getVenues as jest.MockedFunction<typeof venuesApi.getVenues>;
const mockGetSaved = venuesApi.getSavedVenues as jest.MockedFunction<typeof venuesApi.getSavedVenues>;
const mockDeleteSaved = venuesApi.deleteSavedVenue as jest.MockedFunction<typeof venuesApi.deleteSavedVenue>;

const catalogue: VenueItem[] = [
  {
    id: 'venue-1',
    provider: 'activesg',
    provider_venue_key: 'activesg:1',
    name: 'Hougang Sport Centre',
    block: '93',
    street: 'Hougang Avenue 4',
    status: 'active',
  },
];

const saved: SavedVenue[] = [
  { id: 'sv-1', name: 'Condo Court', postal_code: '123456', address: '1 Condo Road', lat: 1.3, lng: 103.8 },
  { id: 'sv-2', name: 'School Hall', postal_code: '654321', address: null, geocoding_status: 'pending' },
];

const flush = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetVenues.mockResolvedValue({ items: catalogue, next_cursor: null });
  mockGetSaved.mockResolvedValue(saved);
  mockDeleteSaved.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

const mountPicker = async (onSelectSavedVenue?: (venue: SavedVenue) => void) => {
  const root = await renderAsync(
    <VenuePicker
      sportId={BADMINTON_ID}
      sportDisplayName="Badminton"
      selectedVenue={null}
      onSelectVenue={jest.fn()}
      onSelectSavedVenue={onSelectSavedVenue}
    />,
  );
  await flush();
  return root;
};

describe('My venues (NV-01, AD-2)', () => {
  it('shows the My venues group above the catalogue rows, newest use first as the server orders them', async () => {
    const root = await mountPicker(jest.fn());
    const all = texts(root);
    expect(all).toContain('My venues');
    const myVenues = all.indexOf('My venues');
    expect(all.indexOf('Condo Court')).toBeGreaterThan(myVenues);
    expect(all.indexOf('School Hall')).toBeGreaterThan(all.indexOf('Condo Court'));
    expect(all.indexOf('Hougang Sport Centre')).toBeGreaterThan(all.indexOf('School Hall'));
    expect(all).toContain('1 Condo Road');
    expect(all).toContain('654321'); // no address yet: the postal code
    expect(mockGetSaved).toHaveBeenCalledWith('');
  });

  it('filters with the same search text', async () => {
    const root = await mountPicker(jest.fn());
    const input = root.findByType(TextInput);
    await act(async () => {
      input.props.onChangeText('condo');
    });
    await flush();
    expect(mockGetSaved).toHaveBeenLastCalledWith('condo');
    expect(mockGetVenues).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'condo' }));
  });

  it('picking a saved venue reports it and closes the list', async () => {
    const onSaved = jest.fn();
    const root = await mountPicker(onSaved);
    await act(async () => {
      pressableLabelled(root, 'Condo Court').props.onPress();
    });
    expect(onSaved).toHaveBeenCalledWith(saved[0]);
  });

  it('remove asks first, then deletes and drops the row', async () => {
    let buttons: Array<{ text?: string; onPress?: () => void }> = [];
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, given) => {
      buttons = (given ?? []) as typeof buttons;
    });
    const root = await mountPicker(jest.fn());
    const removes = root.findAll(node => node.props.testID === 'saved-venue-remove-sv-1' && typeof node.props.onPress === 'function');
    await act(async () => {
      removes[0].props.onPress();
    });
    expect(alert).toHaveBeenCalledWith('Remove this venue from My venues?', undefined, expect.any(Array));
    expect(mockDeleteSaved).not.toHaveBeenCalled();

    await act(async () => {
      buttons.find(button => button.text === 'Remove')?.onPress?.();
    });
    await flush();
    expect(mockDeleteSaved).toHaveBeenCalledWith('sv-1', expect.objectContaining({ correlationId: expect.any(String) }));
    expect(texts(root)).not.toContain('Condo Court');
    expect(texts(root)).toContain('School Hall');
  });

  it('cancelling the confirm removes nothing', async () => {
    let buttons: Array<{ text?: string; onPress?: () => void }> = [];
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, given) => {
      buttons = (given ?? []) as typeof buttons;
    });
    const root = await mountPicker(jest.fn());
    await act(async () => {
      root.findAll(node => node.props.testID === 'saved-venue-remove-sv-1' && typeof node.props.onPress === 'function')[0].props.onPress();
    });
    expect(buttons.find(button => button.text === 'Cancel')?.onPress).toBeUndefined();
    expect(mockDeleteSaved).not.toHaveBeenCalled();
    expect(texts(root)).toContain('Condo Court');
  });

  it('with no saved venues the group is not shown', async () => {
    mockGetSaved.mockResolvedValue([]);
    const root = await mountPicker(jest.fn());
    expect(texts(root)).not.toContain('My venues');
    expect(texts(root)).toContain('Hougang Sport Centre');
  });

  it('a failed load only hides the group; the catalogue still shows', async () => {
    mockGetSaved.mockRejectedValue(new Error('boom'));
    const root = await mountPicker(jest.fn());
    expect(texts(root)).not.toContain('My venues');
    expect(texts(root)).toContain('Hougang Sport Centre');
  });

  it('a failed removal keeps the row and shows the remove-failed message, not the venues load error', async () => {
    let buttons: Array<{ text?: string; onPress?: () => void }> = [];
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, given) => {
      buttons = (given ?? []) as typeof buttons;
    });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    mockDeleteSaved.mockRejectedValue(new Error('500'));
    const root = await mountPicker(jest.fn());
    await act(async () => {
      root.findAll(node => node.props.testID === 'saved-venue-remove-sv-1' && typeof node.props.onPress === 'function')[0].props.onPress();
    });
    await act(async () => {
      buttons.find(button => button.text === 'Remove')?.onPress?.();
    });
    await flush();
    const all = texts(root);
    expect(all).toContain('Could not remove this venue. Please try again.');
    expect(all).toContain('Condo Court');
    expect(all).toContain('Hougang Sport Centre');
    expect(all.some(text => /Retry/i.test(text))).toBe(false);
  });

  it('without onSelectSavedVenue (tournament screens, OI-2) nothing is fetched or shown', async () => {
    const root = await mountPicker(undefined);
    expect(mockGetSaved).not.toHaveBeenCalled();
    expect(texts(root)).not.toContain('My venues');
  });
});

describe('savedVenueSelection', () => {
  it('marks the pick as a saved venue, shown like Others, with its id for saved_venue_id', () => {
    expect(savedVenueSelection(saved[0], bundledT)).toEqual({
      venueId: null,
      name: 'Condo Court',
      address: '1 Condo Road',
      lat: 1.3,
      lng: 103.8,
      source: 'Others',
      isOthers: true,
      geocoding_status: null,
      savedVenueId: 'sv-1',
    });
  });

  it('falls back to the postal code, worded by the mob.venue.postal_address label, when there is no address yet', () => {
    expect(savedVenueSelection(saved[1], bundledT).address).toBe('Singapore 654321');
  });
});
