/** Creation wizard (AD-20, AD-T3, AD-T4): seven screens counted as six steps, one request, banner and logo after create, server errors on the right screen, discard. */
import React from 'react';
import { Alert } from 'react-native';

import { getClientConfig } from '../../api/config';
import { getMyGroups } from '../../api/groups';
import { getSports } from '../../api/sports';
import { createWizardTournament, uploadTournamentImage } from '../../api/tournaments';
import { pickImage } from '../../utils/imagePicker';
import { searchUsers } from '../../api/users';
import { navigationRef } from '../../notifications/notificationRouting';
import { act, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { TEMPLATES, createdResult } from '../../test-utils/tournamentWizardFixtures';
import type { WizardTemplatesResponse } from '../../types/tournamentWizard';
import TournamentWizardScreen from '../TournamentWizardScreen';

jest.mock('../../api/config', () => ({ getClientConfig: jest.fn() }));
jest.mock('../../api/sports', () => ({ getSports: jest.fn() }));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn() }));
jest.mock('../../api/users', () => ({ searchUsers: jest.fn() }));
jest.mock('../../api/tournaments', () => ({ createWizardTournament: jest.fn(), uploadTournamentImage: jest.fn() }));
jest.mock('../../utils/imagePicker', () => ({ pickImage: jest.fn(), isPickerCancelled: jest.fn(() => false) }));
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me', display_name: 'Pratheesh' } }) }));
jest.mock('../../notifications/notificationRouting', () => ({
  navigationRef: { isReady: jest.fn(() => true), navigate: jest.fn() },
}));

type Props = React.ComponentProps<typeof TournamentWizardScreen>;

const RAVI = { id: 'u-ravi', display_name: 'Ravi K.', nickname: 'ravi', pending: false, in_my_groups: true, shared_group: 'Punggol Smashers', shared_group_count: 1, has_group_info: true };
const group = (id: string, name: string) => ({ id, name, description: '', owner_id: 'me', created_at: '', member_count: 9 });

let listeners: Record<string, (event: unknown) => void>;
let nav: { goBack: jest.Mock; popToTop: jest.Mock; dispatch: jest.Mock; addListener: jest.Mock };

const pad = (n: number): string => String(n).padStart(2, '0');
/** "YYYY-MM-DD HH:mm" in local time, `days` from now. */
const local = (days: number, hour: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(hour)}:00`;
};

async function mount(templates: WizardTemplatesResponse = TEMPLATES): Promise<Instance> {
  listeners = {};
  nav = {
    goBack: jest.fn(),
    popToTop: jest.fn(),
    dispatch: jest.fn(),
    addListener: jest.fn((event: string, cb: (e: unknown) => void) => {
      listeners[event] = cb;
      return () => undefined;
    }),
  };
  const props = { navigation: nav, route: { params: { templates } } };
  return renderAsync(<TournamentWizardScreen {...(props as unknown as Props)} />);
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
const type = async (root: Instance, label: string, value: string): Promise<void> => {
  const field = root.find(n => (n.type as unknown) === 'TextInput' && n.props.accessibilityLabel === label);
  await act(async () => field.props.onChangeText(value));
};
const setDate = async (root: Instance, testID: string, value: string): Promise<void> => {
  const field = root.findAll(n => n.props.testID === testID && typeof n.props.onChange === 'function')[0];
  await act(async () => field.props.onChange(value));
};
const nextIsDisabled = (root: Instance): boolean => byLabel(root, 'Next').props.disabled === true || byLabel(root, 'Next').props.accessibilityState?.disabled === true;
/** Text content of the first node with this testID (a Text node whose children are plain strings). */
const childText = (root: Instance, testID: string): string =>
  ([] as unknown[]).concat(root.findAll(n => n.props.testID === testID)[0].props.children).join('');
const has = (root: Instance, text: string): boolean => texts(root).some(x => x.includes(text));

async function toStep(root: Instance, target: number, opts: { privateGroups?: boolean } = {}): Promise<void> {
  if (target > 1) {
    await type(root, 'Tournament name', 'Punggol Open 2026');
    await next(root); // 1 Basics -> 2 Participation
  }
  if (target > 2) await next(root); // 2 -> 3 When and where
  if (target > 3) {
    await setDate(root, 'tw-starts', local(30, 9));
    await setDate(root, 'tw-ends', local(31, 18));
    await type(root, 'Venue name', 'Punggol Sports Hall');
    await next(root); // 3 -> 4 Registration dates
  }
  if (target > 4) {
    await setDate(root, 'tw-soft-block', local(10, 9));
    await setDate(root, 'tw-hard-block', local(14, 9));
    await next(root); // 4 -> 5 Who can see it
  }
  if (target > 5) {
    if (opts.privateGroups) {
      await press(byTestId(root, 'tw-vis-private'));
      await press(byTestId(root, 'group-invite-g1'));
      await press(byTestId(root, 'group-invite-g2'));
    }
    await next(root); // 5 -> 6 Committee
  }
  if (target > 6) {
    await press(byTestId(root, 'tw-committee-add'));
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    const row = root.findAll(n => n.props.testID === 'user-search-row' && String(n.props.accessibilityLabel).includes('Ravi'))[0];
    await press(row);
    await press(byLabel(root, 'Add 1 member'));
    await next(root); // 6 -> 7 Review
  }
}

const REVIEW = 7;

beforeEach(() => {
  jest.useFakeTimers();
  (getSports as jest.Mock).mockReset().mockResolvedValue([{ id: 's1', name: 'badminton', display_name: 'Badminton', icon_key: 'badminton', color: '#000' }]);
  (getMyGroups as jest.Mock).mockReset().mockResolvedValue({ items: [group('g1', 'Punggol Smashers'), group('g2', 'Weekend Warriors'), group('g3', 'Tue Tennis')], total: 3, page: 1, page_size: 20 });
  (getClientConfig as jest.Mock).mockReset().mockResolvedValue({ google_maps_api_key: null, venue_catalogue_enabled: false });
  (searchUsers as jest.Mock).mockReset().mockResolvedValue([RAVI]);
  (createWizardTournament as jest.Mock).mockReset().mockResolvedValue({ result: createdResult(), replayed: false });
  (uploadTournamentImage as jest.Mock).mockReset().mockResolvedValue({});
  (pickImage as jest.Mock).mockReset();
  (navigationRef.navigate as jest.Mock).mockReset();
});
afterEach(() => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

describe('steps and validation', () => {
  it('step 1 needs a name: Next shows the board error and stays disabled until it is fixed', async () => {
    const root = await mount();
    expect(has(root, 'Tournament basics')).toBe(true);
    await next(root);
    expect(has(root, 'Enter a name for the tournament.')).toBe(true);
    expect(nextIsDisabled(root)).toBe(true);
    await type(root, 'Tournament name', 'Punggol Open 2026');
    expect(has(root, 'Enter a name for the tournament.')).toBe(false);
    expect(nextIsDisabled(root)).toBe(false);
    await next(root);
    expect(has(root, 'Who plays?')).toBe(true);
  });

  it('the header counts the server steps: six, with both date screens being step 3', async () => {
    const root = await mount();
    expect(has(root, 'Step 1 of 6')).toBe(true);
    await toStep(root, 2);
    expect(has(root, 'Step 2 of 6')).toBe(true);
    await next(root); // When and where
    expect(has(root, 'Step 3 of 6')).toBe(true);
  });

  it('there is no Format step: Basics goes straight to Who plays, and no template is chosen anywhere', async () => {
    const root = await mount();
    await toStep(root, 2);
    expect(has(root, 'Choose a format')).toBe(false);
    expect(root.findAll(n => String(n.props.testID ?? '').startsWith('tw-format-'))).toHaveLength(0);
  });

  it('Who plays offers individual or team and no count fields (no overrides are sent)', async () => {
    const root = await mount();
    await toStep(root, 2);
    expect(root.findAll(n => String(n.props.testID ?? '').startsWith('tw-entrants-'))).toHaveLength(0);
    const team = root.findAll(n => n.props.accessibilityRole === 'tab' && n.props.accessibilityLabel === 'Tournament team')[0];
    await press(team);
    expect(has(root, 'Players create a tournament team when they register')).toBe(true);
  });

  it('Registration dates shows the board errors and rule checklist; a hard block exactly at the first game is accepted', async () => {
    const root = await mount();
    await toStep(root, 4);
    await setDate(root, 'tw-soft-block', local(10, 9));
    await setDate(root, 'tw-hard-block', local(35, 9)); // after the first game (30 days out)
    expect(has(root, 'Must be on or before the first game')).toBe(true);
    expect(root.findAll(n => n.props.testID === 'tw-rule-start-bad').length).toBeGreaterThan(0);
    expect(nextIsDisabled(root)).toBe(true);
    await setDate(root, 'tw-hard-block', local(30, 9)); // exactly the first game
    expect(has(root, 'Must be on or before the first game')).toBe(false);
    expect(root.findAll(n => n.props.testID === 'tw-rule-start-ok').length).toBeGreaterThan(0);
    expect(nextIsDisabled(root)).toBe(false);
    await setDate(root, 'tw-hard-block', local(29, 9)); // a day before: no minimum gap
    expect(nextIsDisabled(root)).toBe(false);
    await setDate(root, 'tw-hard-block', local(14, 9));
    await setDate(root, 'tw-soft-block', local(20, 9)); // soft after hard
    expect(has(root, 'Must be on or before the roster freeze.')).toBe(true);
    expect(root.findAll(n => n.props.testID === 'tw-rule-order-bad').length).toBeGreaterThan(0);
  });

  it('the hard block follows the soft block until it is set', async () => {
    const root = await mount();
    await toStep(root, 4);
    await setDate(root, 'tw-soft-block', local(10, 9));
    const hard = root.findAll(n => n.props.testID === 'tw-hard-block' && typeof n.props.onChange === 'function')[0];
    expect(hard.props.value).toBe(local(10, 9));
  });

  it('Who can see it: private with groups, and the cap turns the other "+" off', async () => {
    const response = { ...TEMPLATES, limits: { ...TEMPLATES.limits!, audience_group_cap: 2 } };
    const root = await mount(response);
    await toStep(root, 5);
    await press(byTestId(root, 'tw-vis-private'));
    await press(byTestId(root, 'group-invite-g1'));
    await press(byTestId(root, 'group-invite-g2'));
    expect(childText(root, 'tw-group-count')).toContain('2 of 2');
    expect(has(root, 'A tournament can be shared with up to 2 groups in total')).toBe(true);
    const third = root.findAll(n => n.props.testID === 'group-invite-g3' && typeof n.props.onPress === 'function')[0];
    expect(third.props.disabled === true || third.props.accessibilityState?.disabled === true).toBe(true);
  });

  it('Committee needs one more person; the organizer is pinned and the person added shows by name', async () => {
    const root = await mount();
    await toStep(root, 6);
    // TournCommitteeMin: the minimum error and a disabled Next are there on arrival.
    expect(has(root, 'A tournament needs at least 2 committee members. Add one more to continue.')).toBe(true);
    expect(nextIsDisabled(root)).toBe(true);
    expect(has(root, 'Organizer · counts as 1')).toBe(true);
    await press(byTestId(root, 'tw-committee-add'));
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await press(root.findAll(n => n.props.testID === 'user-search-row' && String(n.props.accessibilityLabel).includes('Ravi'))[0]);
    await press(byLabel(root, 'Add 1 member'));
    expect(has(root, 'Ravi K.')).toBe(true);
    expect(has(root, 'u-ravi')).toBe(false);
    await press(root.findAll(n => n.props.testID === 'tw-committee-remove-u-ravi' && typeof n.props.onPress === 'function')[0]);
    expect(has(root, 'Ravi K.')).toBe(false);
  });
});

describe('submit', () => {
  it('sends one request with the contract body and shows the Created screen; 201 and 200 are both success', async () => {
    const root = await mount();
    await toStep(root, REVIEW, { privateGroups: true });
    expect(has(root, 'Punggol Open 2026')).toBe(true);
    expect(has(root, 'Private · 2 groups')).toBe(true);
    await press(byLabel(root, 'Create tournament'));
    expect(createWizardTournament).toHaveBeenCalledTimes(1);
    const [body, options] = (createWizardTournament as jest.Mock).mock.calls[0];
    expect(body).toMatchObject({
      title: 'Punggol Open 2026',
      sport: 'badminton',
      participation_mode: 'individual',
      visibility: 'group',
      group_ids: ['g1', 'g2'],
      committee_member_ids: ['u-ravi'],
      venue_name: 'Punggol Sports Hall',
    });
    // AD-T3: neither is ever sent.
    expect(body).not.toHaveProperty('template_id');
    expect(body).not.toHaveProperty('overrides');
    expect(uploadTournamentImage).not.toHaveBeenCalled();
    expect(body.client_request_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(options.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(has(root, 'Punggol Open 2026 is live')).toBe(true);
    await press(byLabel(root, 'Open tournament'));
    expect(nav.popToTop).toHaveBeenCalled();
    expect(navigationRef.navigate).toHaveBeenCalledWith('Tournaments', expect.objectContaining({ params: { tournamentId: 'tour-1' } }));
  });

  it('a replay (200) is also success', async () => {
    (createWizardTournament as jest.Mock).mockResolvedValue({ result: createdResult(), replayed: true });
    const root = await mount();
    await toStep(root, REVIEW);
    await press(byLabel(root, 'Create tournament'));
    expect(has(root, 'is live')).toBe(true);
  });

  it('a dropped connection keeps everything and a retry reuses the same client_request_id', async () => {
    (createWizardTournament as jest.Mock).mockRejectedValueOnce(new Error('Network Error'));
    const root = await mount();
    await toStep(root, REVIEW);
    await press(byLabel(root, 'Create tournament'));
    expect(has(root, 'Could not create the tournament. Check your connection and retry.')).toBe(true);
    expect(has(root, 'Punggol Open 2026')).toBe(true);
    await press(byLabel(root, 'Create tournament'));
    const calls = (createWizardTournament as jest.Mock).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[1][0].client_request_id).toBe(calls[0][0].client_request_id);
    expect(calls[1][1].correlationId).not.toBe(calls[0][1].correlationId);
    expect(has(root, 'is live')).toBe(true);
  });

  it('a second tap while the request is in flight sends nothing', async () => {
    let finish: (v: unknown) => void = () => undefined;
    (createWizardTournament as jest.Mock).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const root = await mount();
    await toStep(root, REVIEW);
    const submit = byLabel(root, 'Create tournament');
    await act(async () => {
      submit.props.onPress();
      submit.props.onPress();
    });
    expect(createWizardTournament).toHaveBeenCalledTimes(1);
    await act(async () => finish({ result: createdResult(), replayed: false }));
  });

  it('TOURNAMENT_DATES_INVALID returns to Registration with the message and the state intact', async () => {
    (createWizardTournament as jest.Mock).mockRejectedValueOnce({
      response: { status: 422, data: { code: 'TOURNAMENT_DATES_INVALID', field: 'registration_hard_block_at', reason: 'HARD_BLOCK_TOO_CLOSE', step: 3 } },
    });
    const root = await mount();
    await toStep(root, REVIEW);
    await press(byLabel(root, 'Create tournament'));
    expect(has(root, 'Registration dates')).toBe(true);
    expect(has(root, 'Must be on or before the first game')).toBe(true);
    const soft = root.findAll(n => n.props.testID === 'tw-soft-block' && typeof n.props.onChange === 'function')[0];
    expect(soft.props.value).toBe(local(10, 9));
  });

  it('COMMITTEE_INVALID USER_UNAVAILABLE returns to Committee and drops that person', async () => {
    (createWizardTournament as jest.Mock).mockRejectedValueOnce({
      response: { status: 422, data: { code: 'COMMITTEE_INVALID', reason: 'USER_UNAVAILABLE', user_id: 'u-ravi', step: 5 } },
    });
    const root = await mount();
    await toStep(root, REVIEW);
    await press(byLabel(root, 'Create tournament'));
    expect(has(root, 'Committee')).toBe(true);
    expect(has(root, 'One of the people you added is not available any more.')).toBe(true);
    expect(has(root, 'Ravi K.')).toBe(false);
  });

  it('GROUP_NOT_MEMBER returns to the visibility step and drops that group', async () => {
    (createWizardTournament as jest.Mock).mockRejectedValueOnce({
      response: { status: 403, data: { code: 'GROUP_NOT_MEMBER', group_id: 'g2', step: 4 } },
    });
    const root = await mount();
    await toStep(root, REVIEW, { privateGroups: true });
    await press(byLabel(root, 'Create tournament'));
    expect(has(root, 'Who can see it?')).toBe(true);
    expect(has(root, 'You are no longer in one of the selected groups.')).toBe(true);
    expect(childText(root, 'tw-group-count')).toContain('1 of 20');
  });

  it('an inactive default format stays on Review with a message and the state intact (no Format step to return to)', async () => {
    (createWizardTournament as jest.Mock).mockRejectedValueOnce({
      response: { status: 409, data: { code: 'TEMPLATE_NOT_ACTIVE', field: 'template_id', step: 1 } },
    });
    const root = await mount();
    await toStep(root, REVIEW);
    await press(byLabel(root, 'Create tournament'));
    expect(has(root, 'Tournaments cannot be created right now. Please try again later.')).toBe(true);
    expect(has(root, 'Punggol Open 2026')).toBe(true);
    expect(has(root, 'Choose a format')).toBe(false);
  });

  it('Edit on the review returns to that step with the entered state kept', async () => {
    const root = await mount();
    await toStep(root, REVIEW);
    await press(byTestId(root, 'tw-review-edit-name'));
    expect(has(root, 'Tournament basics')).toBe(true);
    const field = root.find(n => (n.type as unknown) === 'TextInput' && n.props.accessibilityLabel === 'Tournament name');
    expect(field.props.value).toBe('Punggol Open 2026');
  });
});

describe('banner and logo (AD-T1)', () => {
  const picked = (name: string) => ({ path: `file:///tmp/${name}.jpg`, filename: `${name}.jpg`, mime: 'image/jpeg' });

  /** Presses an upload control, then the "Choose photo" button of the source alert. */
  async function choose(root: Instance, testID: string, image: ReturnType<typeof picked>): Promise<void> {
    (pickImage as jest.Mock).mockResolvedValueOnce(image);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find(button => button.text === 'Choose from library')?.onPress?.();
    });
    await press(byTestId(root, testID));
    alert.mockRestore();
  }

  it('picked pictures are uploaded after the create, with its correlation id, and the body carries no image', async () => {
    const root = await mount();
    await choose(root, 'tw-banner-upload', picked('banner'));
    await choose(root, 'tw-logo-upload', picked('logo'));
    expect(pickImage).toHaveBeenNthCalledWith(1, 'library', 'Crop banner', { width: 1600, height: 400 });
    expect(pickImage).toHaveBeenNthCalledWith(2, 'library', 'Crop logo', { width: 512, height: 512 });
    await toStep(root, REVIEW);
    await press(byLabel(root, 'Create tournament'));
    const [, createOptions] = (createWizardTournament as jest.Mock).mock.calls[0];
    expect((createWizardTournament as jest.Mock).mock.calls[0][0]).not.toHaveProperty('banner');
    expect(uploadTournamentImage).toHaveBeenCalledTimes(2);
    expect(uploadTournamentImage).toHaveBeenNthCalledWith(1, 'tour-1', 'banner', { uri: 'file:///tmp/banner.jpg', name: 'banner.jpg', type: 'image/jpeg' }, { correlationId: createOptions.correlationId });
    expect(uploadTournamentImage).toHaveBeenNthCalledWith(2, 'tour-1', 'logo', { uri: 'file:///tmp/logo.jpg', name: 'logo.jpg', type: 'image/jpeg' }, { correlationId: createOptions.correlationId });
    expect(has(root, 'is live')).toBe(true);
    expect(has(root, 'could not be uploaded')).toBe(false);
  });

  it('a failed upload never blocks the creation: the tournament is live and the organizer is told', async () => {
    (uploadTournamentImage as jest.Mock).mockRejectedValue({ response: { status: 422, data: { detail: { code: 'IMAGE_INVALID' } } } });
    const root = await mount();
    await choose(root, 'tw-banner-upload', picked('banner'));
    await toStep(root, REVIEW);
    await press(byLabel(root, 'Create tournament'));
    expect(has(root, 'is live')).toBe(true);
    expect(has(root, 'The tournament was created, but the banner or logo could not be uploaded.')).toBe(true);
    await press(byLabel(root, 'Open tournament'));
    expect(navigationRef.navigate).toHaveBeenCalledWith('Tournaments', expect.objectContaining({ params: { tournamentId: 'tour-1' } }));
  });

  it('Remove drops a picked banner; skipping both uploads nothing', async () => {
    const root = await mount();
    await choose(root, 'tw-banner-upload', picked('banner'));
    await press(byTestId(root, 'tw-banner-remove'));
    await toStep(root, REVIEW);
    await press(byLabel(root, 'Create tournament'));
    expect(uploadTournamentImage).not.toHaveBeenCalled();
  });
});

describe('discard (board TournDiscard)', () => {
  it('leaving a started wizard asks first; Keep editing stays, Discard leaves', async () => {
    const root = await mount();
    await type(root, 'Tournament name', 'Punggol Open 2026');
    const event = { preventDefault: jest.fn(), data: { action: { type: 'GO_BACK' } } };
    await act(async () => listeners.beforeRemove(event));
    expect(event.preventDefault).toHaveBeenCalled();
    expect(has(root, 'Discard this tournament?')).toBe(true);
    expect(has(root, 'Nothing has been created yet.')).toBe(true);
    await press(byLabel(root, 'Keep editing'));
    expect(nav.dispatch).not.toHaveBeenCalled();
    await act(async () => listeners.beforeRemove(event));
    await press(byLabel(root, 'Discard'));
    expect(nav.dispatch).toHaveBeenCalledWith({ type: 'GO_BACK' });
  });

  it('an untouched wizard leaves without asking', async () => {
    const root = await mount();
    expect(root).toBeDefined();
    const event = { preventDefault: jest.fn(), data: { action: { type: 'GO_BACK' } } };
    await act(async () => listeners.beforeRemove(event));
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});

describe('Remarks moved to the last input step (team-screens-remarks AD-4, D-2; TS-T13)', () => {
  const remarksInput = (root: Instance): Instance[] =>
    root.findAll(n => (n.type as unknown) === 'TextInput' && n.props.accessibilityLabel === 'Remarks');

  it('step 1 no longer has the description row; the Committee step (last input) has Remarks', async () => {
    const root = await mount();
    expect(remarksInput(root)).toHaveLength(0);
    await toStep(root, 6);
    expect(remarksInput(root)).toHaveLength(1);
    expect(remarksInput(root)[0].props.placeholder).toBe('Anything else players should know');
  });

  it('is optional: the wizard reaches the review without it and sends no description', async () => {
    const root = await mount();
    await toStep(root, REVIEW);
    await press(byLabel(root, 'Create tournament'));
    expect((createWizardTournament as jest.Mock).mock.calls[0][0]).not.toHaveProperty('description');
  });

  it('typed Remarks are sent trimmed as description', async () => {
    const root = await mount();
    await toStep(root, 6);
    await type(root, 'Remarks', '  Bring your own shuttles  ');
    await press(byTestId(root, 'tw-committee-add'));
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await press(root.findAll(n => n.props.testID === 'user-search-row' && String(n.props.accessibilityLabel).includes('Ravi'))[0]);
    await press(byLabel(root, 'Add 1 member'));
    await next(root);
    await press(byLabel(root, 'Create tournament'));
    expect((createWizardTournament as jest.Mock).mock.calls[0][0].description).toBe('Bring your own shuttles');
  });

  it('more than 5000 characters shows the length message under the field and holds Next', async () => {
    const root = await mount();
    await toStep(root, 6);
    await type(root, 'Remarks', 'x'.repeat(5001));
    expect(has(root, 'at most 5000 characters')).toBe(true);
    expect(nextIsDisabled(root)).toBe(true);
    await type(root, 'Remarks', 'x'.repeat(5000));
    expect(has(root, 'at most 5000 characters')).toBe(false);
  });
});
