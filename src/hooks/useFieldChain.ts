/**
 * Return-key behaviour for an ordered list of text fields: "next" moves focus
 * to the following field, "done" on the last one dismisses the keyboard.
 *
 * Usage: `const chain = useFieldChain(['email', 'password']);` then
 * `<TextField {...chain.props('email')} />`. Fields not in the chain, and
 * multiline fields (where return inserts a new line), keep the default key;
 * give a multiline field only `ref={chain.ref('name')}` so it can still be
 * focused by `chain.focus`.
 *
 * `chain.focus(name)` focuses a field; the shared `TextField` then scrolls it
 * into view above the keyboard — which is how a screen scrolls to the first
 * invalid field on submit.
 */
import { useCallback, useMemo, useRef } from 'react';
import { Keyboard } from 'react-native';
import type { TextInput, TextInputProps } from 'react-native';

type ChainProps = Pick<TextInputProps, 'returnKeyType' | 'blurOnSubmit' | 'onSubmitEditing'> & {
  ref: (node: TextInput | null) => void;
};

export interface FieldChain {
  ref: (name: string) => (node: TextInput | null) => void;
  props: (name: string) => ChainProps;
  focus: (name: string) => void;
}

export function useFieldChain(order: readonly string[]): FieldChain {
  const nodes = useRef<Record<string, TextInput | null>>({});
  const refSetters = useRef<Record<string, (node: TextInput | null) => void>>({});
  const orderKey = order.join('\u0000');

  const ref = useCallback((name: string) => {
    if (!refSetters.current[name]) {
      refSetters.current[name] = node => {
        nodes.current[name] = node;
      };
    }
    return refSetters.current[name];
  }, []);

  const focus = useCallback((name: string) => {
    nodes.current[name]?.focus();
  }, []);

  return useMemo<FieldChain>(() => {
    const names = orderKey.split('\u0000');
    return {
      ref,
      focus,
      props: (name: string): ChainProps => {
        const index = names.indexOf(name);
        const next = index >= 0 ? names[index + 1] : undefined;
        const isLast = index >= 0 && next === undefined;
        return {
          ref: ref(name),
          returnKeyType: isLast ? 'done' : 'next',
          blurOnSubmit: isLast,
          onSubmitEditing: () => {
            if (next !== undefined) {
              focus(next);
            } else {
              Keyboard.dismiss();
            }
          },
        };
      },
    };
  }, [orderKey, ref, focus]);
}
