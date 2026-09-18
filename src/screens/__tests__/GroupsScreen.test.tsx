/** Groups list: direct "+" create entry in the header, and refresh-after-create. */
import React from 'react';

import { getMyGroups } from '../../api/groups';
import { act, pressableLabelled, render, renderAsync } from '../../test-utils/render';
import GroupsScreen from '../GroupsScreen';

type Props = React.ComponentProps<typeof GroupsScreen>;

jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn() }));

const mockGetMyGroups = getMyGroups as jest.MockedFunction<typeof getMyGroups>;
const mockNavigate = jest.fn();
const navigate = mockNavigate;
const setOptions = jest.fn();
const EMPTY = { items: [], total: 0, page: 1, page_size: 0 };

function element(params?: { refreshKey?: number }): React.ReactElement {
  const props = { navigation: { navigate, setOptions }, route: { params } };
  return <GroupsScreen {...(props as unknown as Props)} />;
}

beforeEach(() => {
  mockGetMyGroups.mockReset().mockResolvedValue(EMPTY);
  navigate.mockReset();
  setOptions.mockReset();
});

describe('GroupsScreen create entry point', () => {
  it('puts a labelled "+" in the header that opens Create Group', async () => {
    await renderAsync(element());
    const { headerRight: HeaderRight } = setOptions.mock.calls[0][0];
    const button = render(<HeaderRight />);
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
