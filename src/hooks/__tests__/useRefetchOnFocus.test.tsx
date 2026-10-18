/** AC-10: a screen fetches on every focus (the first included) and on app foreground while focused. */
import React from 'react';
import { create } from 'react-test-renderer';
import type { ReactTestRenderer } from 'react-test-renderer';

import { act, render } from '../../test-utils/render';
import { createFocusNavigation } from '../../test-utils/focusNavigation';
import { useRefetchOnFocus } from '../useRefetchOnFocus';

function Probe({ navigation, load, k }: { navigation: unknown; load: () => void; k?: string }): null {
  useRefetchOnFocus(navigation as never, load, k);
  return null;
}

describe('useRefetchOnFocus', () => {
  it('loads on the first focus, on every later focus, and on foreground', () => {
    const nav = createFocusNavigation();
    const load = jest.fn();
    render(<Probe navigation={nav.navigation} load={load} />);
    expect(load).toHaveBeenCalledTimes(1);
    act(() => nav.fireFocus());
    expect(load).toHaveBeenCalledTimes(2);
    act(() => nav.foreground());
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('does not load on foreground when the screen is not the focused one', () => {
    const nav = createFocusNavigation();
    const load = jest.fn();
    render(<Probe navigation={nav.navigation} load={load} />);
    nav.setFocused(false);
    act(() => nav.foreground());
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('does not load on mount when the screen is not focused, but does once it is', () => {
    const nav = createFocusNavigation();
    nav.setFocused(false);
    const load = jest.fn();
    render(<Probe navigation={nav.navigation} load={load} />);
    expect(load).not.toHaveBeenCalled();
    nav.setFocused(true);
    act(() => nav.fireFocus());
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('loads again when the key changes and always calls the latest load', () => {
    const nav = createFocusNavigation();
    const first = jest.fn();
    const second = jest.fn();
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<Probe navigation={nav.navigation} load={first} k="a" />);
    });
    expect(first).toHaveBeenCalledTimes(1);
    act(() => renderer.update(<Probe navigation={nav.navigation} load={second} k="b" />));
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1);
    act(() => nav.fireFocus());
    expect(second).toHaveBeenCalledTimes(2);
  });

  it('stops listening after unmount', () => {
    const nav = createFocusNavigation();
    const load = jest.fn();
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<Probe navigation={nav.navigation} load={load} />);
    });
    act(() => renderer.unmount());
    act(() => nav.fireFocus());
    act(() => nav.foreground());
    expect(load).toHaveBeenCalledTimes(1);
  });
});
