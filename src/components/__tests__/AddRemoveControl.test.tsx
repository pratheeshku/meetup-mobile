/**
 * Shared "+" / "−" control (AD-19, test 51). Real renders; no source text is read here
 * (the static check lives in src/components/__tests__/inviteControlsStatic.test.ts).
 */
import React from 'react';
import { StyleSheet } from 'react-native';

import { act, pressableLabelled, render, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import AddRemoveControl, { AddEntryButton, GroupInviteList } from '../AddRemoveControl';
import { MinusIcon, PlusIcon } from '../icons/ActionIcons';

const flat = (node: Instance) => {
  const style = node.props.style;
  return StyleSheet.flatten(typeof style === 'function' ? style({ pressed: false }) : style);
};

const glyphs = (root: Instance): string[] =>
  root.findAll(n => n.type === PlusIcon || n.type === MinusIcon).map(n => (n.type === PlusIcon ? '+' : '-'));

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('AddRemoveControl, staged (screen with a submit step)', () => {
  it('"+" stages and sends nothing; the name comes from the label system', () => {
    const onStage = jest.fn();
    const onUnstage = jest.fn();
    const root = render(
      <AddRemoveControl mode="staged" staged={false} name="Alex" onStage={onStage} onUnstage={onUnstage} />,
    );
    expect(glyphs(root)).toEqual(['+']);
    act(() => pressableLabelled(root, 'Invite Alex').props.onPress());
    expect(onStage).toHaveBeenCalledTimes(1);
    expect(onUnstage).not.toHaveBeenCalled();
  });

  it('"−" removes the staged entry and sends nothing; the glyph changes, not only the colour', () => {
    const onStage = jest.fn();
    const onUnstage = jest.fn();
    const root = render(
      <AddRemoveControl mode="staged" staged name="Alex" onStage={onStage} onUnstage={onUnstage} />,
    );
    expect(glyphs(root)).toEqual(['-']);
    act(() => pressableLabelled(root, 'Remove Alex').props.onPress());
    expect(onUnstage).toHaveBeenCalledTimes(1);
    expect(onStage).not.toHaveBeenCalled();
  });

  it('has a touch target of at least 44pt in both states', () => {
    for (const staged of [false, true]) {
      const root = render(
        <AddRemoveControl mode="staged" staged={staged} name="Alex" onStage={jest.fn()} onUnstage={jest.fn()} />,
      );
      const button = pressableLabelled(root, staged ? 'Remove Alex' : 'Invite Alex');
      expect(flat(button).minWidth).toBeGreaterThanOrEqual(44);
      expect(flat(button).minHeight).toBeGreaterThanOrEqual(44);
    }
  });

  it('shows the server status chip and no glyph when an invitation already exists', () => {
    const root = render(
      <AddRemoveControl mode="staged" staged={false} name="Alex" sentStatus="Invited" onStage={jest.fn()} onUnstage={jest.fn()} />,
    );
    expect(texts(root)).toContain('Invited');
    expect(glyphs(root)).toEqual([]);
  });
});

describe('AddRemoveControl, immediate (screen without a submit step)', () => {
  it('shows the chip only after the server confirmed, then no "+" or "−"', async () => {
    const send = deferred();
    const onSend = jest.fn(() => send.promise);
    const root = render(<AddRemoveControl mode="immediate" name="Alex" onSend={onSend} />);
    act(() => pressableLabelled(root, 'Invite Alex').props.onPress());
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(texts(root)).not.toContain('Invited'); // not optimistic
    await act(async () => {
      send.resolve();
    });
    expect(texts(root)).toContain('Invited');
    expect(glyphs(root)).toEqual([]);
  });

  it('a double tap sends once', async () => {
    const send = deferred();
    const onSend = jest.fn(() => send.promise);
    const root = render(<AddRemoveControl mode="immediate" name="Alex" onSend={onSend} />);
    const press = pressableLabelled(root, 'Invite Alex');
    act(() => {
      press.props.onPress();
      press.props.onPress();
    });
    await act(async () => {
      send.resolve();
    });
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('a failed send returns the row to "+" with the error label, and can be retried', async () => {
    const onSend = jest.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(undefined);
    const root = render(<AddRemoveControl mode="immediate" name="Alex" onSend={onSend} />);
    await act(async () => {
      pressableLabelled(root, 'Invite Alex').props.onPress();
    });
    expect(glyphs(root)).toEqual(['+']);
    expect(texts(root)).toContain('Could not send the invitation. Try again.');
    expect(texts(root)).not.toContain('Invited');
    await act(async () => {
      pressableLabelled(root, 'Invite Alex').props.onPress();
    });
    expect(onSend).toHaveBeenCalledTimes(2);
    expect(texts(root)).toContain('Invited');
    expect(texts(root)).not.toContain('Could not send the invitation. Try again.');
  });

  it('treats a synchronous throw as a failed send', async () => {
    const onSend = jest.fn(() => {
      throw new Error('sync');
    });
    const root = render(<AddRemoveControl mode="immediate" name="Alex" onSend={onSend} />);
    await act(async () => {
      pressableLabelled(root, 'Invite Alex').props.onPress();
    });
    expect(glyphs(root)).toEqual(['+']);
    expect(texts(root)).toContain('Could not send the invitation. Try again.');
  });
});

describe('AddEntryButton and GroupInviteList', () => {
  it('an entry button is "+" with the caller\'s accessible label (keeps the word Invite) and a 44pt target', () => {
    const onPress = jest.fn();
    const root = render(<AddEntryButton label="Invite Group" onPress={onPress} />);
    expect(glyphs(root)).toEqual(['+']);
    const button = pressableLabelled(root, 'Invite Group');
    expect(flat(button).minHeight).toBeGreaterThanOrEqual(44);
    act(() => button.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('a group row shows "+" until staged, then "−"; no "Invite" text button is drawn', () => {
    const onToggle = jest.fn();
    const groups = [
      { id: 'g1', name: 'Sunday Footballers' },
      { id: 'g2', name: 'Tuesday Badminton' },
    ];
    const root = render(<GroupInviteList groups={groups} selectedIds={['g2']} onToggle={onToggle} />);
    expect(glyphs(root)).toEqual(['+', '-']);
    act(() => pressableLabelled(root, 'Invite Sunday Footballers').props.onPress());
    act(() => pressableLabelled(root, 'Remove Tuesday Badminton').props.onPress());
    expect(onToggle.mock.calls).toEqual([['g1'], ['g2']]);
    expect(texts(root)).not.toContain('Invite');
  });
});
