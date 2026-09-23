/**
 * `UserSearchPicker` (BUG-M01): debounced `GET /users/search`, dropdown of
 * matches, `onSelect(user)`. Only `api/users.ts` is mocked — debounce and
 * race-guard logic run for real, driven with fake timers.
 */
import React from 'react';

import { searchUsers } from '../../api/users';
import { act, render, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import type { UserSearchResult } from '../../types/user';
import UserSearchPicker from '../UserSearchPicker';

jest.mock('../../api/users', () => ({ searchUsers: jest.fn() }));

const mockSearchUsers = searchUsers as jest.MockedFunction<typeof searchUsers>;

const DEBOUNCE_MS = 300;

function searchInput(root: Instance): Instance {
  return root.find(
    node => (node.type as unknown) === 'TextInput' && node.props.accessibilityLabel === 'Search users',
  );
}

function type(root: Instance, value: string): void {
  act(() => {
    searchInput(root).props.onChangeText(value);
  });
}

/** Advances past the debounce window and flushes the resulting promise chain. */
async function settle(): Promise<void> {
  await act(async () => {
    jest.advanceTimersByTime(DEBOUNCE_MS);
  });
}

const USER: UserSearchResult = {
  id: 'u-1',
  display_name: 'Sam Smith',
  nickname: 'sam99',
  pending: false,
};

beforeEach(() => {
  jest.useFakeTimers();
  mockSearchUsers.mockReset();
});

afterEach(() => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

describe('query threshold and debounce', () => {
  it('does not search below 2 characters', () => {
    const root = render(<UserSearchPicker onSelect={jest.fn()} />);
    type(root, 'a');
    act(() => jest.advanceTimersByTime(DEBOUNCE_MS));
    expect(mockSearchUsers).not.toHaveBeenCalled();
  });

  it('searches once 300ms after typing stops, not on every keystroke', async () => {
    mockSearchUsers.mockResolvedValue([]);
    const root = render(<UserSearchPicker onSelect={jest.fn()} />);
    type(root, 'sa');
    act(() => jest.advanceTimersByTime(DEBOUNCE_MS - 50));
    type(root, 'sam');
    await settle();
    expect(mockSearchUsers).toHaveBeenCalledTimes(1);
    expect(mockSearchUsers).toHaveBeenCalledWith(
      { q: 'sam', excludeGroupId: undefined, excludeEventId: undefined, excludeTeamId: undefined },
      expect.anything(),
    );
  });

  it('passes the exclude*Id props through unchanged (generic, not group-specific)', async () => {
    mockSearchUsers.mockResolvedValue([]);
    const root = render(
      <UserSearchPicker onSelect={jest.fn()} excludeGroupId="g-1" excludeTeamId="t-1" />,
    );
    type(root, 'sam');
    await settle();
    expect(mockSearchUsers).toHaveBeenCalledWith(
      { q: 'sam', excludeGroupId: 'g-1', excludeEventId: undefined, excludeTeamId: 't-1' },
      expect.anything(),
    );
  });
});

describe('results', () => {
  it('shows nickname and display name for each match', async () => {
    mockSearchUsers.mockResolvedValue([USER]);
    const root = render(<UserSearchPicker onSelect={jest.fn()} />);
    type(root, 'sam');
    await settle();
    expect(texts(root)).toEqual(expect.arrayContaining(['sam99', 'Sam Smith']));
  });

  it('shows "No users found." when the search comes back empty', async () => {
    mockSearchUsers.mockResolvedValue([]);
    const root = render(<UserSearchPicker onSelect={jest.fn()} />);
    type(root, 'zzz');
    await settle();
    expect(texts(root)).toContain('No users found.');
  });

  it('shows an error message when the search fails', async () => {
    mockSearchUsers.mockRejectedValue(new Error('network'));
    const root = render(<UserSearchPicker onSelect={jest.fn()} />);
    type(root, 'sam');
    await settle();
    expect(texts(root)).toContain('Could not search for users. Please try again.');
  });

  it('selecting a result calls onSelect and clears the query and results', async () => {
    mockSearchUsers.mockResolvedValue([USER]);
    const onSelect = jest.fn();
    const root = render(<UserSearchPicker onSelect={onSelect} />);
    type(root, 'sam');
    await settle();

    const row = root.find(
      node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === 'sam99, Sam Smith',
    );
    act(() => row.props.onPress());

    expect(onSelect).toHaveBeenCalledWith(USER);
    expect(searchInput(root).props.value).toBe('');
    expect(texts(root)).not.toContain('sam99');
  });

  it('shows a pending match as unselectable, labelled "Pending"', async () => {
    const pendingUser: UserSearchResult = { ...USER, pending: true };
    mockSearchUsers.mockResolvedValue([pendingUser]);
    const onSelect = jest.fn();
    const root = render(<UserSearchPicker onSelect={onSelect} excludeTeamId="t-1" />);
    type(root, 'sam');
    await settle();

    expect(texts(root)).toContain('Pending');
    const row = root.find(
      node =>
        node.props.accessibilityRole === 'button' &&
        node.props.accessibilityLabel === 'sam99, Sam Smith, already invited',
    );
    expect(row.props.accessibilityState).toEqual({ disabled: true });
    act(() => row.props.onPress());
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('stale-response guard', () => {
  it('a slow earlier search can never overwrite a newer one’s results', async () => {
    let resolveFirst!: (value: UserSearchResult[]) => void;
    mockSearchUsers.mockReturnValueOnce(new Promise(resolve => (resolveFirst = resolve)));
    const root = render(<UserSearchPicker onSelect={jest.fn()} />);

    type(root, 'aa');
    await act(async () => {
      jest.advanceTimersByTime(DEBOUNCE_MS);
    });

    mockSearchUsers.mockResolvedValueOnce([USER]);
    type(root, 'bb');
    await settle();
    expect(texts(root)).toContain('sam99');

    await act(async () => {
      resolveFirst([{ ...USER, id: 'stale', nickname: 'stale-user', display_name: 'Stale User' }]);
    });
    expect(texts(root)).not.toContain('stale-user');
    expect(texts(root)).toContain('sam99');
  });
});
