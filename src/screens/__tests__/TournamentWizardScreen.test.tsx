/** Creation wizard (AD-20): the eight steps, one request, server errors on the right step, discard. */
import React from 'react';

import { getClientConfig } from '../../api/config';
import { getMyGroups } from '../../api/groups';
import { getSports } from '../../api/sports';
import { createWizardTournament, getWizardTemplates } from '../../api/tournaments';
import { searchUsers } from '../../api/users';
import { navigationRef } from '../../notifications/notificationRouting';
import { act, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { GROUP_TEMPLATE, TEMPLATES, createdResult } from '../../test-utils/tournamentWizardFixtures';
import type { WizardTemplatesResponse } from '../../types/tournamentWizard';
import TournamentWizardScreen from '../TournamentWizardScreen';

jest.mock('../../api/config', () => ({ getClientConfig: jest.fn() }));
jest.mock('../../api/sports', () => ({ getSports: jest.fn() }));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn() }));
jest.mock('../../api/users', () => ({ searchUsers: jest.fn() }));
jest.mock('../../api/tournaments', () => ({ createWizardTournament: jest.fn(), getWizardTemplates: jest.fn() }));
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
    await next(root); // 1 -> 2
  }
  if (target > 2) {
    await press(byTestId(root, `tw-format-${GROUP_TEMPLATE.id}`));
    await next(root); // 2 -> 3
  }
  if (target > 3) await next(root); // 3 -> 4
  if (target > 4) {
    await setDate(root, 'tw-starts', local(30, 9));
    await setDate(root, 'tw-ends', local(31, 18));
    await type(root, 'Venue name', 'Punggol Sports Hall');
    await next(root); // 4 -> 5
  }
  if (target > 5) {
    await setDate(root, 'tw-soft-block', local(10, 9));
    await setDate(root, 'tw-hard-block', local(14, 9));
    await next(root); // 5 -> 6
  }
  if (target > 6) {
    if (opts.privateGroups) {
      await press(byTestId(root, 'tw-vis-private'));
      await press(byTestId(root, 'group-invite-g1'));
      await press(byTestId(root, 'group-invite-g2'));
    }
    await next(root); // 6 -> 7
  }
  if (target > 7) {
    await press(byTestId(root, 'tw-committee-add'));
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    const row = root.findAll(n => n.props.testID === 'user-search-row' && String(n.props.accessibilityLabel).includes('Ravi'))[0];
    await press(row);
    await press(byLabel(root, 'Add 1 member'));
    await next(root); // 7 -> 8
  }
}

beforeEach(() => {
  jest.useFakeTimers();
  (getSports as jest.Mock).mockReset().mockResolvedValue([{ id: 's1', name: 'badminton', display_name: 'Badminton', icon_key: 'badminton', color: '#000' }]);
  (getMyGroups as jest.Mock).mockReset().mockResolvedValue({ items: [group('g1', 'Punggol Smashers'), group('g2', 'Weekend Warriors'), group('g3', 'Tue Tennis')], total: 3, page: 1, page_size: 20 });
  (getClientConfig as jest.Mock).mockReset().mockResolvedValue({ google_maps_api_key: null, venue_catalogue_enabled: false });
  (searchUsers as jest.Mock).mockReset().mockResolvedValue([RAVI]);
  (createWizardTournament as jest.Mock).mockReset().mockResolvedValue({ result: createdResult(), replayed: false });
  (getWizardTemplates as jest.Mock).mockReset().mockResolvedValue(TEMPLATES);
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
    expect(has(root, 'Choose a format')).toBe(true);
  });

  it('step 2 lists only the groups and knockout format; Next needs a choice', async () => {
    const root = await mount();
    await toStep(root, 2);
    expect(byTestId(root, `tw-format-${GROUP_TEMPLATE.id}`)).toBeDefined();
    expect(byTestId(root, 'tw-format-22222222-2222-4222-8222-222222222222')).toBeUndefined();
    await next(root);
    expect(has(root, 'Choose a format.')).toBe(true);
    await press(byTestId(root, `tw-format-${GROUP_TEMPLATE.id}`));
    await next(root);
    expect(has(root, 'Who plays?')).toBe(true);
  });

  it('step 2 with no template shows the empty board and cannot continue', async () => {
    const root = await mount({ templates: [] });
    await toStep(root, 2);
    expect(has(root, 'No formats for this sport')).toBe(true);
    expect(has(root, 'No formats are available for Badminton yet.')).toBe(true);
    expect(nextIsDisabled(root)).toBe(true);
  });

  it('step 3: counts start at the template and stay inside its limits; team mode shows the team rows', async () => {
    const root = await mount();
    await toStep(root, 3);
    expect(childText(root, 'tw-entrants-min-value')).toBe('8');
    await press(byTestId(root, 'tw-entrants-min-minus'));
    expect(childText(root, 'tw-entrants-min-value')).toBe('7');
    const team = root.findAll(n => n.props.accessibilityRole === 'tab' && n.props.accessibilityLabel === 'Tournament team')[0];
    await press(team);
    expect(has(root, 'Minimum team players')).toBe(true);
    expect(has(root, 'Minimum tournament teams')).toBe(true);
  });

  it('step 5 shows the board errors for the hard block (gap) and the soft block (order)', async () => {
    const root = await mount();
    await toStep(root, 5);
    await setDate(root, 'tw-soft-block', local(10, 9));
    await setDate(root, 'tw-hard-block', local(29, 9)); // 1 day before a start 30 days out: gap breach
    await next(root);
    expect(has(root, 'Hard block must be at least 3 days before the start')).toBe(true);
    expect(nextIsDisabled(root)).toBe(true);
    await setDate(root, 'tw-hard-block', local(35, 9)); // after the start
    expect(has(root, 'Hard block must be before the tournament starts.')).toBe(true);
    await setDate(root, 'tw-hard-block', local(14, 9));
    await setDate(root, 'tw-soft-block', local(20, 9)); // soft after hard
    expect(has(root, 'Soft block must be on or before the hard block.')).toBe(true);
  });

  it('the hard block follows the soft block until it is set', async () => {
    const root = await mount();
    await toStep(root, 5);
    await setDate(root, 'tw-soft-block', local(10, 9));
    const hard = root.findAll(n => n.props.testID === 'tw-hard-block' && typeof n.props.onChange === 'function')[0];
    expect(hard.props.value).toBe(local(10, 9));
  });

  it('step 6: private with groups, and the cap turns the other "+" off', async () => {
    const response = { ...TEMPLATES, limits: { ...TEMPLATES.limits!, audience_group_cap: 2 } };
    const root = await mount(response);
    await toStep(root, 6);
    await press(byTestId(root, 'tw-vis-private'));
    await press(byTestId(root, 'group-invite-g1'));
    await press(byTestId(root, 'group-invite-g2'));
    expect(childText(root, 'tw-group-count')).toContain('2 of 2');
    expect(has(root, 'A tournament can be shared with up to 2 groups in total')).toBe(true);
    const third = root.findAll(n => n.props.testID === 'group-invite-g3' && typeof n.props.onPress === 'function')[0];
    expect(third.props.disabled === true || third.props.accessibilityState?.disabled === true).toBe(true);
  });

  it('step 7 needs one more committee person; the organizer is pinned and the person added shows by name', async () => {
    const root = await mount();
    await toStep(root, 7);
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
    await toStep(root, 8, { privateGroups: true });
    expect(has(root, 'Punggol Open 2026')).toBe(true);
    expect(has(root, 'Private · 2 groups')).toBe(true);
    await press(byLabel(root, 'Create tournament'));
    expect(createWizardTournament).toHaveBeenCalledTimes(1);
    const [body, options] = (createWizardTournament as jest.Mock).mock.calls[0];
    expect(body).toMatchObject({
      template_id: GROUP_TEMPLATE.id,
      title: 'Punggol Open 2026',
      sport: 'badminton',
      participation_mode: 'individual',
      visibility: 'group',
      group_ids: ['g1', 'g2'],
      committee_member_ids: ['u-ravi'],
      venue_name: 'Punggol Sports Hall',
      overrides: {},
    });
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
    await toStep(root, 8);
    await press(byLabel(root, 'Create tournament'));
    expect(has(root, 'is live')).toBe(true);
  });

  it('a dropped connection keeps everything and a retry reuses the same client_request_id', async () => {
    (createWizardTournament as jest.Mock).mockRejectedValueOnce(new Error('Network Error'));
    const root = await mount();
    await toStep(root, 8);
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
    await toStep(root, 8);
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
    await toStep(root, 8);
    await press(byLabel(root, 'Create tournament'));
    expect(has(root, 'Registration dates')).toBe(true);
    expect(has(root, 'Hard block must be at least 3 days before the start')).toBe(true);
    const soft = root.findAll(n => n.props.testID === 'tw-soft-block' && typeof n.props.onChange === 'function')[0];
    expect(soft.props.value).toBe(local(10, 9));
  });

  it('COMMITTEE_INVALID USER_UNAVAILABLE returns to Committee and drops that person', async () => {
    (createWizardTournament as jest.Mock).mockRejectedValueOnce({
      response: { status: 422, data: { code: 'COMMITTEE_INVALID', reason: 'USER_UNAVAILABLE', user_id: 'u-ravi', step: 6 } },
    });
    const root = await mount();
    await toStep(root, 8);
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
    await toStep(root, 8, { privateGroups: true });
    await press(byLabel(root, 'Create tournament'));
    expect(has(root, 'Who can see it?')).toBe(true);
    expect(has(root, 'You are no longer in one of the selected groups.')).toBe(true);
    expect(childText(root, 'tw-group-count')).toContain('1 of 20');
  });

  it('a retired format returns to Format with the board message and refetches the list', async () => {
    (createWizardTournament as jest.Mock).mockRejectedValueOnce({ response: { status: 409, data: { code: 'TEMPLATE_NOT_ACTIVE', step: 5 } } });
    const root = await mount();
    await toStep(root, 8);
    await press(byLabel(root, 'Create tournament'));
    expect(has(root, 'Choose a format')).toBe(true);
    expect(has(root, 'The "Badminton groups knockout v4" format was retired while you were editing.')).toBe(true);
    expect(getWizardTemplates).toHaveBeenCalledTimes(1);
  });

  it('Edit on the review returns to that step with the entered state kept', async () => {
    const root = await mount();
    await toStep(root, 8);
    await press(byTestId(root, 'tw-review-edit-name'));
    expect(has(root, 'Tournament basics')).toBe(true);
    const field = root.find(n => (n.type as unknown) === 'TextInput' && n.props.accessibilityLabel === 'Tournament name');
    expect(field.props.value).toBe('Punggol Open 2026');
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
