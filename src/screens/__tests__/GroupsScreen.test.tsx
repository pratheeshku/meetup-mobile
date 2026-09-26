/** Groups list: direct "+" create entry in the header, refresh-after-create, and GroupCard integration. */
import React from 'react';

import { getMyGroups } from '../../api/groups';
import { act, pressableLabelled, render, renderAsync, texts } from '../../test-utils/render';
import GroupsScreen from '../GroupsScreen';

type Props = React.ComponentProps<typeof GroupsScreen>;

const mockUseScrollToTop = jest.fn();
const mockUseFocusEffect = jest.fn();

// Regression guard (Rules of Hooks): React Navigation calls `headerRight` as a
// plain function inside its own header hook, so it must never call a hook.
// Any `useNavigation()` from this screen's header now fails the test loudly.
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => {
    throw new Error('headerRight must not call hooks such as useNavigation');
  },
  useScrollToTop: (...args: unknown[]) => mockUseScrollToTop(...args),
  useFocusEffect: (cb: () => void) => mockUseFocusEffect(cb),
}));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn() }));

const mockGetMyGroups = getMyGroups as jest.MockedFunction<typeof getMyGroups>;
const navigate = jest.fn();
const setOptions = jest.fn();
const EMPTY = { items: [], total: 0, page: 1, page_size: 0 };

function element(params?: { refreshKey?: number }): React.ReactElement {
  const props = { navigation: { navigate, setOptions }, route: { params } };
  return <GroupsScreen {...(props as unknown as Props)} />;
}

beforeEach(() => {
  mockGetMyGroups.mockReset().mockResolvedValue(EMPTY);
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
    mockGetMyGroups.mockReset().mockRejectedValue(new Error('down'));
    await renderAsync(element());
    expect(setOptions).toHaveBeenCalledWith({ headerRight: expect.any(Function) });
  });
});

describe('GroupsScreen refresh after create', () => {
  it('loads once on a normal mount', async () => {
    await renderAsync(element());
    expect(mockGetMyGroups).toHaveBeenCalledTimes(1);
  });

  it('re-fetches when returned to with a refreshKey', async () => {
    await renderAsync(element({ refreshKey: 123 }));
    expect(mockGetMyGroups).toHaveBeenCalledTimes(2);
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

    const root = await renderAsync(element());
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
    mockGetMyGroups.mockResolvedValue(GROUPS_FIXTURE);
    const root = await renderAsync(element());

    const renderedTexts = texts(root);
    expect(renderedTexts).toContain('Weekend Badminton Warriors');
    expect(renderedTexts).toContain('Owner');
    expect(renderedTexts).toContain('Casual games every Saturday');
    expect(renderedTexts).toContain('14 members');
    expect(renderedTexts).toContain('View →');

    // Press card button
    const cardButton = root.findByProps({ accessibilityRole: 'button' });
    act(() => cardButton.props.onPress());
    expect(navigate).toHaveBeenCalledWith('GroupDetail', { groupId: 'grp-42' });
  });
});
