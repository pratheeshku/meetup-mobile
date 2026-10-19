/**
 * `UserSearchPicker` (BUG-M01): debounced `GET /users/search`, dropdown of
 * matches, `onSelect(user)`. Only `api/users.ts` is mocked — debounce and
 * race-guard logic run for real, driven with fake timers.
 */
import React from 'react';
import { StyleSheet } from 'react-native';

import { searchUsers } from '../../api/users';
import { act, render, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import type { UserSearchResult } from '../../types/user';
import { MinusIcon, PlusIcon } from '../icons/ActionIcons';
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
  // Empty text loads the default list on mount (FEEDBACK-001 invite search).
  mockSearchUsers.mockResolvedValue([]);
});

afterEach(() => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

describe('query threshold and debounce', () => {
  it('searches for suggestions on mount with empty query', () => {
    render(<UserSearchPicker onSelect={jest.fn()} />);
    expect(mockSearchUsers).toHaveBeenCalledWith(
      { q: '', excludeGroupId: undefined, excludeEventId: undefined, excludeTeamId: undefined },
      expect.anything(),
    );
  });

  it('searches a one-character query after the debounce', async () => {
    const root = render(<UserSearchPicker onSelect={jest.fn()} />);
    await act(async () => {});
    mockSearchUsers.mockClear();
    type(root, 'a');
    await settle();
    expect(mockSearchUsers).toHaveBeenCalledTimes(1);
    expect(mockSearchUsers).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'a' }),
      expect.anything(),
    );
  });

  it('searches once 300ms after typing stops, not on every keystroke', async () => {
    const root = render(<UserSearchPicker onSelect={jest.fn()} />);
    await act(async () => {});
    mockSearchUsers.mockClear();
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

  it('shows "No matches" when the search comes back empty', async () => {
    mockSearchUsers.mockResolvedValue([]);
    const root = render(<UserSearchPicker onSelect={jest.fn()} />);
    type(root, 'zzz');
    await settle();
    expect(texts(root)).toContain('No matches');
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

    // The shared "+" control is the row's action; its name comes from the label system.
    const control = root.find(
      node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === 'Invite Sam Smith',
    );
    act(() => control.props.onPress());

    expect(onSelect).toHaveBeenCalledWith(USER);
    expect(searchInput(root).props.value).toBe('');
    expect(texts(root)).not.toContain('sam99');
  });

  it('shows the display name first and the nickname underneath, smaller, in every row', async () => {
    mockSearchUsers.mockResolvedValue([USER]);
    const root = render(<UserSearchPicker onSelect={jest.fn()} />);
    type(root, 'sam');
    await settle();

    const row = root.find(node => typeof node.type === 'string' && node.props.testID === 'user-search-row-body');
    const t = texts(row);
    expect(t.indexOf('Sam Smith')).toBeLessThan(t.indexOf('sam99'));
    const nameNode = row.find(n => (n.type as unknown) === 'Text' && n.props.children === 'Sam Smith');
    const nickNode = row.find(n => (n.type as unknown) === 'Text' && n.props.children === 'sam99');
    expect(StyleSheet.flatten(nickNode.props.style).fontSize as number).toBeLessThan(
      StyleSheet.flatten(nameNode.props.style).fontSize as number,
    );
  });

  it('invite variant: "+" button per row, uppercase-style section headings', async () => {
    mockSearchUsers.mockResolvedValue([
      { ...USER, has_group_info: true, in_my_groups: true },
      { ...USER, id: 'u-2', display_name: 'Rachel Ong', nickname: 'rachelo', has_group_info: true, in_my_groups: false },
    ]);
    const root = render(<UserSearchPicker variant="invite" suggestionContext="players" onSelect={jest.fn()} />);
    type(root, 'sam');
    await settle();

    const t = texts(root);
    expect(t).toContain('Suggested players');
    expect(t).toContain('Other players');
    expect(root.findAll(n => n.type === PlusIcon)).toHaveLength(2);
    expect(t).not.toContain('Invite');
  });

  it('shows a pending match as unselectable, labelled "Pending"', async () => {
    const pendingUser: UserSearchResult = { ...USER, pending: true };
    mockSearchUsers.mockResolvedValue([pendingUser]);
    const onSelect = jest.fn();
    const root = render(<UserSearchPicker onSelect={onSelect} excludeTeamId="t-1" />);
    type(root, 'sam');
    await settle();

    expect(texts(root)).toContain('Pending');
    // No "+" for a pending match: the status text stands in, and nothing can be selected.
    expect(root.findAll(node => node.props.testID === 'user-search-row')).toHaveLength(0);
    expect(root.findAll(n => n.type === PlusIcon)).toHaveLength(0);
    expect(
      root.findAll(node => node.props.accessibilityLabel === 'Sam Smith, sam99, already invited').length,
    ).toBeGreaterThan(0);
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('selection modes (AD-19)', () => {
  const control = (root: ReturnType<typeof render>) =>
    root.find(node => node.props.testID === 'user-search-row' && typeof node.props.onPress === 'function');

  it('staged: a staged person shows "−" and removing calls onUnstage without selecting', async () => {
    mockSearchUsers.mockResolvedValue([USER]);
    const onSelect = jest.fn();
    const onUnstage = jest.fn();
    const root = render(<UserSearchPicker onSelect={onSelect} stagedUserIds={['u-1']} onUnstage={onUnstage} />);
    type(root, 'sam');
    await settle();
    expect(root.findAll(n => n.type === MinusIcon)).toHaveLength(1);
    expect(root.findAll(n => n.type === PlusIcon)).toHaveLength(0);
    act(() => control(root).props.onPress());
    expect(onUnstage).toHaveBeenCalledWith(USER);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('immediate: the chip appears only after onSelect resolves, and a double tap selects once', async () => {
    mockSearchUsers.mockResolvedValue([USER]);
    let resolveSend!: () => void;
    const onSelect = jest.fn(() => new Promise<void>(resolve => (resolveSend = resolve)));
    const root = render(<UserSearchPicker onSelect={onSelect} selectionMode="immediate" />);
    type(root, 'sam');
    await settle();
    const press = control(root);
    act(() => {
      press.props.onPress();
      press.props.onPress();
    });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(texts(root)).not.toContain('Invited');
    await act(async () => {
      resolveSend();
    });
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('immediate: a failed send leaves the row on "+" with the error label', async () => {
    mockSearchUsers.mockResolvedValue([USER]);
    const onSelect = jest.fn().mockRejectedValue(new Error('boom'));
    const root = render(<UserSearchPicker onSelect={onSelect} selectionMode="immediate" />);
    type(root, 'sam');
    await settle();
    await act(async () => {
      control(root).props.onPress();
    });
    expect(root.findAll(n => n.type === PlusIcon)).toHaveLength(1);
    expect(texts(root)).toContain('Could not send the invitation. Try again.');
    expect(texts(root)).not.toContain('Invited');
  });
});

describe('stale-response guard', () => {
  it('a slow earlier search can never overwrite a newer one’s results', async () => {
    let resolveFirst!: (value: UserSearchResult[]) => void;
    const root = render(<UserSearchPicker onSelect={jest.fn()} />);
    await act(async () => {});
    mockSearchUsers.mockReturnValueOnce(new Promise(resolve => (resolveFirst = resolve)));

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

describe('email invite affordance (Decision 22 & 23)', () => {
  it('shows affordance when query is valid email, results empty, and onSelectEmail provided', async () => {
    mockSearchUsers.mockResolvedValue([]);
    const onSelectEmail = jest.fn();
    const root = render(<UserSearchPicker onSelect={jest.fn()} onSelectEmail={onSelectEmail} />);

    type(root, 'newuser@example.com');
    await settle();

    expect(texts(root)).not.toContain('No matches');
    expect(texts(root)).toContain('Invite newuser@example.com as new group member');
    expect(texts(root)).toContain('Send an email invitation to join');

    const emailRow = root.find(
      node =>
        node.props.accessibilityRole === 'button' &&
        node.props.accessibilityLabel === 'Invite newuser@example.com as new group member',
    );
    act(() => emailRow.props.onPress());

    expect(onSelectEmail).toHaveBeenCalledWith('newuser@example.com');
    expect(searchInput(root).props.value).toBe('');
  });

  it('uses custom entityLabel when provided', async () => {
    mockSearchUsers.mockResolvedValue([]);
    const root = render(
      <UserSearchPicker
        onSelect={jest.fn()}
        onSelectEmail={jest.fn()}
        entityLabel="participant"
      />,
    );

    type(root, 'player@example.com');
    await settle();

    expect(texts(root)).toContain('Invite player@example.com as new participant');
  });

  it('does NOT show affordance when query is an invalid email address', async () => {
    mockSearchUsers.mockResolvedValue([]);
    const root = render(<UserSearchPicker onSelect={jest.fn()} onSelectEmail={jest.fn()} />);

    type(root, 'not-an-email');
    await settle();

    expect(texts(root)).toContain('No matches');
    expect(texts(root)).not.toContain('Invite not-an-email as new group member');
  });

  it('does NOT show affordance when search returns matches (Decision 22: email not displayed in results)', async () => {
    mockSearchUsers.mockResolvedValue([USER]);
    const root = render(<UserSearchPicker onSelect={jest.fn()} onSelectEmail={jest.fn()} />);

    type(root, 'sam@example.com');
    await settle();

    // Matching user is shown with nickname and display name
    expect(texts(root)).toEqual(expect.arrayContaining(['sam99', 'Sam Smith']));
    // Affordance is NOT shown
    expect(texts(root)).not.toContain('Invite sam@example.com as new group member');
    // Matched email is NEVER displayed in results (Decision 22)
    expect(texts(root)).not.toContain('sam@example.com');
  });

  it('does NOT show affordance when onSelectEmail is not provided even if valid email and 0 results', async () => {
    mockSearchUsers.mockResolvedValue([]);
    const root = render(<UserSearchPicker onSelect={jest.fn()} />);

    type(root, 'alone@example.com');
    await settle();

    expect(texts(root)).toContain('No matches');
    expect(texts(root)).not.toContain('Invite alone@example.com as new group member');
  });

  it('renders without throwing when searchUsers resolves undefined', async () => {
    mockSearchUsers.mockResolvedValue(undefined as unknown as UserSearchResult[]);
    const root = render(<UserSearchPicker onSelect={jest.fn()} />);

    type(root, 'alex');
    await settle();

    expect(root).toBeDefined();
  });
});

