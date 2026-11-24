/**
 * Create game for DES-MEETUP-ADDENDUM-nov24-enhancements:
 * - NV-03: an optional banner on step 2, uploaded after the game is created under the same correlation id; an upload
 *   failure never undoes the creation.
 * - NV-01: a My venues pick is sent as `saved_venue_id` (and only that venue field).
 */
import React from 'react';
import { Alert } from 'react-native';

import { getClientConfig, getGameLimits } from '../../api/config';
import { createEvent, uploadEventBanner } from '../../api/events';
import { showCompletion } from '../../navigation/showCompletion';
import { act } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { byLabel, mountCreateGame, press } from '../../test-utils/createGameHarness';
import { pickImage } from '../../utils/imagePicker';

jest.mock('../../api/config', () => ({ getClientConfig: jest.fn(), getGameLimits: jest.fn() }));
jest.mock('../../api/sports', () => ({ getSports: jest.fn() }));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn() }));
jest.mock('../../api/events', () => ({ createEvent: jest.fn(), inviteEmailToEvent: jest.fn(), uploadEventBanner: jest.fn() }));
jest.mock('../../api/users', () => ({ searchUsers: jest.fn() }));
jest.mock('../../api/tournaments', () => ({ createTournament: jest.fn(), getWizardTemplates: jest.fn(() => Promise.resolve([])) }));
jest.mock('../../navigation/showCompletion', () => ({ showCompletion: jest.fn() }));
jest.mock('../../utils/imagePicker', () => ({
  ...jest.requireActual('../../utils/imagePicker'),
  pickImage: jest.fn(),
}));
// The real picker's own behaviour is covered in VenuePickerMyVenues.test.tsx; here it only reports picks.
jest.mock('../../components/venue/VenuePicker', () => {
  const actual = jest.requireActual('../../components/venue/VenuePicker');
  const { Pressable, Text, View } = require('react-native');
  return {
    __esModule: true,
    ...actual,
    default: function MockVenuePicker({ onSelectSavedVenue }: { onSelectSavedVenue?: (v: unknown) => void }) {
      return (
        <View testID="mock-venue-picker">
          {onSelectSavedVenue ? (
            <Pressable
              accessibilityLabel="Pick Saved Venue"
              onPress={() =>
                onSelectSavedVenue({ id: 'sv-1', name: 'Condo Court', postal_code: '123456', address: '1 Condo Road', lat: 1.3, lng: 103.8 })
              }
            >
              <Text>Pick Saved Venue</Text>
            </Pressable>
          ) : null}
        </View>
      );
    },
  };
});

const PICKED = { path: 'file:///tmp/banner.jpg', filename: 'banner.jpg', mime: 'image/jpeg' };

const typeTitle = async (root: Instance): Promise<void> => {
  await act(async () => {
    root
      .find(n => (n.type as unknown) === 'TextInput' && /e\.g\./.test(String(n.props.placeholder)))
      .props.onChangeText('Friday doubles');
  });
};

const pickBanner = async (root: Instance): Promise<void> => {
  let buttons: Array<{ text?: string; onPress?: () => void }> = [];
  const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, given) => {
    buttons = (given ?? []) as typeof buttons;
  });
  await press(root.findAll(n => n.props.testID === 'game-banner-upload' && typeof n.props.onPress === 'function')[0]);
  await act(async () => {
    buttons[2]?.onPress?.();
  });
  alert.mockRestore();
};

/** From step 2 to the Create button: public game, defaults elsewhere. */
const finish = async (root: Instance): Promise<void> => {
  await press(byLabel(root, 'Next')); // 2 -> 3
  await press(byLabel(root, 'Next')); // 3 -> 4
  await press(byLabel(root, 'Next')); // 4 -> 5
  await press(byLabel(root, 'Next')); // 5 -> 6
  await press(byLabel(root, 'Create Game'));
};

beforeEach(() => {
  jest.clearAllMocks();
  (getClientConfig as jest.Mock).mockResolvedValue({ venue_catalogue_enabled: false });
  (getGameLimits as jest.Mock).mockResolvedValue({ players_min: 2, players_max: 30 });
  (createEvent as jest.Mock).mockResolvedValue({ id: 'evt-new' });
  (uploadEventBanner as jest.Mock).mockResolvedValue({ banner_url: 'https://cdn.example/b.jpg' });
  (pickImage as jest.Mock).mockResolvedValue(PICKED);
});

describe('banner on Create game (NV-03)', () => {
  it('step 2 offers the optional banner field with the approved label', async () => {
    const root = await mountCreateGame();
    await press(byLabel(root, 'Next')); // 1 -> 2
    expect(root.findAll(n => n.props.testID === 'game-banner-field')).not.toHaveLength(0);
    expect(root.findAll(n => n.props.children === 'Banner (optional)').length).toBeGreaterThan(0);
  });

  it('no banner picked: the game is created and nothing is uploaded', async () => {
    const root = await mountCreateGame();
    await press(byLabel(root, 'Next'));
    await typeTitle(root);
    await finish(root);
    expect(createEvent).toHaveBeenCalledTimes(1);
    expect(uploadEventBanner).not.toHaveBeenCalled();
  });

  it('a picked banner is cropped 4:1 and uploaded after the create, under the same correlation id', async () => {
    const root = await mountCreateGame();
    await press(byLabel(root, 'Next'));
    await typeTitle(root);
    await pickBanner(root);
    expect(pickImage).toHaveBeenCalledWith('library', 'Crop banner', { width: 1600, height: 400 });
    await finish(root);

    expect(uploadEventBanner).toHaveBeenCalledWith(
      'evt-new',
      { uri: PICKED.path, name: PICKED.filename, type: PICKED.mime },
      { correlationId: expect.any(String) },
    );
    const createCid = (createEvent as jest.Mock).mock.calls[0][1].correlationId;
    expect((uploadEventBanner as jest.Mock).mock.calls[0][2].correlationId).toBe(createCid);
    expect((createEvent as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (uploadEventBanner as jest.Mock).mock.invocationCallOrder[0],
    );
  });

  it('a failed upload never undoes the creation: the completion still shows', async () => {
    (uploadEventBanner as jest.Mock).mockRejectedValue({ response: { status: 422, data: { detail: { code: 'IMAGE_INVALID' } } } });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const root = await mountCreateGame();
    await press(byLabel(root, 'Next'));
    await typeTitle(root);
    await pickBanner(root);
    await finish(root);
    expect(createEvent).toHaveBeenCalledTimes(1);
    expect(showCompletion).toHaveBeenCalledWith(expect.objectContaining({ flow: 'game_created' }));
  });

  it('Remove clears the picked banner before the create', async () => {
    const root = await mountCreateGame();
    await press(byLabel(root, 'Next'));
    await typeTitle(root);
    await pickBanner(root);
    await press(root.findAll(n => n.props.testID === 'game-banner-remove' && typeof n.props.onPress === 'function')[0]);
    await finish(root);
    expect(uploadEventBanner).not.toHaveBeenCalled();
  });
});

describe('My venues on Create game (NV-01)', () => {
  it('a saved venue pick is sent as saved_venue_id only', async () => {
    (getClientConfig as jest.Mock).mockResolvedValue({ venue_catalogue_enabled: true });
    const root = await mountCreateGame();
    await press(byLabel(root, 'Next')); // 1 -> 2
    await typeTitle(root);
    await press(byLabel(root, 'Next')); // 2 -> 3
    await press(byLabel(root, 'Pick Saved Venue'));
    await press(byLabel(root, 'Next')); // 3 -> 4
    await press(byLabel(root, 'Next')); // 4 -> 5
    await press(byLabel(root, 'Next')); // 5 -> 6
    await press(byLabel(root, 'Create Game'));

    expect(createEvent).toHaveBeenCalledTimes(1);
    const input = (createEvent as jest.Mock).mock.calls[0][0];
    expect(input.saved_venue_id).toBe('sv-1');
    expect(input).not.toHaveProperty('venue_id');
    expect(input).not.toHaveProperty('others');
    expect(input).not.toHaveProperty('venue_name');
  });
});
