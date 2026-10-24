/**
 * Create-wizard polish (te-a4, AD-T13): group rows with their size, focus and scroll on every step change, one Venue
 * heading, the venue block like Create game (map preview, optional "Court or hall details" sent as `venue_detail`).
 * The real wizard runs; the API layer, the picker native module and the keyboard are doubles. Text fields are focused
 * through `ref.focus()` (the keyboard opens); date, choice and add fields get the ring and screen-reader focus and
 * nothing opens.
 */
import React from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import { getClientConfig } from '../../api/config';
import { getMyGroups } from '../../api/groups';
import { getSports } from '../../api/sports';
import { createWizardTournament } from '../../api/tournaments';
import { getVenues } from '../../api/venues';
import { searchUsers } from '../../api/users';
import { colors } from '../../theme/tokens';
import { act, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { TEMPLATES, createdResult } from '../../test-utils/tournamentWizardFixtures';
import TournamentWizardScreen from '../TournamentWizardScreen';

jest.mock('../../api/config', () => ({ getClientConfig: jest.fn() }));
jest.mock('../../api/sports', () => ({ getSports: jest.fn() }));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn() }));
jest.mock('../../api/users', () => ({ searchUsers: jest.fn() }));
jest.mock('../../api/venues', () => ({ getVenues: jest.fn(), createUserVenue: jest.fn() }));
jest.mock('../../api/tournaments', () => ({ createWizardTournament: jest.fn(), uploadTournamentImage: jest.fn() }));
jest.mock('../../utils/imagePicker', () => ({ pickImage: jest.fn(), isPickerCancelled: jest.fn(() => false) }));
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me', display_name: 'Pratheesh' } }) }));
jest.mock('../../notifications/notificationRouting', () => ({ navigationRef: { isReady: jest.fn(() => true), navigate: jest.fn() } }));

type Props = React.ComponentProps<typeof TournamentWizardScreen>;

const pad = (n: number): string => String(n).padStart(2, '0');
const local = (days: number, hour: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(hour)}:00`;
};
const group = (id: string, name: string, member_count: number | null) => ({ id, name, description: '', owner_id: 'me', created_at: '', member_count });
const RAVI = { id: 'u-ravi', display_name: 'Ravi K.', nickname: 'ravi', pending: false, in_my_groups: true, shared_group: 'x', shared_group_count: 1, has_group_info: true };

let renderers: ReactTestRenderer.ReactTestRenderer[] = [];
let setFocus: jest.SpyInstance;

/** The mocked RN component instance behind a testID (TextInput.focus is a jest.fn there). */
const focusOf = (root: Instance, testID: string): jest.Mock => {
  const hit = root.findAll(n => n.props.testID === testID && n.instance && typeof n.instance.focus === 'function')[0];
  if (!hit) throw new Error(`no focusable ${testID}`);
  return hit.instance.focus as jest.Mock;
};
const scrollOf = (root: Instance): jest.Mock => {
  const hit = root.findAll(n => n.instance && typeof n.instance.scrollTo === 'function')[0];
  if (!hit) throw new Error('no scroll view');
  return hit.instance.scrollTo as jest.Mock;
};

async function mount(): Promise<Instance> {
  const nav = { goBack: jest.fn(), popToTop: jest.fn(), dispatch: jest.fn(), addListener: jest.fn(() => () => undefined) };
  const props = { navigation: nav, route: { params: { templates: TEMPLATES } } } as unknown as Props;
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<TournamentWizardScreen {...props} />, {
      createNodeMock: () => ({ focus: jest.fn(), blur: jest.fn(), measureLayout: jest.fn(), setNativeProps: jest.fn() }),
    });
  });
  renderers.push(renderer);
  return renderer.root;
}

const byLabel = (root: Instance, label: string): Instance =>
  root.findAll(n => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
const byTestId = (root: Instance, id: string): Instance =>
  root.findAll(n => n.props.testID === id && typeof n.props.onPress === 'function')[0];
const press = async (node: Instance | undefined): Promise<void> => {
  if (!node) throw new Error('nothing to press');
  await act(async () => {
    node.props.onPress();
  });
};
const next = (root: Instance) => press(byLabel(root, 'Next'));
const back = (root: Instance) => press(root.findAll(n => n.props.testID === 'wizard-back' || n.props.accessibilityLabel === 'Back')[0]);
const type = async (root: Instance, label: string, value: string): Promise<void> => {
  const field = root.find(n => (n.type as unknown) === 'TextInput' && n.props.accessibilityLabel === label);
  await act(async () => field.props.onChangeText(value));
};
const setDate = async (root: Instance, testID: string, value: string): Promise<void> => {
  const field = root.findAll(n => n.props.testID === testID && typeof n.props.onChange === 'function')[0];
  await act(async () => field.props.onChange(value));
};
const has = (root: Instance, text: string): boolean => texts(root).some(x => x.includes(text));
const ringed = (root: Instance, testID: string): boolean =>
  root
    .findAll(n => n.props.testID === testID && typeof n.props.onPress === 'function')
    .some(node => {
      const style = typeof node.props.style === 'function' ? node.props.style({ pressed: false }) : node.props.style;
      return JSON.stringify(style ?? null).includes(`"borderColor":"${colors.primary}","borderWidth":2`);
    });
const pickerClosed = (root: Instance, testID: string): boolean =>
  root.findAll(n => n.props.testID === `${testID}-picker`).length === 0 &&
  root.findAll(n => n.props.visible === true && n.props.transparent === true).length === 0;

async function toWhen(root: Instance): Promise<void> {
  await type(root, 'Tournament name', 'Punggol Open 2026');
  await next(root);
  await next(root);
}
async function toRegistration(root: Instance, venueDetail?: string): Promise<void> {
  await toWhen(root);
  await setDate(root, 'tw-starts', local(30, 9));
  await setDate(root, 'tw-ends', local(31, 18));
  await type(root, 'Venue name', 'Punggol Sports Hall');
  if (venueDetail !== undefined) {
    await type(root, 'Court or hall details (optional)', venueDetail);
  }
  await next(root);
}

beforeEach(() => {
  jest.useFakeTimers();
  setFocus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus').mockImplementation(() => undefined);
  // `findNodeHandle` has no node under the test renderer: the deep module is the one `react-native` re-exports.
  // eslint-disable-next-line @react-native/no-deep-imports
  jest.spyOn(require('react-native/Libraries/ReactNative/RendererProxy'), 'findNodeHandle').mockReturnValue(7);
  (getSports as jest.Mock).mockReset().mockResolvedValue([{ id: 's1', name: 'badminton', display_name: 'Badminton', icon_key: 'badminton', color: '#000' }]);
  (getMyGroups as jest.Mock).mockReset().mockResolvedValue({
    items: [group('g1', 'Punggol Smashers', 10), group('g2', 'Weekend Warriors', 1), group('g3', 'Tue Tennis', null)],
    total: 3, page: 1, page_size: 20,
  });
  (getClientConfig as jest.Mock).mockReset().mockResolvedValue({ google_maps_api_key: null, venue_catalogue_enabled: false });
  (searchUsers as jest.Mock).mockReset().mockResolvedValue([RAVI]);
  (getVenues as jest.Mock).mockReset().mockResolvedValue({ items: [], next_cursor: null });
  (createWizardTournament as jest.Mock).mockReset().mockResolvedValue({ result: createdResult(), replayed: false });
});
afterEach(() => {
  ReactTestRenderer.act(() => {
    renderers.splice(0).forEach(renderer => renderer.unmount());
  });
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
  setFocus.mockRestore();
});

describe('group audience rows (AD-T13)', () => {
  it('read "Group name (10 members)", "(1 member)", and the name only when the count is not known', async () => {
    const root = await mount();
    await type(root, 'Tournament name', 'Cup');
    await next(root);
    await next(root);
    await setDate(root, 'tw-starts', local(30, 9));
    await setDate(root, 'tw-ends', local(31, 18));
    await type(root, 'Venue name', 'Hall');
    await next(root);
    await setDate(root, 'tw-soft-block', local(10, 9));
    await setDate(root, 'tw-hard-block', local(14, 9));
    await next(root);
    await press(byTestId(root, 'tw-vis-private'));
    const title = (id: string): string => ([] as unknown[]).concat(root.findAll(n => n.props.testID === `group-invite-title-${id}`)[0].props.children).join('');
    expect(title('g1')).toBe('Punggol Smashers (10 members)');
    expect(title('g2')).toBe('Weekend Warriors (1 member)');
    expect(title('g3')).toBe('Tue Tennis');
  });
});

describe('focus and scroll on every step change (AD-T13)', () => {
  it('When and where: the screen goes to the top and the start date gets the ring; no picker opens and the venue field is not focused', async () => {
    const root = await mount();
    await type(root, 'Tournament name', 'Punggol Open 2026');
    await next(root); // Participation
    const scroll = { scrollTo: scrollOf(root) };
    scroll.scrollTo.mockClear();
    setFocus.mockClear();
    await next(root); // When and where, "Step 3 of 6"
    expect(has(root, 'Step 3 of 6')).toBe(true);
    expect(scroll.scrollTo).toHaveBeenCalledWith({ y: 0, animated: false });
    expect(ringed(root, 'tw-starts')).toBe(true);
    expect(ringed(root, 'tw-ends')).toBe(false);
    expect(setFocus).toHaveBeenCalledTimes(1);
    expect(pickerClosed(root, 'tw-starts')).toBe(true);
    expect(focusOf(root, 'tw-venue-name')).not.toHaveBeenCalled();
    expect(focusOf(root, 'tw-venue-detail')).not.toHaveBeenCalled();
  });

  it('Basics: the name field is focused (keyboard) when coming back; Participation, Registration, Who can see it, Committee and Review each take their first field', async () => {
    const root = await mount();
    await type(root, 'Tournament name', 'Punggol Open 2026');
    await next(root);
    expect(root.findAll(n => n.props.accessibilityRole === 'tab' && n.props.accessibilityState?.selected === true && typeof n.props.style === 'function' && JSON.stringify(n.props.style({ pressed: false })).includes(colors.primary))).toHaveLength(1);
    await back(root);
    expect(focusOf(root, 'tw-title')).toHaveBeenCalled();
    await next(root);
    await next(root);
    await setDate(root, 'tw-starts', local(30, 9));
    await setDate(root, 'tw-ends', local(31, 18));
    await type(root, 'Venue name', 'Hall');
    await next(root); // Registration dates
    expect(ringed(root, 'tw-soft-block')).toBe(true);
    expect(ringed(root, 'tw-hard-block')).toBe(false);
    expect(pickerClosed(root, 'tw-soft-block')).toBe(true);
    await setDate(root, 'tw-soft-block', local(10, 9));
    await setDate(root, 'tw-hard-block', local(14, 9));
    await next(root); // Who can see it
    expect(ringed(root, 'tw-vis-public')).toBe(true);
    expect(ringed(root, 'tw-vis-private')).toBe(false);
    await next(root); // Committee
    expect(ringed(root, 'tw-committee-add')).toBe(true);
  });

  it('Next and Back both scroll to the top', async () => {
    const root = await mount();
    await type(root, 'Tournament name', 'Cup');
    const scroll = { scrollTo: scrollOf(root) };
    await next(root);
    await next(root);
    scroll.scrollTo.mockClear();
    await back(root);
    expect(scroll.scrollTo).toHaveBeenCalledWith({ y: 0, animated: false });
  });

  it('a step with an error focuses its first field with an error', async () => {
    const root = await mount();
    await next(root); // name missing
    expect(focusOf(root, 'tw-title')).toHaveBeenCalled();
    await type(root, 'Tournament name', 'Cup');
    await next(root);
    await next(root); // When and where
    await setDate(root, 'tw-starts', local(30, 9));
    // the end date is missing: the end date takes the ring, not the start date
    await next(root);
    expect(ringed(root, 'tw-ends')).toBe(true);
    expect(ringed(root, 'tw-starts')).toBe(false);
    // venue missing only: focus goes to the venue message, no picker opens
    await setDate(root, 'tw-ends', local(31, 18));
    setFocus.mockClear();
    await next(root);
    expect(has(root, 'Choose a venue')).toBe(true);
    expect(setFocus).toHaveBeenCalled();
  });
});

describe('the Venue block (AD-T13)', () => {
  it('shows one "Venue" heading with the shared picker (catalogue on), not a second label', async () => {
    (getClientConfig as jest.Mock).mockResolvedValue({ google_maps_api_key: null, venue_catalogue_enabled: true });
    const root = await mount();
    await toWhen(root);
    const headings = texts(root).filter(text => text === 'Venue');
    expect(headings).toHaveLength(1);
  });

  it('without the venue catalogue there is still exactly one "Venue" heading (the picker is not there to draw it)', async () => {
    const root = await mount();
    await toWhen(root);
    expect(texts(root).filter(text => text === 'Venue')).toHaveLength(1);
  });

  it('a chosen catalogue venue shows the picker\'s map preview (standard variant) and the court field; the search box does not grab the keyboard', async () => {
    (getClientConfig as jest.Mock).mockResolvedValue({ google_maps_api_key: null, venue_catalogue_enabled: true });
    (getSports as jest.Mock).mockResolvedValue([{ id: '11111111-1111-4111-8111-111111111111', name: 'badminton', display_name: 'Badminton', icon_key: 'badminton', color: '#000' }]);
    (getVenues as jest.Mock).mockResolvedValue({ items: [{ id: 'v1', provider: 'p', provider_venue_key: 'k', name: 'Punggol Sports Hall', block: '1', street: 'Punggol Way', lat: 1.4, lng: 103.9, status: 'active', source: 'catalogue' }], next_cursor: null });
    const root = await mount();
    await toWhen(root);
    const search = root.findAll(n => (n.type as unknown) === 'TextInput' && n.props.placeholder === 'Search venues')[0];
    expect(search?.props.autoFocus).toBe(false);
    await press(byLabel(root, 'Punggol Sports Hall'));
    expect(root.findAll(n => n.props.testID === 'venue-map-placeholder').length).toBeGreaterThan(0);
    expect(has(root, 'Court or hall details (optional)')).toBe(true);
  });

  it('"Court or hall details" is optional: omitted from the request when empty, trimmed and sent as venue_detail otherwise', async () => {
    const root = await mount();
    await toRegistration(root);
    expect(has(root, 'Registration dates')).toBe(true);
    const sendAt = async (r: Instance): Promise<Record<string, unknown>> => {
      await setDate(r, 'tw-soft-block', local(10, 9));
      await setDate(r, 'tw-hard-block', local(14, 9));
      await next(r);
      await next(r);
      await press(byTestId(r, 'tw-committee-add'));
      await act(async () => {
        jest.advanceTimersByTime(300);
      });
      const row = r.findAll(n => n.props.testID === 'user-search-row' && String(n.props.accessibilityLabel).includes('Ravi'))[0];
      await press(row);
      await press(byLabel(r, 'Add 1 member'));
      await next(r);
      await press(byTestId(r, 'tw-submit'));
      const calls = (createWizardTournament as jest.Mock).mock.calls;
      return calls[calls.length - 1][0] as Record<string, unknown>;
    };
    expect(await sendAt(root)).not.toHaveProperty('venue_detail');

    const second = await mount();
    await toRegistration(second, '  Court 2  ');
    const body = await sendAt(second);
    expect(body.venue_detail).toBe('Court 2');
    expect(body.venue_name).toBe('Punggol Sports Hall');
  });

  it('more than 100 characters is stopped on the field with the new text; the server code lands on the same field', async () => {
    const root = await mount();
    await toWhen(root);
    await setDate(root, 'tw-starts', local(30, 9));
    await setDate(root, 'tw-ends', local(31, 18));
    await type(root, 'Venue name', 'Hall');
    await type(root, 'Court or hall details (optional)', 'x'.repeat(101));
    expect(has(root, 'Keep it to 100 characters or fewer')).toBe(true);
    await type(root, 'Court or hall details (optional)', 'x'.repeat(100));
    expect(has(root, 'Keep it to 100 characters or fewer')).toBe(false);
  });

  it('VENUE_DETAIL_TOO_LONG from the server returns to When and where on that field', async () => {
    const root = await mount();
    await toRegistration(root, 'Court 2');
    await setDate(root, 'tw-soft-block', local(10, 9));
    await setDate(root, 'tw-hard-block', local(14, 9));
    await next(root);
    await next(root);
    await press(byTestId(root, 'tw-committee-add'));
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await press(root.findAll(n => n.props.testID === 'user-search-row' && String(n.props.accessibilityLabel).includes('Ravi'))[0]);
    await press(byLabel(root, 'Add 1 member'));
    await next(root);
    (createWizardTournament as jest.Mock).mockRejectedValueOnce({ response: { status: 422, data: { code: 'VENUE_DETAIL_TOO_LONG', field: 'venue_detail', reason: 'too_long', step: 1 } } });
    await press(byTestId(root, 'tw-submit'));
    expect(has(root, 'Step 3 of 6')).toBe(true);
    expect(has(root, 'Keep it to 100 characters or fewer')).toBe(true);
    expect(focusOf(root, 'tw-venue-detail')).toHaveBeenCalled();
  });

  it('Review shows the court or hall text after the venue name', async () => {
    const root = await mount();
    await toRegistration(root, 'Court 2');
    await setDate(root, 'tw-soft-block', local(10, 9));
    await setDate(root, 'tw-hard-block', local(14, 9));
    await next(root);
    await next(root);
    await press(byTestId(root, 'tw-committee-add'));
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await press(root.findAll(n => n.props.testID === 'user-search-row' && String(n.props.accessibilityLabel).includes('Ravi'))[0]);
    await press(byLabel(root, 'Add 1 member'));
    await next(root);
    expect(texts(root.findAll(n => n.props.testID === 'tw-review-window')[0]).join(' ')).toContain('Punggol Sports Hall, Court 2');
    expect(Platform.OS).toBeDefined();
  });
});
