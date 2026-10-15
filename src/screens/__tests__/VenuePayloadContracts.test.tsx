import React from 'react';
import { apiClient } from '../../api/client';
import { getClientConfig, getGameLimits } from '../../api/config';
import { createEvent } from '../../api/events';
import { getMyGroups } from '../../api/groups';
import { getSports } from '../../api/sports';
import { createTournament } from '../../api/tournaments';
import { act, pressableLabelled, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import CreateGameScreen from '../CreateGameScreen';
import EventDetailScreen from '../EventDetailScreen';

jest.mock('../../api/config', () => ({
  getClientConfig: jest.fn(),
  getGameLimits: jest.fn(),
}));

jest.mock('../../api/sports', () => ({
  getSports: jest.fn(),
}));

jest.mock('../../api/groups', () => ({
  getMyGroups: jest.fn(),
}));

jest.mock('../../api/events', () => {
  const actual = jest.requireActual('../../api/events');
  return {
    ...actual,
    createEvent: jest.fn(),
  };
});

jest.mock('../../api/tournaments', () => {
  const actual = jest.requireActual('../../api/tournaments');
  return {
    ...actual,
    createTournament: jest.fn(),
  };
});

jest.mock('../../api/client', () => ({
  apiClient: {
    get: jest.fn(),
    patch: jest.fn(),
    post: jest.fn(),
  },
}));

let mockUser: { id: string; nickname: string } | null = { id: 'user-me', nickname: 'Sam' };
jest.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

// Mock VenuePicker so we can reliably trigger catalogue venue or Others venue selection in tests
jest.mock('../../components/venue/VenuePicker', () => {
  const { Pressable, Text, View } = require('react-native');
  return function MockVenuePicker({ onSelectVenue, onSaveOthersVenue, variant }: any) {
    return (
      <View testID="mock-venue-picker">
        <Text testID="picker-variant">{variant || 'standard'}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pick Catalogue Venue"
          onPress={() =>
            onSelectVenue({
              id: 'v-cat-101',
              name: 'ActiveSG Bishan Sports Centre',
              block: '5',
              street: 'Bishan Street 14',
              postal_code: '579783',
              source: 'ActiveSG',
              lat: 1.354,
              lng: 103.851,
            })
          }
        >
          <Text>Pick Catalogue Venue</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pick Others Venue"
          onPress={() =>
            onSaveOthersVenue({
              address: '50 Jurong West Ave 9, Singapore 649832',
              lat: 1.341,
              lng: 103.692,
              geocoding_status: 'pending',
              othersInput: {
                name: 'Jurong West Community Arena',
                postal_code: '649832',
                facilities: ['Badminton', 'Futsal'],
                operating_hours: '08:00 - 22:00',
                info_url: 'https://example.com/jurong',
              },
            })
          }
        >
          <Text>Pick Others Venue</Text>
        </Pressable>
      </View>
    );
  };
});

const mockGetClientConfig = getClientConfig as jest.Mock;
const mockGetGameLimits = getGameLimits as jest.Mock;
const mockGetSports = getSports as jest.Mock;
const mockGetMyGroups = getMyGroups as jest.Mock;
const mockCreateEvent = createEvent as jest.Mock;
const mockCreateTournament = createTournament as jest.Mock;
const mockPatch = apiClient.patch as jest.Mock;
const mockGet = apiClient.get as jest.Mock;

const SPORTS = [
  { name: 'badminton', display_name: 'Badminton', icon_key: 'badminton', color: '#2A7B72' },
  { name: 'football', display_name: 'Football', icon_key: 'football', color: '#835C2B' },
];

const GROUPS = {
  items: [],
  total: 0,
  page: 1,
  page_size: 10,
};

const inputByPlaceholder = (root: Instance, placeholder: string): Instance =>
  root.find(node => (node.type as unknown) === 'TextInput' && node.props.placeholder === placeholder);

const capacityInput = (root: Instance): Instance =>
  root.findAll(node => (node.type as unknown) === 'TextInput' && node.props.keyboardType === 'number-pad')[0];

const typeText = (field: Instance, value: string): void => {
  act(() => {
    field.props.onChangeText(value);
  });
};

const pressNext = async (root: Instance): Promise<void> => {
  const matches = root.findAll(
    node =>
      (node.props.accessibilityLabel === 'Next' ||
        (typeof node.props.onPress === 'function' && texts(node).includes('Next'))) &&
      typeof node.props.onPress === 'function',
  );
  if (matches.length === 0) {
    throw new Error('Next button not found');
  }
  await act(async () => {
    matches[0].props.onPress();
  });
};

const clickEditBannerButton = async (root: Instance): Promise<void> => {
  const matches = root.findAll(
    node =>
      node.props.accessibilityLabel === 'Edit Game' &&
      typeof node.props.onPress === 'function',
  );
  if (matches.length === 0) {
    throw new Error('Edit Game banner button not found');
  }
  await act(async () => {
    matches[0].props.onPress();
  });
};

const selectTournamentMode = async (root: Instance): Promise<void> => {
  const matches = root.findAll(
    node =>
      node.props.accessibilityLabel === 'Tournament' &&
      typeof node.props.onPress === 'function',
  );
  if (matches.length === 0) {
    throw new Error('Tournament mode card not found');
  }
  await act(async () => {
    matches[0].props.onPress();
  });
};

describe('Venue Catalogue Payload Contract Assertions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetClientConfig.mockResolvedValue({
      venue_catalogue_enabled: true,
      google_maps_api_key: 'test-key',
    });
    mockGetGameLimits.mockResolvedValue({
      players_min: 2,
      players_max: 30,
    });
    mockGetSports.mockResolvedValue(SPORTS);
    mockGetMyGroups.mockResolvedValue(GROUPS);
    mockCreateEvent.mockResolvedValue({ id: 'evt-new-1', title: 'New Game' });
    mockCreateTournament.mockResolvedValue({ id: 'tourn-new-1', title: 'New Tournament' });
    mockPatch.mockResolvedValue({ data: { id: 'evt-1' } });
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/participants')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({
        data: {
          id: 'evt-1',
          organizer_id: 'user-me',
          sport: 'badminton',
          title: 'Existing Badminton Game',
          description: 'Fun doubles',
          visibility: 'public',
          capacity: 8,
          starts_at: '2026-11-20T10:00:00Z',
          ends_at: null,
          skill_level_requirement: 'intermediate',
          status: 'upcoming',
          venue_name: 'Existing Venue',
          venue_id: 'v-old-99',
          venue_snapshot: {
            name: 'Existing Venue',
            block: '1',
            street: 'Old St',
            source: 'ActiveSG',
          },
        },
      });
    });
  });

  describe('1. Create Game (POST /events via createEvent)', () => {
    it('sends venue_id and NEVER sends venue_snapshot, address, lat, or lng when catalogue venue is chosen', async () => {
      const root = await renderAsync(
        <CreateGameScreen
          navigation={{ popTo: jest.fn(), navigate: jest.fn() } as any}
          route={{ params: undefined } as any}
        />,
      );

      // Step 1: Mode is default Casual Game -> Next
      await pressNext(root);

      // Step 2: Game Details (Title)
      typeText(inputByPlaceholder(root, 'e.g. Sunday 5-a-side Football'), 'Friday Badminton');
      await pressNext(root);

      // Step 3: When and where? Pick catalogue venue via mock picker
      await act(async () => {
        pressableLabelled(root, 'Pick Catalogue Venue').props.onPress();
      });
      await pressNext(root);

      // Step 4: Audience (default public)
      await pressNext(root);

      // Step 5: Capacity
      typeText(capacityInput(root), '6');
      await pressNext(root);

      // Step 6: Review & Submit
      await act(async () => {
        pressableLabelled(root, 'Create Game').props.onPress();
      });

      expect(mockCreateEvent).toHaveBeenCalledTimes(1);
      const payload = mockCreateEvent.mock.calls[0][0];

      // Exact assertion: contains venue_id and full venue_name
      expect(payload).toMatchObject({
        title: 'Friday Badminton',
        venue_id: 'v-cat-101',
        venue_name: 'ActiveSG Bishan Sports Centre, Court 2',
      });

      // Strict negative assertions: MUST NEVER send venue_snapshot, address, lat, or lng
      expect(payload).not.toHaveProperty('venue_snapshot');
      expect(payload).not.toHaveProperty('address');
      expect(payload).not.toHaveProperty('venue_address');
      expect(payload).not.toHaveProperty('lat');
      expect(payload).not.toHaveProperty('lng');
      expect(payload).not.toHaveProperty('venue_lat');
      expect(payload).not.toHaveProperty('venue_lng');
      expect(payload).not.toHaveProperty('others');
    });

    it('sends others{name,postal_code,facilities,operating_hours,info_url} and NEVER sends venue_id, venue_snapshot, address, lat, or lng', async () => {
      const root = await renderAsync(
        <CreateGameScreen
          navigation={{ popTo: jest.fn(), navigate: jest.fn() } as any}
          route={{ params: undefined } as any}
        />,
      );

      // Step 1: Mode is default Casual Game -> Next
      await pressNext(root);

      // Step 2: Title
      typeText(inputByPlaceholder(root, 'e.g. Sunday 5-a-side Football'), 'Custom Court Game');
      await pressNext(root);

      // Step 3: When and where? Pick Others venue via mock picker
      await act(async () => {
        pressableLabelled(root, 'Pick Others Venue').props.onPress();
      });
      await pressNext(root);

      // Step 4: Audience
      await pressNext(root);

      // Step 5: Capacity
      typeText(capacityInput(root), '4');
      await pressNext(root);

      // Step 6: Submit
      await act(async () => {
        pressableLabelled(root, 'Create Game').props.onPress();
      });

      expect(mockCreateEvent).toHaveBeenCalledTimes(1);
      const payload = mockCreateEvent.mock.calls[0][0];

      // Exact assertion: contains others object and full venue_name
      expect(payload).toMatchObject({
        title: 'Custom Court Game',
        venue_name: 'Jurong West Community Arena, Court 2',
        others: {
          name: 'Jurong West Community Arena',
          postal_code: '649832',
          facilities: ['Badminton', 'Futsal'],
          operating_hours: '08:00 - 22:00',
          info_url: 'https://example.com/jurong',
        },
      });

      // Strict negative assertions: MUST NEVER send venue_id, venue_snapshot, address, lat, or lng
      expect(payload.venue_id).toBeUndefined();
      expect(payload).not.toHaveProperty('venue_snapshot');
      expect(payload).not.toHaveProperty('address');
      expect(payload).not.toHaveProperty('venue_address');
      expect(payload).not.toHaveProperty('lat');
      expect(payload).not.toHaveProperty('lng');
      expect(payload).not.toHaveProperty('venue_lat');
      expect(payload).not.toHaveProperty('venue_lng');
    });
  });

  describe('2. Create Tournament (POST /tournaments via createTournament)', () => {
    it('sends venue_id and NEVER sends venue_snapshot, address, lat, or lng when catalogue venue is chosen', async () => {
      const root = await renderAsync(
        <CreateGameScreen
          navigation={{ popTo: jest.fn(), navigate: jest.fn() } as any}
          route={{ params: undefined } as any}
        />,
      );

      // Step 1: Switch to Tournament
      await selectTournamentMode(root);
      await pressNext(root);

      // Step 2: Tournament Title
      typeText(inputByPlaceholder(root, 'e.g. Sunday 5-a-side Football'), 'Autumn Open Tournament');
      await pressNext(root);

      // Step 3: Venue picker (variant="tournament")
      await act(async () => {
        pressableLabelled(root, 'Pick Catalogue Venue').props.onPress();
      });
      await pressNext(root);

      // Step 4: Audience
      await pressNext(root);

      // Step 5: Capacity
      await pressNext(root);

      // Step 6: Submit
      await act(async () => {
        pressableLabelled(root, 'Create Game').props.onPress();
      });

      expect(mockCreateTournament).toHaveBeenCalledTimes(1);
      const payload = mockCreateTournament.mock.calls[0][0];

      // Exact assertion: contains venue_id and venue_name
      expect(payload).toMatchObject({
        title: 'Autumn Open Tournament',
        venue_id: 'v-cat-101',
        venue_name: 'ActiveSG Bishan Sports Centre, Court 2',
      });

      // Strict negative assertions: MUST NEVER send venue_snapshot, address, lat, or lng
      expect(payload).not.toHaveProperty('venue_snapshot');
      expect(payload).not.toHaveProperty('address');
      expect(payload).not.toHaveProperty('venue_address');
      expect(payload).not.toHaveProperty('lat');
      expect(payload).not.toHaveProperty('lng');
      expect(payload).not.toHaveProperty('venue_lat');
      expect(payload).not.toHaveProperty('venue_lng');
      expect(payload).not.toHaveProperty('others');
    });

    it('sends others{name,postal_code,facilities,operating_hours,info_url} and NEVER sends venue_id, venue_snapshot, address, lat, or lng', async () => {
      const root = await renderAsync(
        <CreateGameScreen
          navigation={{ popTo: jest.fn(), navigate: jest.fn() } as any}
          route={{ params: undefined } as any}
        />,
      );

      // Step 1: Switch to Tournament
      await selectTournamentMode(root);
      await pressNext(root);

      // Step 2: Tournament Title
      typeText(inputByPlaceholder(root, 'e.g. Sunday 5-a-side Football'), 'Others Venue Tourney');
      await pressNext(root);

      // Step 3: Venue picker (variant="tournament")
      await act(async () => {
        pressableLabelled(root, 'Pick Others Venue').props.onPress();
      });
      await pressNext(root);

      // Step 4: Audience
      await pressNext(root);

      // Step 5: Capacity
      await pressNext(root);

      // Step 6: Submit
      await act(async () => {
        pressableLabelled(root, 'Create Game').props.onPress();
      });

      expect(mockCreateTournament).toHaveBeenCalledTimes(1);
      const payload = mockCreateTournament.mock.calls[0][0];

      // Exact assertion: contains others and venue_name
      expect(payload).toMatchObject({
        title: 'Others Venue Tourney',
        venue_name: 'Jurong West Community Arena, Court 2',
        others: {
          name: 'Jurong West Community Arena',
          postal_code: '649832',
          facilities: ['Badminton', 'Futsal'],
          operating_hours: '08:00 - 22:00',
          info_url: 'https://example.com/jurong',
        },
      });

      // Strict negative assertions: MUST NEVER send venue_id, venue_snapshot, address, lat, or lng
      expect(payload.venue_id).toBeUndefined();
      expect(payload).not.toHaveProperty('venue_snapshot');
      expect(payload).not.toHaveProperty('address');
      expect(payload).not.toHaveProperty('venue_address');
      expect(payload).not.toHaveProperty('lat');
      expect(payload).not.toHaveProperty('lng');
      expect(payload).not.toHaveProperty('venue_lat');
      expect(payload).not.toHaveProperty('venue_lng');
    });
  });

  describe('3. Edit Game (PATCH /events/{id} via updateEvent)', () => {
    it('sends venue_id and NEVER sends venue_snapshot, address, lat, or lng when catalogue venue is chosen', async () => {
      const root = await renderAsync(
        <EventDetailScreen
          navigation={{ goBack: jest.fn() } as any}
          route={{ key: 'k', name: 'EventDetail', params: { eventId: 'evt-1' } } as any}
        />,
      );

      // Open Edit Game wizard from banner
      await clickEditBannerButton(root);

      // Step 1: General -> Next
      await pressNext(root);

      // Step 2: Venue -> Pick catalogue venue via mock picker
      await act(async () => {
        pressableLabelled(root, 'Pick Catalogue Venue').props.onPress();
      });
      await pressNext(root);

      // Step 3: Players & Skill -> Next
      await pressNext(root);

      // Step 4: Review -> Save Changes
      await act(async () => {
        pressableLabelled(root, 'Save changes').props.onPress();
      });

      expect(mockPatch).toHaveBeenCalledWith(
        '/events/evt-1',
        expect.anything(),
        expect.anything(),
      );

      const patchPayload = mockPatch.mock.calls[0][1];

      // Exact assertion: contains venue_id and venue_name
      expect(patchPayload).toMatchObject({
        venue_id: 'v-cat-101',
        venue_name: 'ActiveSG Bishan Sports Centre',
      });

      // Strict negative assertions: MUST NEVER send venue_snapshot, address, lat, or lng
      expect(patchPayload).not.toHaveProperty('venue_snapshot');
      expect(patchPayload).not.toHaveProperty('address');
      expect(patchPayload).not.toHaveProperty('venue_address');
      expect(patchPayload).not.toHaveProperty('lat');
      expect(patchPayload).not.toHaveProperty('lng');
      expect(patchPayload).not.toHaveProperty('venue_lat');
      expect(patchPayload).not.toHaveProperty('venue_lng');
      expect(patchPayload).not.toHaveProperty('others');
    });

    it('sends others{name,postal_code,facilities,operating_hours,info_url} and NEVER sends venue_id, venue_snapshot, address, lat, or lng', async () => {
      const root = await renderAsync(
        <EventDetailScreen
          navigation={{ goBack: jest.fn() } as any}
          route={{ key: 'k', name: 'EventDetail', params: { eventId: 'evt-1' } } as any}
        />,
      );

      // Open Edit Game wizard from banner
      await clickEditBannerButton(root);

      // Step 1: General -> Next
      await pressNext(root);

      // Step 2: Venue -> Pick Others venue via mock picker
      await act(async () => {
        pressableLabelled(root, 'Pick Others Venue').props.onPress();
      });
      await pressNext(root);

      // Step 3: Players & Skill -> Next
      await pressNext(root);

      // Step 4: Review -> Save Changes
      await act(async () => {
        pressableLabelled(root, 'Save changes').props.onPress();
      });

      expect(mockPatch).toHaveBeenCalledWith(
        '/events/evt-1',
        expect.anything(),
        expect.anything(),
      );

      const patchPayload = mockPatch.mock.calls[0][1];

      // Exact assertion: contains others and venue_name
      expect(patchPayload).toMatchObject({
        venue_name: 'Jurong West Community Arena',
        others: {
          name: 'Jurong West Community Arena',
          postal_code: '649832',
          facilities: ['Badminton', 'Futsal'],
          operating_hours: '08:00 - 22:00',
          info_url: 'https://example.com/jurong',
        },
      });

      // Strict negative assertions: MUST NEVER send venue_id, venue_snapshot, address, lat, or lng
      expect(patchPayload.venue_id).toBeUndefined();
      expect(patchPayload).not.toHaveProperty('venue_snapshot');
      expect(patchPayload).not.toHaveProperty('address');
      expect(patchPayload).not.toHaveProperty('venue_address');
      expect(patchPayload).not.toHaveProperty('lat');
      expect(patchPayload).not.toHaveProperty('lng');
      expect(patchPayload).not.toHaveProperty('venue_lat');
      expect(patchPayload).not.toHaveProperty('venue_lng');
    });
  });
});
