/**
 * `useFieldChain`: return key "next" moves focus to the following field, "done"
 * on the last one dismisses the keyboard; multiline fields are reachable by
 * `chain.focus` but keep their own return key.
 */
import React from 'react';
import { Keyboard, TextInput } from 'react-native';

import TextField from '../../components/TextField';
import { act, render } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { useFieldChain } from '../useFieldChain';
import type { FieldChain } from '../useFieldChain';

let chain: FieldChain;
function Form(): React.JSX.Element {
  chain = useFieldChain(['first', 'second', 'notes', 'last']);
  return (
    <>
      <TextField placeholder="first" {...chain.props('first')} />
      <TextField placeholder="second" {...chain.props('second')} />
      <TextField placeholder="notes" multiline ref={chain.ref('notes')} />
      <TextField placeholder="last" {...chain.props('last')} />
    </>
  );
}

const focusMock = TextInput.prototype.focus as unknown as jest.Mock;
const field = (root: Instance, placeholder: string): Instance =>
  root.findAll(n => (n.type as unknown) === 'TextInput' && n.props.placeholder === placeholder)[0];
const focusedPlaceholders = (): string[] =>
  focusMock.mock.contexts.map(
    (ctx: { props: { placeholder: string } }) => ctx.props.placeholder,
  );

beforeEach(() => {
  focusMock.mockClear();
  jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('sets "next" on every field but the last, and "done" on the last', () => {
  const root = render(<Form />);
  expect(field(root, 'first').props.returnKeyType).toBe('next');
  expect(field(root, 'second').props.returnKeyType).toBe('next');
  expect(field(root, 'last').props.returnKeyType).toBe('done');
  expect(field(root, 'last').props.blurOnSubmit).toBe(true);
  expect(field(root, 'first').props.blurOnSubmit).toBe(false);
});

it('moves focus to the next field on submit', () => {
  const root = render(<Form />);
  act(() => field(root, 'first').props.onSubmitEditing());
  expect(focusedPlaceholders()).toEqual(['second']);
  act(() => field(root, 'second').props.onSubmitEditing());
  expect(focusedPlaceholders()).toEqual(['second', 'notes']);
});

it('dismisses the keyboard on submit of the last field', () => {
  const root = render(<Form />);
  act(() => field(root, 'last').props.onSubmitEditing());
  expect(Keyboard.dismiss).toHaveBeenCalledTimes(1);
  expect(focusMock).not.toHaveBeenCalled();
});

it('leaves a multiline field with the default return key', () => {
  const root = render(<Form />);
  expect(field(root, 'notes').props.returnKeyType).toBeUndefined();
});

it('focus(name) focuses that field (used to jump to the first invalid one)', () => {
  render(<Form />);
  act(() => chain.focus('last'));
  expect(focusedPlaceholders()).toEqual(['last']);
});

it('ignores focus() for an unknown or unmounted field', () => {
  render(<Form />);
  expect(() => chain.focus('missing')).not.toThrow();
});
