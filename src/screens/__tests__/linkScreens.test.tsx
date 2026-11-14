/**
 * Game preview (signed out), game link (signed in) and group invitation landing (deep-links AD-8, AD-10).
 */
import React from 'react';

import { getEvent } from '../../api/events';
import { getPublicEventPreview, getPublicGroupInvitation } from '../../api/publicLinks';
import { perfLog } from '../../diagnostics/perfLog';
import { setPendingTarget, _resetLinkStoreForTesting } from '../../links/linkStore';
import { clearAccessNotice, isAccessNoticeShowing } from '../../navigation/accessNotice';
import { act, pressables, pressableWithText, renderAsync, texts } from '../../test-utils/render';
import GameLinkScreen from '../GameLinkScreen';
import GamePreviewScreen from '../GamePreviewScreen';
import GroupInviteScreen from '../GroupInviteScreen';

jest.mock('../../api/events', () => ({ getEvent: jest.fn() }));
jest.mock('../../api/publicLinks', () => ({
  getPublicEventPreview: jest.fn(),
  getPublicGroupInvitation: jest.fn(),
}));
jest.mock('../../diagnostics/perfLog', () => ({ perfLog: jest.fn() }));
jest.mock('../../utils/labels', () => ({ useSportDisplayName: (sport: string) => sport }));

const ID = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b';
const OTHER = '9a8b7c6d-1e2f-4a3b-8c4d-5e6f7a8b9c0d';
const PREVIEW = {
  sport: 'badminton',
  starts_at: '2026-12-01T10:00:00Z',
  ends_at: '2026-12-01T12:00:00Z',
  venue_name: 'Kallang Hall',
  capacity: 8,
  organizer_display_name: 'Asha',
  going_count: 3,
};

const nav = { navigate: jest.fn(), replace: jest.fn() };
const authProps = { navigation: nav } as unknown as React.ComponentProps<typeof GamePreviewScreen>;
const inviteProps = { navigation: nav } as unknown as React.ComponentProps<typeof GroupInviteScreen>;

beforeEach(() => {
  jest.clearAllMocks();
  _resetLinkStoreForTesting();
  clearAccessNotice();
});

describe('GamePreviewScreen (signed out)', () => {
  it('shows the 7 preview fields and two actions; Sign up and Log in keep the target', async () => {
    setPendingTarget({ kind: 'game', eventId: ID, ref: OTHER });
    (getPublicEventPreview as jest.Mock).mockResolvedValue(PREVIEW);
    const root = await renderAsync(<GamePreviewScreen {...authProps} />);

    expect(getPublicEventPreview).toHaveBeenCalledWith(ID, OTHER);
    const shown = texts(root).join(' | ');
    for (const part of ['badminton', 'Kallang Hall', 'Asha', '3 of 8 going']) {
      expect(shown).toContain(part);
    }
    await act(async () => pressableWithText(root, 'Sign up to join').props.onPress());
    expect(nav.navigate).toHaveBeenCalledWith('Register');
    await act(async () => pressableWithText(root, 'Already have an account? Log in').props.onPress());
    expect(nav.navigate).toHaveBeenCalledWith('Login');
  });

  it('a failed load shows a retry, and the two actions stay', async () => {
    setPendingTarget({ kind: 'game', eventId: ID });
    (getPublicEventPreview as jest.Mock).mockRejectedValue(new Error('x'));
    const root = await renderAsync(<GamePreviewScreen {...authProps} />);
    expect(texts(root)).toContain('This game could not be loaded.');
    expect(texts(root)).toContain('Sign up to join');
  });

  it('with no remembered target it goes to Login instead of showing anything', async () => {
    await renderAsync(<GamePreviewScreen {...authProps} />);
    expect(nav.navigate).toHaveBeenCalledWith('Login');
    expect(getPublicEventPreview).not.toHaveBeenCalled();
  });
});

describe('GameLinkScreen (signed in)', () => {
  const props = { navigation: nav, route: { params: { eventId: ID, ref: OTHER } } } as unknown as React.ComponentProps<
    typeof GameLinkScreen
  >;

  it('with access: opens EventDetailScreen through the normal authenticated call', async () => {
    (getEvent as jest.Mock).mockResolvedValue({ id: ID });
    await renderAsync(<GameLinkScreen {...props} />);
    expect(getEvent).toHaveBeenCalledWith(ID);
    expect(nav.replace).toHaveBeenCalledWith('EventDetail', { eventId: ID });
    expect(getPublicEventPreview).not.toHaveBeenCalled();
    expect(isAccessNoticeShowing()).toBe(false);
    expect(perfLog).toHaveBeenCalledWith('link_opened', { kind: 'game', platform: expect.any(String), outcome: 'opened_target' });
  });

  it.each([404, 403])('refused (%s): the public preview, the existing access notice and NO join action', async status => {
    (getEvent as jest.Mock).mockRejectedValue(Object.assign(new Error('x'), { response: { status } }));
    (getPublicEventPreview as jest.Mock).mockResolvedValue(PREVIEW);
    const root = await renderAsync(<GameLinkScreen {...props} />);

    expect(getPublicEventPreview).toHaveBeenCalledWith(ID, OTHER);
    expect(nav.replace).not.toHaveBeenCalled();
    expect(isAccessNoticeShowing()).toBe(true);
    expect(texts(root)).toContain('Kallang Hall');
    expect(pressables(root).filter(p => texts(p).some(text => /join|sign up/i.test(text)))).toHaveLength(0);
    expect(perfLog).toHaveBeenCalledWith('link_opened', { kind: 'game', platform: expect.any(String), outcome: 'not_available' });
  });

  it('a network or server error is a retry state, not an access refusal', async () => {
    (getEvent as jest.Mock).mockRejectedValue(new Error('Network Error'));
    const root = await renderAsync(<GameLinkScreen {...props} />);
    expect(isAccessNoticeShowing()).toBe(false);
    expect(getPublicEventPreview).not.toHaveBeenCalled();
    expect(texts(root)).toContain('This game could not be loaded.');
  });
});

describe('GroupInviteScreen (signed out)', () => {
  it('shows the group name from the public invitation, then Sign up and Log in', async () => {
    setPendingTarget({ kind: 'group_invite', token: ID });
    (getPublicGroupInvitation as jest.Mock).mockResolvedValue({ group_name: 'Sunday Smashers' });
    const root = await renderAsync(<GroupInviteScreen {...inviteProps} />);
    expect(getPublicGroupInvitation).toHaveBeenCalledWith(ID);
    expect(texts(root)).toContain('You are invited to join Sunday Smashers.');
    await act(async () => pressableWithText(root, 'Sign up to join').props.onPress());
    expect(nav.navigate).toHaveBeenCalledWith('Register');
  });

  it('an invalid token shows one neutral message and only Log in', async () => {
    setPendingTarget({ kind: 'group_invite', token: ID });
    (getPublicGroupInvitation as jest.Mock).mockRejectedValue(new Error('404'));
    const root = await renderAsync(<GroupInviteScreen {...inviteProps} />);
    expect(texts(root)).toContain('This invitation is not valid any more.');
    expect(texts(root)).not.toContain('Sign up to join');
    expect(texts(root)).toContain('Already have an account? Log in');
  });
});
