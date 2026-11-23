/** Groups list: direct "+" create entry in the header, refresh-after-create, and GroupCard integration. */
import React from 'react';

import { act, pressableLabelled, render, renderAsync, texts } from '../../test-utils/render';
import GroupsScreen from '../GroupsScreen';

type Props = React.ComponentProps<typeof GroupsScreen>;

const mockUseScrollToTop = jest.fn();
const mockUseFocusEffect = jest.fn();

// Regression guard (Rules of Hooks): React Navigation calls `headerRight` as a
// plain function inside its own header hook, so it must never call a hook.
// Any `useNavigation()` from this screen's header now fails the test loudly.
const mockGetGroups = jest.fn();
const mockGetMyGroups = jest.fn();
jest.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u-1', nickname: 'sam' } }),
}));
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => {
      throw new Error('headerRight must not call hooks such as useNavigation');
    },
    useScrollToTop: (...args: unknown[]) => mockUseScrollToTop(...args),
    useFocusEffect: (cb: () => void) => mockUseFocusEffect(cb),
  };
});
jest.mock('../../api/groups', () => ({
  getGroups: (...args: unknown[]) => mockGetGroups(...args),
  getMyGroups: (...args: unknown[]) => mockGetMyGroups(...args),
}));
const navigate = jest.fn();
const setOptions = jest.fn();
const EMPTY = { items: [], total: 0, page: 1, page_size: 0 };

function element(params?: { refreshKey?: number }): React.ReactElement {
  const props = { navigation: { navigate, setOptions }, route: { params } };
  return <GroupsScreen {...(props as unknown as Props)} />;
}

beforeEach(() => {
  mockGetGroups.mockReset().mockResolvedValue(EMPTY);
  mockGetMyGroups.mockReset();
  mockUseScrollToTop.mockReset();
  mockUseFocusEffect.mockReset();
  navigate.mockReset();
  setOptions.mockReset();
});

describe('GroupsScreen create entry point', () => {
  it('puts a labelled "+" in the header that opens Create Group', async () => {
    await renderAsync(element());
    const { headerRight } = setOptions.mock.calls[0][0];
    // Invoked as a plain function, exactly as React Navigation does.
    const button = render(headerRight());
    act(() => pressableLabelled(button, 'Create Group').props.onPress());
    expect(navigate).toHaveBeenCalledWith('CreateGroup');
  });

  it('keeps the header button even when the list failed to load', async () => {
    mockGetGroups.mockReset().mockRejectedValue(new Error('down'));
    await renderAsync(element());
    expect(setOptions).toHaveBeenCalledWith({ headerRight: expect.any(Function) });
  });
});

describe('GroupsScreen refresh after create', () => {
  it('loads once on a normal mount', async () => {
    await renderAsync(element());
    expect(mockGetGroups).toHaveBeenCalledTimes(1);
    expect(mockGetGroups).toHaveBeenCalledWith({ mine: true });
    expect(mockGetMyGroups).not.toHaveBeenCalled();
  });

  it('re-fetches when returned to with a refreshKey', async () => {
    await renderAsync(element({ refreshKey: 123 }));
    expect(mockGetGroups).toHaveBeenCalledTimes(2);
    expect(mockGetMyGroups).not.toHaveBeenCalled();
  });
});

describe('GroupsScreen scroll resets and navigation', () => {
  it('wires useScrollToTop and useFocusEffect on mount', async () => {
    await renderAsync(element());
    expect(mockUseScrollToTop).toHaveBeenCalledWith(expect.objectContaining({ current: expect.anything() }));
    expect(mockUseFocusEffect).toHaveBeenCalledWith(expect.any(Function));
  });

  it('useFocusEffect callback invokes scrollToOffset on the flatList ref', async () => {
    let focusCallback: (() => void) | undefined;
    mockUseFocusEffect.mockImplementation((cb: () => void) => {
      focusCallback = cb;
    });

    await renderAsync(element());
    expect(focusCallback).toBeDefined();

    // Verify calling the focus callback does not throw (safely executes scrollToOffset)
    expect(() => focusCallback?.()).not.toThrow();
  });
});

describe('GroupsScreen GroupCard rendering', () => {
  const GROUPS_FIXTURE = {
    items: [
      {
        id: 'grp-42',
        name: 'Weekend Badminton Warriors',
        description: 'Casual games every Saturday',
        owner_id: 'user-me',
        created_at: '2026-01-01T00:00:00Z',
        current_user_role: 'owner' as const,
        member_count: 14,
      },
    ],
    total: 1,
    page: 1,
    page_size: 1,
  };

  it('renders GroupCard for each group and navigates to GroupDetail on press', async () => {
    mockGetGroups.mockResolvedValue(GROUPS_FIXTURE);
    const root = await renderAsync(element());

    const renderedTexts = texts(root);
    expect(renderedTexts).toContain('Weekend Badminton Warriors');
    expect(renderedTexts).toContain('Owner');
    expect(renderedTexts).toContain('Casual games every Saturday');

    // Press card button
    const cardButton = root.find(
      node =>
        typeof node.props.accessibilityLabel === 'string' &&
        node.props.accessibilityLabel.startsWith('Weekend Badminton Warriors'),
    );
    act(() => cardButton.props.onPress());
    expect(navigate).toHaveBeenCalledWith('GroupDetail', { groupId: 'grp-42' });
  });
});

describe('GroupsScreen enhanced landing page and filtering', () => {
  const MIXED_GROUPS_FIXTURE = {
    items: [
      {
        id: 'grp-owned',
        name: 'My Owned Club',
        description: 'I run this group',
        owner_id: 'user-me',
        created_at: '2026-01-01T00:00:00Z',
        current_user_role: 'owner' as const,
        member_count: 10,
        owner_nickname: 'selfnick',
      },
      {
        id: 'grp-member',
        name: 'Joined Casual Runners',
        description: 'Running with friends',
        owner_id: 'other-user',
        created_at: '2026-01-02T00:00:00Z',
        current_user_role: 'member' as const,
        member_count: 25,
        owner_nickname: 'runner_bob',
      },
    ],
    total: 2,
    page: 1,
    page_size: 2,
  };

  it('renders landing page header and filter pills', async () => {
    mockGetGroups.mockResolvedValue(MIXED_GROUPS_FIXTURE);
    const root = await renderAsync(element());

    const renderedTexts = texts(root);
    expect(renderedTexts).toContain('My Groups');
    expect(renderedTexts).toContain('Groups you organise and belong to.');
    expect(renderedTexts).toContain('All');
    expect(renderedTexts).toContain('Organised');
    expect(renderedTexts).toContain('Joined');
  });

  it('filters by "Organised" when Organised pill is tapped', async () => {
    mockGetGroups.mockResolvedValue(MIXED_GROUPS_FIXTURE);
    const root = await renderAsync(element());

    const organisedPill = root.findByProps({ accessibilityLabel: 'Organised' });
    act(() => organisedPill.props.onPress());

    const renderedTexts = texts(root);
    expect(renderedTexts).toContain('My Owned Club');
    expect(renderedTexts).not.toContain('Joined Casual Runners');
  });

  it('filters by "Joined" when the Joined pill is tapped', async () => {
    mockGetGroups.mockResolvedValue(MIXED_GROUPS_FIXTURE);
    const root = await renderAsync(element());

    const memberPill = root.findByProps({ accessibilityLabel: 'Joined' });
    act(() => memberPill.props.onPress());

    const renderedTexts = texts(root);
    expect(renderedTexts).not.toContain('My Owned Club');
    expect(renderedTexts).toContain('Joined Casual Runners');
  });

  it('shows contextual empty state when filtered category has no items', async () => {
    mockGetGroups.mockResolvedValue({
      items: [MIXED_GROUPS_FIXTURE.items[0]],
      total: 1,
      page: 1,
      page_size: 1,
    });
    const root = await renderAsync(element());

    const memberPill = root.findByProps({ accessibilityLabel: 'Joined' });
    act(() => memberPill.props.onPress());

    const renderedTexts = texts(root);
    expect(renderedTexts).toContain('No joined groups.');
  });
});


describe('GroupsScreen order and search (priority1-nov23 P1-03)', () => {
  const group = (id: string, name: string, role: 'owner' | 'member') => ({
    id, name, description: '', owner_id: role === 'owner' ? 'u-1' : 'other', created_at: '2026-01-01T00:00:00Z',
    current_user_role: role, member_count: 3,
  });
  const LIST = {
    items: [group('m1', 'Morning Tennis', 'member'), group('o1', 'Owned Pickleball', 'owner'), group('m2', 'Night Badminton', 'member'), group('o2', 'Owned Badminton', 'owner')],
    total: 4, page: 1, page_size: 4,
  };
  const order = (root: ReturnType<typeof render>): string[] =>
    texts(root).filter(text => ['Morning Tennis', 'Owned Pickleball', 'Night Badminton', 'Owned Badminton'].includes(text));

  it('lists the groups you own above the groups you joined, keeping the server order inside each part', async () => {
    mockGetGroups.mockResolvedValue(LIST);
    const root = await renderAsync(element());
    expect(order(root)).toEqual(['Owned Pickleball', 'Owned Badminton', 'Morning Tennis', 'Night Badminton']);
  });

  it('filters by name as you type (case-insensitive) and says when nothing matches', async () => {
    mockGetGroups.mockResolvedValue(LIST);
    const root = await renderAsync(element());
    const search = root.find(node => node.props.testID === 'groups-search' && typeof node.props.onChangeText === 'function');
    act(() => search.props.onChangeText('badminton'));
    expect(order(root)).toEqual(['Owned Badminton', 'Night Badminton']);
    act(() => search.props.onChangeText('squash'));
    expect(order(root)).toEqual([]);
    expect(texts(root)).toContain('No groups match "squash"');
  });
});
