/**
 * Create Group / Tournament Team screen tests — Players Group mode uses
 * POST /groups, Tournament Team mode uses POST /teams with sport and
 * visibility. API, sports and navigation are mocked.
 */
import React from 'react';

import { createGroup } from '../../api/groups';
import { getSports } from '../../api/sports';
import { createTeam } from '../../api/teams';
import { act, pressableLabelled, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import CreateGroupScreen from '../CreateGroupScreen';

type Props = React.ComponentProps<typeof CreateGroupScreen>;

jest.mock('../../api/groups', () => ({ createGroup: jest.fn() }));
jest.mock('../../api/sports', () => ({ getSports: jest.fn() }));
jest.mock('../../api/teams', () => ({ createTeam: jest.fn() }));

const mockCreateGroup = createGroup as jest.MockedFunction<typeof createGroup>;
const mockGetSports = getSports as jest.MockedFunction<typeof getSports>;
const mockCreateTeam = createTeam as jest.MockedFunction<typeof createTeam>;
const popTo = jest.fn();
const replace = jest.fn();

const MOCK_SPORTS = [
  { name: 'football', display_name: 'Football' },
  { name: 'basketball', display_name: 'Basketball' },
];

async function mount(): Promise<Instance> {
  const props = { navigation: { popTo, replace }, route: { params: undefined } };
  return renderAsync(<CreateGroupScreen {...(props as unknown as Props)} />);
}

const input = (root: Instance, placeholder: string): Instance =>
  root.find(node => (node.type as unknown) === 'TextInput' && node.props.placeholder === placeholder);

const type = (root: Instance, placeholder: string, value: string): void => {
  act(() => {
    input(root, placeholder).props.onChangeText(value);
  });
};

const submitGroup = async (root: Instance): Promise<void> => {
  await act(async () => {
    pressableLabelled(root, 'Create Group').props.onPress();
  });
};

const submitTeam = async (root: Instance): Promise<void> => {
  await act(async () => {
    pressableLabelled(root, 'Create Team').props.onPress();
  });
};

const selectChip = (root: Instance, label: string): void => {
  act(() => {
    pressableLabelled(root, label).props.onPress();
  });
};

beforeEach(() => {
  mockCreateGroup.mockReset();
  mockGetSports.mockReset();
  mockCreateTeam.mockReset();
  popTo.mockReset();
  replace.mockReset();
  mockGetSports.mockResolvedValue(MOCK_SPORTS);
});

describe('CreateGroupScreen — Players Group mode (default)', () => {
  it('defaults to Players Group and shows group fields', async () => {
    const root = await mount();
    const t = texts(root);
    expect(t).toContain('Name');
    expect(t).toContain('Description (optional)');
    // Team fields should NOT be visible in group mode.
    expect(t.every(text => !/Team Name/i.test(text))).toBe(true);
  });

  it('rejects an empty/blank name locally without calling the API', async () => {
    const root = await mount();
    type(root, 'e.g. Sunday Footballers', '   ');
    await submitGroup(root);
    expect(texts(root)).toContain('Enter a group name.');
    expect(mockCreateGroup).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('caps the name at the schema maximum of 100 characters', async () => {
    const root = await mount();
    expect(input(root, 'e.g. Sunday Footballers').props.maxLength).toBe(100);
  });

  it('submits the trimmed values with one correlation id, then navigates to GroupDetail', async () => {
    mockCreateGroup.mockResolvedValueOnce({ id: 'group-123' } as never);
    const root = await mount();
    type(root, 'e.g. Sunday Footballers', '  Sunday Footballers ');
    type(root, 'What is this group about?', ' Weekly kickabout ');
    await submitGroup(root);

    expect(mockCreateGroup).toHaveBeenCalledTimes(1);
    expect(mockCreateGroup).toHaveBeenCalledWith(
      { name: 'Sunday Footballers', description: 'Weekly kickabout' },
      { correlationId: expect.any(String) },
    );
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('GroupDetail', { groupId: 'group-123' });
  });

  it('shows the server message inline on failure', async () => {
    mockCreateGroup.mockRejectedValueOnce({
      response: { status: 422, data: { detail: [{ loc: ['body', 'name'], msg: 'Too long', type: 'x' }] } },
    });
    const root = await mount();
    type(root, 'e.g. Sunday Footballers', 'G');
    await submitGroup(root);

    expect(texts(root)).toContain('name: Too long');
    expect(replace).not.toHaveBeenCalled();
    expect(input(root, 'e.g. Sunday Footballers').props.editable).toBe(true);
  });

  it('shows a generic message when the failure carries no usable detail', async () => {
    mockCreateGroup.mockRejectedValueOnce(new Error('Network Error'));
    const root = await mount();
    type(root, 'e.g. Sunday Footballers', 'G');
    await submitGroup(root);
    expect(texts(root)).toContain('Could not create the group. Please try again.');
  });

  it('locks the fields while the request is in flight', async () => {
    let resolve!: () => void;
    mockCreateGroup.mockReturnValueOnce(new Promise(r => { resolve = () => r({ id: 'g1' } as never); }));
    const root = await mount();
    type(root, 'e.g. Sunday Footballers', 'G');
    await act(async () => {
      pressableLabelled(root, 'Create Group').props.onPress();
    });
    expect(input(root, 'e.g. Sunday Footballers').props.editable).toBe(false);
    await act(async () => resolve());
    expect(replace).toHaveBeenCalledTimes(1);
  });
});

describe('CreateGroupScreen — Tournament Team mode', () => {
  it('shows team fields when toggled to Tournament Team', async () => {
    const root = await mount();
    selectChip(root, '🛡️ Tournament Team');
    const t = texts(root);
    expect(t).toContain('Team Name');
    expect(t).toContain('Sport');
    expect(t).toContain('Visibility');
    // Group fields should NOT be visible in team mode.
    expect(t.every(text => text !== 'Description (optional)')).toBe(true);
  });

  it('renders the sport dropdown from GET /admin/sports/public', async () => {
    const root = await mount();
    selectChip(root, '🛡️ Tournament Team');
    const t = texts(root);
    expect(t).toContain('Football');
    expect(t).toContain('Basketball');
  });

  it('rejects empty team name locally', async () => {
    const root = await mount();
    selectChip(root, '🛡️ Tournament Team');
    type(root, 'e.g. Real Madrid FC', '   ');
    await submitTeam(root);
    expect(texts(root)).toContain('Enter a team name.');
    expect(mockCreateTeam).not.toHaveBeenCalled();
  });

  it('rejects missing sport', async () => {
    const root = await mount();
    selectChip(root, '🛡️ Tournament Team');
    type(root, 'e.g. Real Madrid FC', 'Test Team');
    // No sport selected.
    await submitTeam(root);
    expect(texts(root)).toContain('Choose a sport.');
    expect(mockCreateTeam).not.toHaveBeenCalled();
  });

  it('submits team with name, sport and visibility, then navigates to the groups list', async () => {
    mockCreateTeam.mockResolvedValueOnce({
      id: 'team-456',
      name: 'Test FC',
      sport: 'football',
      visibility: 'public',
      captain_user_id: 'u1',
      created_at: '2026-01-01T00:00:00Z',
    });
    const root = await mount();
    selectChip(root, '🛡️ Tournament Team');
    type(root, 'e.g. Real Madrid FC', '  Test FC  ');
    selectChip(root, 'Football');
    // Default visibility is public, so no extra chip select needed.
    await submitTeam(root);

    expect(mockCreateTeam).toHaveBeenCalledTimes(1);
    expect(mockCreateTeam).toHaveBeenCalledWith(
      { name: 'Test FC', sport: 'football', visibility: 'public' },
      { correlationId: expect.any(String) },
    );
    // TeamDetailScreen does not exist — falls back to groups list.
    expect(popTo).toHaveBeenCalledTimes(1);
    expect(popTo).toHaveBeenCalledWith('GroupsList', { refreshKey: expect.any(Number) });
  });

  it('sends the selected visibility when changed from the default', async () => {
    mockCreateTeam.mockResolvedValueOnce({} as never);
    const root = await mount();
    selectChip(root, '🛡️ Tournament Team');
    type(root, 'e.g. Real Madrid FC', 'Test FC');
    selectChip(root, 'Football');
    selectChip(root, 'Private');
    await submitTeam(root);

    expect(mockCreateTeam).toHaveBeenCalledWith(
      expect.objectContaining({ visibility: 'private' }),
      expect.anything(),
    );
  });

  it('shows the server message inline on team creation failure', async () => {
    mockCreateTeam.mockRejectedValueOnce({
      response: { status: 400, data: { detail: 'Sport does not exist' } },
    });
    const root = await mount();
    selectChip(root, '🛡️ Tournament Team');
    type(root, 'e.g. Real Madrid FC', 'Test');
    selectChip(root, 'Football');
    await submitTeam(root);

    expect(texts(root)).toContain('Sport does not exist');
  });

  it('does NOT have a Captain field', async () => {
    const root = await mount();
    selectChip(root, '🛡️ Tournament Team');
    const t = texts(root);
    expect(t.every(text => !/captain/i.test(text))).toBe(true);
  });
});

describe('CreateGroupScreen — mode toggle preservation', () => {
  it('preserves state across mode toggles', async () => {
    const root = await mount();
    // Type in Group mode.
    type(root, 'e.g. Sunday Footballers', 'My Group');
    // Switch to Team.
    selectChip(root, '🛡️ Tournament Team');
    type(root, 'e.g. Real Madrid FC', 'My Team');
    // Switch back to Group.
    selectChip(root, '👥 Players Group');
    // Group name should be preserved.
    expect(input(root, 'e.g. Sunday Footballers').props.value).toBe('My Group');
    // Switch back to Team.
    selectChip(root, '🛡️ Tournament Team');
    // Team name should be preserved.
    expect(input(root, 'e.g. Real Madrid FC').props.value).toBe('My Team');
  });
});
