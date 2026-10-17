import React from 'react';
import { apiClient } from '../../api/client';
import { getClientConfig, getGameLimits } from '../../api/config';
import { createEvent, updateEvent } from '../../api/events';
import { getMyGroups } from '../../api/groups';
import { fetchPlaceDetails, fetchPlacePredictions } from '../../api/places';
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

jest.mock('../../api/places', () => ({
  fetchPlacePredictions: jest.fn(),
  fetchPlaceDetails: jest.fn(),
  reverseGeocodeCoordinates: jest.fn(),
}));

jest.mock('../../api/events', () => {
  const actual = jest.requireActual('../../api/events');
  return {
    ...actual,
    createEvent: jest.fn(),
    updateEvent: jest.fn(),
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

jest.mock('../../components/venue/VenuePicker', () => {
  const { View } = require('react-native');
  return function MockVenuePicker() {
    return <View testID="mock-venue-picker" />;
  };
});

const mockGetClientConfig = getClientConfig as jest.Mock;
const mockGetGameLimits = getGameLimits as jest.Mock;
const mockGetSports = getSports as jest.Mock;
const mockGetMyGroups = getMyGroups as jest.Mock;
const mockFetchPlacePredictions = fetchPlacePredictions as jest.Mock;
const mockFetchPlaceDetails = fetchPlaceDetails as jest.Mock;
const mockCreateEvent = createEvent as jest.Mock;
const mockUpdateEvent = updateEvent as jest.Mock;
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

describe('Legacy Venue Flow Verification (Isolated Suite)', () => {
  const runSuite = (configDescription: string, clientConfigFactory: () => Record<string, unknown>) => {
    describe(`Config: ${configDescription}`, () => {
      beforeEach(() => {
        jest.clearAllMocks();
        mockGetClientConfig.mockResolvedValue(clientConfigFactory());
        mockGetGameLimits.mockResolvedValue({
          players_min: 2,
          players_max: 30,
        });
        mockGetSports.mockResolvedValue(SPORTS);
        mockGetMyGroups.mockResolvedValue(GROUPS);
        mockCreateEvent.mockResolvedValue({ id: 'evt-new-1', title: 'New Game' });
        mockCreateTournament.mockResolvedValue({ id: 'tourn-new-1', title: 'New Tournament' });
        mockUpdateEvent.mockResolvedValue({ id: 'evt-1' });
        mockPatch.mockResolvedValue({ data: { id: 'evt-1' } });
        mockFetchPlacePredictions.mockResolvedValue([
          {
            place_id: 'pid-123',
            description: 'Bishan Sports Hall, Singapore',
            main_text: 'Bishan Sports Hall',
            secondary_text: 'Bishan St 14',
          },
        ]);
        mockFetchPlaceDetails.mockResolvedValue({
          place_id: 'pid-123',
          name: 'Bishan Sports Hall',
          formatted_address: 'Bishan St 14, Singapore',
          lat: 1.354,
          lng: 103.851,
        });
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
              venue_address: 'Old St',
            },
          });
        });
      });

      it('(1) renders free-text venue fields and NO VenuePicker, (2) creates game payload identical to origin/main, (3) preserves pin and current location link', async () => {
        const root = await renderAsync(
          <CreateGameScreen
            navigation={{ popTo: jest.fn(), navigate: jest.fn() } as any}
            route={{ params: undefined } as any}
          />,
        );

        // Step 1: Mode Casual Game -> Next
        await pressNext(root);

        // Step 2: Title
        typeText(inputByPlaceholder(root, 'e.g. Sunday 5-a-side Football'), 'Friday Badminton');
        await pressNext(root);

        // Step 3: Venue Step UI assertions
        // (1) Renders original free-text venue fields and no VenuePicker
        expect(root.findAll(node => node.props.testID === 'mock-venue-picker')).toHaveLength(0);
        const searchInput = inputByPlaceholder(root, 'Search venue');
        expect(searchInput).toBeDefined();
        const courtInput = inputByPlaceholder(root, 'e.g. Court 2');
        expect(courtInput).toBeDefined();

        // (3) Draggable pin and "Use my current location" link are present
        const locationLinkMatches = root.findAll(node => texts(node).includes('Use my current location'));
        expect(locationLinkMatches.length).toBeGreaterThanOrEqual(1);
        expect(root.findAll(node => (node.type as any)?.name === 'PinIcon').length).toBeGreaterThanOrEqual(1);

        // Perform interactions: search & select place prediction, add court details
        await act(async () => {
          searchInput.props.onChangeText('Bishan');
        });
        const predictionRow = root.find(
          node =>
            node.props.onPress &&
            node.findAll(c => (c.type as unknown) === 'Text' && c.props.children === 'Bishan Sports Hall').length > 0,
        );
        await act(async () => {
          predictionRow.props.onPress();
        });
        typeText(courtInput, 'Court 3');

        // Confirm selected location row displays the selected venue name and address with PinIcon
        expect(texts(root).includes('Bishan Sports Hall')).toBe(true);
        expect(texts(root).includes('Bishan St 14, Singapore')).toBe(true);

        await pressNext(root);

        // Step 4: Audience -> Next
        await pressNext(root);

        // Step 5: Capacity -> Next
        await pressNext(root);

        // Step 6: Create Game
        await act(async () => {
          pressableLabelled(root, 'Create Game').props.onPress();
        });

        // (2) Payload is identical to origin/main output
        expect(mockCreateEvent).toHaveBeenCalledTimes(1);
        const payload = mockCreateEvent.mock.calls[0][0];
        expect(Date.parse(payload.ends_at) - Date.parse(payload.starts_at)).toBe(2 * 3_600_000);

        expect(payload).toEqual({
          title: 'Friday Badminton',
          sport: 'badminton',
          visibility: 'group',
          skill_level_requirement: 'all_levels',
          capacity: 4,
          starts_at: expect.any(String),
          // Duration (default 2 hrs) replaced the old `ends_at: null`.
          ends_at: expect.any(String),
          venue_name: 'Bishan Sports Hall, Court 3',
          venue_address: 'Bishan St 14, Singapore',
          venue_place_id: 'pid-123',
          venue_lat: 1.354,
          venue_lng: 103.851,
        });

        // Strict negative assertions: no venue_id, others, or venue_snapshot
        expect(payload.venue_id).toBeUndefined();
        expect(payload.others).toBeUndefined();
        expect(payload.venue_snapshot).toBeUndefined();
      });

      it('(1) renders free-text venue fields and NO VenuePicker, (2) creates tournament payload identical to origin/main, (3) preserves pin and current location link', async () => {
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

        // Step 3: Venue Step UI assertions
        expect(root.findAll(node => node.props.testID === 'mock-venue-picker')).toHaveLength(0);
        const searchInput = inputByPlaceholder(root, 'Search venue');
        expect(searchInput).toBeDefined();
        const courtInput = inputByPlaceholder(root, 'e.g. Court 2');
        expect(courtInput).toBeDefined();

        const locationLinkMatches = root.findAll(node => texts(node).includes('Use my current location'));
        expect(locationLinkMatches.length).toBeGreaterThanOrEqual(1);
        expect(root.findAll(node => (node.type as any)?.name === 'PinIcon').length).toBeGreaterThanOrEqual(1);

        await act(async () => {
          searchInput.props.onChangeText('Bishan');
        });
        const predictionRow = root.find(
          node =>
            node.props.onPress &&
            node.findAll(c => (c.type as unknown) === 'Text' && c.props.children === 'Bishan Sports Hall').length > 0,
        );
        await act(async () => {
          predictionRow.props.onPress();
        });
        typeText(courtInput, 'Hall A');

        await pressNext(root);

        // Step 4: Audience -> Next
        await pressNext(root);

        // Step 5: Capacity -> Next
        await pressNext(root);

        // Step 6: Create Game
        await act(async () => {
          pressableLabelled(root, 'Create Game').props.onPress();
        });

        expect(mockCreateTournament).toHaveBeenCalledTimes(1);
        const payload = mockCreateTournament.mock.calls[0][0];

        expect(payload).toEqual({
          title: 'Autumn Open Tournament',
          sport: 'badminton',
          visibility: 'group',
          participation_mode: 'individual',
          format: 'knockout',
          capacity: 4,
          starts_at: expect.any(String),
          venue_name: 'Bishan Sports Hall, Hall A',
        });

        // Strict negative assertions: no venue_id, others, or venue_snapshot
        expect(payload.venue_id).toBeUndefined();
        expect(payload.others).toBeUndefined();
        expect(payload.venue_snapshot).toBeUndefined();
      });

      it('(1) renders free-text venue fields and NO VenuePicker, (2) edits game payload identical to origin/main, (3) preserves pin and current location link', async () => {
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

        // Step 2: Venue Step UI assertions
        expect(root.findAll(node => node.props.testID === 'mock-venue-picker')).toHaveLength(0);
        const searchInput = inputByPlaceholder(root, 'Search venue');
        expect(searchInput).toBeDefined();
        const courtInput = inputByPlaceholder(root, 'e.g. Court 2');
        expect(courtInput).toBeDefined();

        const locationLinkMatches = root.findAll(node => texts(node).includes('Use my current location'));
        expect(locationLinkMatches.length).toBeGreaterThanOrEqual(1);
        expect(root.findAll(node => (node.type as any)?.name === 'PinIcon').length).toBeGreaterThanOrEqual(1);

        await act(async () => {
          searchInput.props.onChangeText('Bishan');
        });
        const predictionRow = root.find(
          node =>
            node.props.onPress &&
            node.findAll(c => (c.type as unknown) === 'Text' && c.props.children === 'Bishan Sports Hall').length > 0,
        );
        await act(async () => {
          predictionRow.props.onPress();
        });
        typeText(courtInput, 'Court 5');

        await pressNext(root);

        // Step 3: Players & Skill -> Next
        await pressNext(root);

        // Step 4: Review -> Save changes
        await act(async () => {
          pressableLabelled(root, 'Save changes').props.onPress();
        });

        expect(mockUpdateEvent).toHaveBeenCalledTimes(1);
        const [targetEventId, payload] = mockUpdateEvent.mock.calls[0];
        expect(targetEventId).toBe('evt-1');

        expect(payload).toEqual({
          title: 'Existing Badminton Game',
          venue_name: 'Bishan Sports Hall, Court 5',
          venue_address: 'Bishan St 14, Singapore',
          venue_place_id: 'pid-123',
          venue_lat: 1.354,
          venue_lng: 103.851,
          skill_level_requirement: 'intermediate',
          capacity: 8,
          starts_at: '2026-11-20T10:00:00.000Z',
        });

        // Strict negative assertions: no venue_id, others, or venue_snapshot
        expect(payload.venue_id).toBeUndefined();
        expect(payload.others).toBeUndefined();
        expect(payload.venue_snapshot).toBeUndefined();
      });
    });
  };

  // Condition 1: venue_catalogue_enabled: false
  runSuite('venue_catalogue_enabled = false', () => ({
    venue_catalogue_enabled: false,
    google_maps_api_key: 'test-key',
  }));

  // Condition 2: venue_catalogue_enabled absent
  runSuite('venue_catalogue_enabled absent', () => ({
    google_maps_api_key: 'test-key',
  }));
});
