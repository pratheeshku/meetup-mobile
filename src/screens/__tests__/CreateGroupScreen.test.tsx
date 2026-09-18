/**
 * Create Group form against the live `GroupCreate` contract: name required,
 * description optional, no members_can_invite. API and navigation mocked.
 */
import React from 'react';

import { createGroup } from '../../api/groups';
import { act, pressableLabelled, render, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import CreateGroupScreen from '../CreateGroupScreen';

type Props = React.ComponentProps<typeof CreateGroupScreen>;

jest.mock('../../api/groups', () => ({ createGroup: jest.fn() }));

const mockCreateGroup = createGroup as jest.MockedFunction<typeof createGroup>;
const popTo = jest.fn();

function mount(): Instance {
  const props = { navigation: { popTo }, route: { params: undefined } };
  return render(<CreateGroupScreen {...(props as unknown as Props)} />);
}

const input = (root: Instance, placeholder: string): Instance =>
  root.find(node => (node.type as unknown) === 'TextInput' && node.props.placeholder === placeholder);

const type = (root: Instance, placeholder: string, value: string): void => {
  act(() => {
    input(root, placeholder).props.onChangeText(value);
  });
};

const submit = async (root: Instance): Promise<void> => {
  await act(async () => {
    pressableLabelled(root, 'Create Group').props.onPress();
  });
};

beforeEach(() => {
  mockCreateGroup.mockReset();
  popTo.mockReset();
});

describe('CreateGroupScreen', () => {
  it('offers exactly the GroupCreate fields', () => {
    const t = texts(mount());
    expect(t).toContain('Name');
    expect(t).toContain('Description (optional)');
    expect(t.some(text => /invite/i.test(text))).toBe(false);
  });

  it('rejects an empty/blank name locally without calling the API', async () => {
    const root = mount();
    type(root, 'e.g. Sunday Footballers', '   ');
    await submit(root);
    expect(texts(root)).toContain('Enter a group name.');
    expect(mockCreateGroup).not.toHaveBeenCalled();
    expect(popTo).not.toHaveBeenCalled();
  });

  it('caps the name at the schema maximum of 100 characters', () => {
    expect(input(mount(), 'e.g. Sunday Footballers').props.maxLength).toBe(100);
  });

  it('submits the trimmed values with one correlation id, then pops back to the list with a refresh key', async () => {
    mockCreateGroup.mockResolvedValueOnce({} as never);
    const root = mount();
    type(root, 'e.g. Sunday Footballers', '  Sunday Footballers ');
    type(root, 'What is this group about?', ' Weekly kickabout ');
    await submit(root);

    expect(mockCreateGroup).toHaveBeenCalledTimes(1);
    expect(mockCreateGroup).toHaveBeenCalledWith(
      { name: 'Sunday Footballers', description: 'Weekly kickabout' },
      { correlationId: expect.any(String) },
    );
    expect(popTo).toHaveBeenCalledTimes(1);
    expect(popTo).toHaveBeenCalledWith('GroupsList', { refreshKey: expect.any(Number) });
  });

  it('shows the server message inline on failure, stays on the form, and re-enables editing', async () => {
    mockCreateGroup.mockRejectedValueOnce({
      response: { status: 422, data: { detail: [{ loc: ['body', 'name'], msg: 'Too long', type: 'x' }] } },
    });
    const root = mount();
    type(root, 'e.g. Sunday Footballers', 'G');
    await submit(root);

    expect(texts(root)).toContain('name: Too long');
    expect(popTo).not.toHaveBeenCalled();
    expect(input(root, 'e.g. Sunday Footballers').props.editable).toBe(true);
  });

  it('shows a generic message when the failure carries no usable detail (e.g. network)', async () => {
    mockCreateGroup.mockRejectedValueOnce(new Error('Network Error'));
    const root = mount();
    type(root, 'e.g. Sunday Footballers', 'G');
    await submit(root);
    expect(texts(root)).toContain('Could not create the group. Please try again.');
  });

  it('locks the fields while the request is in flight', async () => {
    let resolve!: () => void;
    mockCreateGroup.mockReturnValueOnce(new Promise(r => { resolve = () => r({} as never); }));
    const root = mount();
    type(root, 'e.g. Sunday Footballers', 'G');
    await act(async () => {
      pressableLabelled(root, 'Create Group').props.onPress();
    });
    expect(input(root, 'e.g. Sunday Footballers').props.editable).toBe(false);
    await act(async () => resolve());
    expect(popTo).toHaveBeenCalledTimes(1);
  });
});
