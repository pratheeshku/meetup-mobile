import React, { useState } from 'react';

import VenuePicker, { SelectedVenueState } from '../VenuePicker';
import * as venuesApi from '../../../api/venues';
import type { VenueItem } from '../../../types/venue';
import {
  act,
  pressableLabelled,
  renderAsync,
  texts,
} from '../../../test-utils/render';

jest.mock('../../../api/venues');

const BADMINTON_ID = 'a9325056-87e0-4f3f-9087-96a1c0463e64';
const TENNIS_ID = '80be6480-f5a1-4413-991b-58cc0d826665';
const FOOTBALL_ID = 'a3804a5d-ef0a-494b-99ec-6644971f3da0';

const mockGetVenues = venuesApi.getVenues as jest.MockedFunction<typeof venuesApi.getVenues>;

const sampleVenues: VenueItem[] = [
  {
    id: 'venue-1',
    provider: 'activesg',
    provider_venue_key: 'activesg:1',
    name: 'Hougang Sport Centre',
    block: '93',
    street: 'Hougang Avenue 4',
    postal_code: '538832',
    lat: 1.3712,
    lng: 103.8885,
    facilities: ['Badminton Hall', 'Swimming Complex'],
    status: 'active',
    source: 'ActiveSG',
  },
  {
    id: 'venue-2',
    provider: 'activesg',
    provider_venue_key: 'activesg:2',
    name: 'Pasir Ris Sport Centre',
    block: '120',
    street: 'Pasir Ris Central',
    postal_code: '519640',
    lat: 1.3741,
    lng: 103.9525,
    facilities: ['Badminton Hall'],
    status: 'active',
    source: 'ActiveSG',
  },
];

describe('VenuePicker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVenues.mockResolvedValue({
      items: sampleVenues,
      next_cursor: 'cursor-2',
    });
  });

  it('renders search input and venues list when open or no venue selected', async () => {
    const onSelect = jest.fn();
    const root = await renderAsync(
      <VenuePicker
        sportId={BADMINTON_ID}
        sportDisplayName="Badminton"
        selectedVenue={null}
        onSelectVenue={onSelect}
      />,
    );

    const allTexts = texts(root);
    expect(allTexts).toContain('Showing venues for Badminton');
    expect(allTexts).toContain('Hougang Sport Centre');
    expect(allTexts).toContain('Pasir Ris Sport Centre');
    expect(allTexts).toContain('Others');
    expect(allTexts).toContain('Not listed? Enter the name and postal code');

    expect(mockGetVenues).toHaveBeenCalledWith({
      sport_id: BADMINTON_ID,
      q: '',
      cursor: undefined,
    });
  });

  it('queries venues with search text and sport id', async () => {
    const onSelect = jest.fn();
    const root = await renderAsync(
      <VenuePicker
        sportId={BADMINTON_ID}
        sportDisplayName="Badminton"
        selectedVenue={null}
        onSelectVenue={onSelect}
      />,
    );

    const input = root.find(
      n => (n.type as unknown) === 'TextInput' && n.props.placeholder === 'Search venues',
    );
    await act(async () => {
      input.props.onChangeText('Hougang');
    });

    expect(mockGetVenues).toHaveBeenCalledWith({
      sport_id: BADMINTON_ID,
      q: 'Hougang',
      cursor: undefined,
    });
  });

  it('selecting a venue invokes onSelectVenue and closes picker', async () => {
    const onSelect = jest.fn();
    const root = await renderAsync(
      <VenuePicker
        sportId={BADMINTON_ID}
        sportDisplayName="Badminton"
        selectedVenue={null}
        onSelectVenue={onSelect}
      />,
    );

    const venueRow = pressableLabelled(root, 'Hougang Sport Centre');
    await act(async () => {
      venueRow.props.onPress();
    });

    expect(onSelect).toHaveBeenCalledWith(sampleVenues[0]);
  });

  it('renders selected venue state matching board EditGame2', async () => {
    const selected: SelectedVenueState = {
      venueId: 'venue-1',
      name: 'Hougang Sport Centre',
      address: '93 Hougang Avenue 4',
      lat: 1.3712,
      lng: 103.8885,
      source: 'ActiveSG',
      isOthers: false,
    };

    const root = await renderAsync(
      <VenuePicker
        sportId={BADMINTON_ID}
        sportDisplayName="Badminton"
        selectedVenue={selected}
        onSelectVenue={jest.fn()}
      />,
    );

    const allTexts = texts(root);
    expect(allTexts).toContain('Hougang Sport Centre');
    expect(allTexts).toContain('93 Hougang Avenue 4');
    expect(allTexts).toContain('ActiveSG');
    expect(allTexts).toContain('Pin set from the venue address');
    expect(allTexts).not.toContain('Search venues');
  });

  it('shows pending geocode message when others venue geocoding_status is pending', async () => {
    const selected: SelectedVenueState = {
      venueId: null,
      name: 'Private Condo Court',
      address: 'Singapore 560123',
      lat: null,
      lng: null,
      source: 'Others',
      isOthers: true,
      geocoding_status: 'pending',
    };

    const root = await renderAsync(
      <VenuePicker
        sportId={TENNIS_ID}
        sportDisplayName="Tennis"
        selectedVenue={selected}
        onSelectVenue={jest.fn()}
      />,
    );

    const allTexts = texts(root);
    expect(allTexts).toContain('Private Condo Court');
    expect(allTexts).toContain('Others');
    expect(allTexts).toContain('Address lookup will complete shortly');
  });

  it('clears catalogue venue and prompts user when sport changes', async () => {
    const onClear = jest.fn();
    const selected: SelectedVenueState = {
      venueId: 'venue-1',
      name: 'Hougang Sport Centre',
      address: '93 Hougang Avenue 4',
      lat: 1.3712,
      lng: 103.8885,
      source: 'ActiveSG',
      isOthers: false,
    };

    let setSportFn: (sport: string) => void = () => {};

    function TestHost() {
      const [sport, setSport] = useState(BADMINTON_ID);
      setSportFn = setSport;
      return (
        <VenuePicker
          sportId={sport}
          sportDisplayName={sport}
          selectedVenue={selected}
          onSelectVenue={jest.fn()}
          onClearVenue={onClear}
        />
      );
    }

    const root = await renderAsync(<TestHost />);

    await act(async () => {
      setSportFn(TENNIS_ID);
    });

    expect(onClear).toHaveBeenCalled();
    const allTexts = texts(root);
    expect(allTexts).toContain('Sport changed. Please select a venue again.');
  });

  it('preserves Others venue when sport changes', async () => {
    const onClear = jest.fn();
    const selected: SelectedVenueState = {
      venueId: null,
      name: 'Community Court',
      address: 'Singapore 123456',
      lat: 1.3,
      lng: 103.8,
      source: 'Others',
      isOthers: true,
    };

    let setSportFn: (sport: string) => void = () => {};

    function TestHost() {
      const [sport, setSport] = useState(BADMINTON_ID);
      setSportFn = setSport;
      return (
        <VenuePicker
          sportId={sport}
          sportDisplayName={sport}
          selectedVenue={selected}
          onSelectVenue={jest.fn()}
          onClearVenue={onClear}
        />
      );
    }

    await renderAsync(<TestHost />);

    await act(async () => {
      setSportFn(FOOTBALL_ID);
    });

    expect(onClear).not.toHaveBeenCalled();
  });
  it('does not call the API and asks for a sport when sportId is not a UUID', async () => {
    const root = await renderAsync(
      <VenuePicker
        sportId="badminton"
        sportDisplayName="Badminton"
        selectedVenue={null}
        onSelectVenue={jest.fn()}
      />,
    );

    expect(mockGetVenues).not.toHaveBeenCalled();
    expect(texts(root)).toContain('Choose a sport first to see venues.');
  });

  it('does not call the API when sportId is empty', async () => {
    const root = await renderAsync(
      <VenuePicker
        sportId=""
        sportDisplayName=""
        selectedVenue={null}
        onSelectVenue={jest.fn()}
      />,
    );

    expect(mockGetVenues).not.toHaveBeenCalled();
    expect(texts(root)).toContain('Choose a sport first to see venues.');
  });
  describe.each(['standard', 'tournament'] as const)('after selection (%s variant)', variant => {
    it('shows the chosen venue name and its address line', async () => {
      const Host = () => {
        const [chosen, setChosen] = useState<SelectedVenueState | null>(null);
        return (
          <VenuePicker
            sportId={BADMINTON_ID}
            sportDisplayName="Badminton"
            variant={variant}
            selectedVenue={chosen}
            onSelectVenue={v =>
              setChosen({
                venueId: v.id,
                name: v.name,
                address: [v.block, v.street].filter(Boolean).join(' '),
                lat: v.lat,
                lng: v.lng,
                source: v.source,
                isOthers: false,
              })
            }
          />
        );
      };
      const root = await renderAsync(<Host />);

      await act(async () => {
        pressableLabelled(root, 'Hougang Sport Centre').props.onPress();
      });

      const shown = texts(root);
      expect(shown).toContain('Hougang Sport Centre');
      expect(shown).toContain('93 Hougang Avenue 4');
      // The list has closed: the other venue is no longer offered.
      expect(shown).not.toContain('Pasir Ris Sport Centre');
    });
  });
});
