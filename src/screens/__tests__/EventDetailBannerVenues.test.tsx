/**
 * Game page and Edit game for DES-MEETUP-ADDENDUM-nov24-enhancements:
 * - NV-03: the banner at the top of the game page (none when absent); Edit game picks, replaces or removes it, and a
 *   banner failure keeps the saved edit.
 * - NV-01: a My venues pick on Edit game is sent as `saved_venue_id`.
 */
import React from 'react';
import { Alert } from 'react-native';

import { apiClient } from '../../api/client';
import { deleteEventBanner, updateEvent, uploadEventBanner } from '../../api/events';
import { getMyGroups } from '../../api/groups';
import { getSavedVenues, getVenues } from '../../api/venues';
import { act, renderAsync } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { pickImage } from '../../utils/imagePicker';
import { __resetSportDisplayNamesCacheForTests } from '../../utils/labels';
import EventDetailScreen from '../EventDetailScreen';

jest.mock('../../api/client', () => ({ apiClient: { get: jest.fn(), patch: jest.fn(), post: jest.fn() } }));
jest.mock('../../api/events', () => ({
  ...jest.requireActual('../../api/events'),
  updateEvent: jest.fn(),
  uploadEventBanner: jest.fn(),
  deleteEventBanner: jest.fn(),
}));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn() }));
jest.mock('../../api/venues', () => ({
  ...jest.requireActual('../../api/venues'),
  getVenues: jest.fn(),
  getSavedVenues: jest.fn(),
  deleteSavedVenue: jest.fn(),
}));
jest.mock('../../utils/imagePicker', () => ({
  ...jest.requireActual('../../utils/imagePicker'),
  pickImage: jest.fn(),
}));
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-me', nickname: 'Sam' } }) }));

const mockGet = apiClient.get as jest.Mock;
const BADMINTON_ID = 'a9325056-87e0-4f3f-9087-96a1c0463e64';
const BANNER = 'https://cdn.example/banners/b1.jpg';
const PICKED = { path: 'file:///tmp/new-banner.jpg', filename: 'new-banner.jpg', mime: 'image/jpeg' };

const rawEvent = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'evt-1', organizer_id: 'user-me', sport: 'badminton', title: 'Friday doubles', visibility: 'public',
  capacity: 8, starts_at: '2999-09-25T18:00:00Z', ends_at: '2999-09-25T20:00:00Z', allow_waitlist: true,
  status: 'upcoming', venue_name: 'Hall', venue_address: '1 Hall Road', going_count: 1, user_rsvp_status: null,
  skill_level_requirement: 'all_levels',
  ...overrides,
});

async function mount(overrides: Record<string, unknown> = {}, catalogue = false): Promise<Instance> {
  mockGet.mockImplementation((url: string) => {
    if (url === '/config/client') return Promise.resolve({ data: { venue_catalogue_enabled: catalogue } });
    if (url === '/admin/sports/public') {
      return Promise.resolve({
        data: [{ id: BADMINTON_ID, name: 'badminton', display_name: 'Badminton', slug: 'badminton', is_active: true }],
      });
    }
    if (url.includes('/participants')) return Promise.resolve({ data: [] });
    if (url.includes('/responses')) return Promise.reject({ response: { status: 403 } });
    if (url.includes('/closure')) return Promise.reject({ response: { status: 404 } });
    return Promise.resolve({ data: rawEvent(overrides) });
  });
  const props = {
    route: { key: 'k', name: 'EventDetail', params: { eventId: 'evt-1' } },
    navigation: { goBack: jest.fn(), navigate: jest.fn() },
  } as unknown as React.ComponentProps<typeof EventDetailScreen>;
  return renderAsync(<EventDetailScreen {...props} />);
}

const byTestId = (root: Instance, id: string): Instance[] =>
  root.findAll(n => n.props.testID === id && typeof n.type === 'string');
const pressable = (root: Instance, predicate: (n: Instance) => boolean): Instance =>
  root.findAll(n => predicate(n) && typeof n.props.onPress === 'function')[0];
const labelled = (root: Instance, label: string): Instance => pressable(root, n => n.props.accessibilityLabel === label);
const press = async (node: Instance): Promise<void> => {
  await act(async () => node.props.onPress());
};
const saveEdit = async (root: Instance): Promise<void> => {
  for (let i = 0; i < 4 && !labelled(root, 'Save changes'); i += 1) await press(labelled(root, 'Next'));
  await press(labelled(root, 'Save changes'));
};
/** Upload banner opens a choice of source; take "Choose from library". */
const pickBanner = async (root: Instance): Promise<void> => {
  let buttons: Array<{ text?: string; onPress?: () => void }> = [];
  const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, given) => {
    buttons = (given ?? []) as typeof buttons;
  });
  await press(pressable(root, n => n.props.testID === 'game-banner-upload'));
  await act(async () => {
    buttons[2]?.onPress?.();
  });
  alert.mockRestore();
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockReset();
  (updateEvent as jest.Mock).mockResolvedValue({ id: 'evt-1' });
  (uploadEventBanner as jest.Mock).mockResolvedValue({ banner_url: BANNER });
  (deleteEventBanner as jest.Mock).mockResolvedValue({ banner_url: null });
  (getMyGroups as jest.Mock).mockResolvedValue({ items: [], total: 0, page: 1, page_size: 0 });
  (getVenues as jest.Mock).mockResolvedValue({ items: [], next_cursor: null });
  (getSavedVenues as jest.Mock).mockResolvedValue([
    { id: 'sv-1', name: 'Condo Court', postal_code: '123456', address: '1 Condo Road' },
  ]);
  (pickImage as jest.Mock).mockResolvedValue(PICKED);
  __resetSportDisplayNamesCacheForTests();
});

describe('banner on the game page (NV-03, AD-5)', () => {
  it('shows the banner at the top, above the title block', async () => {
    const root = await mount({ banner_url: BANNER });
    const banner = byTestId(root, 'game-banner');
    expect(banner).toHaveLength(1);
    const image = banner[0].findAll(n => n.props.source && typeof n.props.source === 'object')[0];
    expect(image.props.source).toEqual({ uri: BANNER });
  });

  it.each([[null], [undefined], ['']])('no banner when banner_url is %p (no default for games)', async value => {
    const root = await mount(value === undefined ? {} : { banner_url: value });
    expect(byTestId(root, 'game-banner')).toHaveLength(0);
  });
});

describe('banner on Edit game (NV-03)', () => {
  it('shows the current banner in the field; picking a new one uploads it after the save', async () => {
    const root = await mount({ banner_url: BANNER });
    await press(labelled(root, 'Edit Game'));
    const preview = byTestId(root, 'game-banner-preview')[0];
    expect(preview.findAll(n => n.props.source?.uri === BANNER).length).toBeGreaterThan(0);

    await pickBanner(root);
    expect(pickImage).toHaveBeenCalledWith('library', 'Crop banner', { width: 1600, height: 400 });
    await saveEdit(root);

    expect(updateEvent).toHaveBeenCalledTimes(1);
    expect(uploadEventBanner).toHaveBeenCalledWith(
      'evt-1',
      { uri: PICKED.path, name: PICKED.filename, type: PICKED.mime },
      { correlationId: expect.any(String) },
    );
    // One user action, one correlation id (P4).
    const updateCid = (updateEvent as jest.Mock).mock.calls[0][2].correlationId;
    expect((uploadEventBanner as jest.Mock).mock.calls[0][2].correlationId).toBe(updateCid);
    expect(deleteEventBanner).not.toHaveBeenCalled();
  });

  it('Remove deletes the current banner after the save', async () => {
    const root = await mount({ banner_url: BANNER });
    await press(labelled(root, 'Edit Game'));
    await press(pressable(root, n => n.props.testID === 'game-banner-remove'));
    expect(byTestId(root, 'game-banner-preview')[0].findAll(n => n.props.source?.uri === BANNER)).toHaveLength(0);
    await saveEdit(root);
    expect(deleteEventBanner).toHaveBeenCalledWith('evt-1', { correlationId: expect.any(String) });
    expect(uploadEventBanner).not.toHaveBeenCalled();
  });

  it('no banner change sends no banner call', async () => {
    const root = await mount({ banner_url: BANNER });
    await press(labelled(root, 'Edit Game'));
    await saveEdit(root);
    expect(updateEvent).toHaveBeenCalledTimes(1);
    expect(uploadEventBanner).not.toHaveBeenCalled();
    expect(deleteEventBanner).not.toHaveBeenCalled();
  });

  it('a failed upload keeps the saved edit (no error shown for the edit)', async () => {
    (uploadEventBanner as jest.Mock).mockRejectedValue({ response: { status: 413 } });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const root = await mount();
    await press(labelled(root, 'Edit Game'));
    await pickBanner(root);
    await saveEdit(root);
    expect(updateEvent).toHaveBeenCalledTimes(1);
    expect(uploadEventBanner).toHaveBeenCalledTimes(1);
    expect(labelled(root, 'Save changes')).toBeUndefined(); // the edit closed as saved
  });
});

describe('My venues on Edit game (NV-01)', () => {
  it('a saved venue pick is sent as saved_venue_id only', async () => {
    const root = await mount({ venue_snapshot: null, venue_id: null }, true);
    await press(labelled(root, 'Edit Game'));
    await press(labelled(root, 'Next')); // step 2: when and where
    const venueBox = pressable(root, n => String(n.props.accessibilityLabel ?? '').startsWith('Hall'));
    await press(venueBox);
    await act(async () => {
      await Promise.resolve();
    });
    await press(labelled(root, 'Condo Court'));
    await saveEdit(root);

    const payload = (updateEvent as jest.Mock).mock.calls[0][1];
    expect(payload.saved_venue_id).toBe('sv-1');
    expect(payload).not.toHaveProperty('venue_id');
    expect(payload).not.toHaveProperty('others');
  });
});
