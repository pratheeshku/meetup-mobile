/**
 * `KeyboardAwareScreen` + shared `TextField`: keyboard listeners, overlap
 * padding, focus-scroll with mocked layout. Run as both Android and iOS.
 *
 * Jest cannot prove real keyboard behaviour. These tests drive the same
 * events a device would (keyboard show/hide, layout, focus) against mocked
 * measurements; whether the field really ends up above the keyboard has to be
 * checked on a phone (manual device checklist).
 */
import React from 'react';
import { Keyboard, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import { act } from '../../test-utils/render';
import KeyboardAwareScreen, { computeScrollDelta, FOCUS_MARGIN } from '../KeyboardAwareScreen';
import TextField from '../TextField';

type Handler = (event?: unknown) => void;
/** Every listener registered per keyboard event (more than one component listens). */
const registered: Record<string, Handler[]> = {};
const handlers = new Proxy({} as Record<string, Handler>, {
  get:
    (_target, name: string): Handler =>
    (event?: unknown) =>
      (registered[name] ?? []).forEach(handler => handler(event)),
});
const removeSpy = jest.fn();
let scrollToSpy: jest.SpyInstance;

/** Fake native node: a container measured in the window, a field measured in the container. */
const containerWindow = { y: 0, height: 800 };
const fieldLayout = { y: 0, height: 44 };

/**
 * In the React Native Jest preset `View`, `TextInput` and `ScrollView` are
 * mock classes whose native methods (`measureInWindow`, `measureLayout`,
 * `scrollTo`) are jest.fn()s on the prototype; they are given implementations
 * from the fake layout above in `beforeEach`.
 */
function mount(element: React.ReactElement): ReactTestRenderer.ReactTestRenderer {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(element);
  });
  return renderer;
}

const scrollHost = (r: ReactTestRenderer.ReactTestRenderer) =>
  r.root.findAll(n => n.props.keyboardShouldPersistTaps === 'handled' && typeof n.props.onLayout === 'function')[0];

const containerHost = (r: ReactTestRenderer.ReactTestRenderer) =>
  r.root.findAll(
    n => (n.type as unknown) === 'View' && typeof n.props.onLayout !== 'undefined' && n.props.style,
  )[0];

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(registered).forEach(k => delete registered[k]);
  containerWindow.y = 0;
  containerWindow.height = 800;
  fieldLayout.y = 0;
  fieldLayout.height = 44;
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((name: string, handler: Handler) => {
    (registered[name] = registered[name] ?? []).push(handler);
    return { remove: removeSpy };
  }) as never);
  scrollToSpy = jest
    .spyOn(ScrollView.prototype as never, 'scrollTo')
    .mockImplementation((() => {}) as never);
  jest
    .spyOn(View.prototype as never, 'measureInWindow')
    .mockImplementation(((cb: (x: number, y: number, w: number, h: number) => void) =>
      cb(0, containerWindow.y, 400, containerWindow.height)) as never);
  jest
    .spyOn(TextInput.prototype as never, 'measureLayout')
    .mockImplementation(((_to: unknown, ok: (x: number, y: number, w: number, h: number) => void) =>
      ok(0, fieldLayout.y, 300, fieldLayout.height)) as never);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('computeScrollDelta', () => {
  it('is 0 when the field is comfortably inside the viewport', () => {
    expect(computeScrollDelta({ fieldTop: 100, fieldBottom: 144, viewportHeight: 400 })).toBe(0);
  });

  it('scrolls down by the amount the field (plus margin) sticks out below', () => {
    expect(computeScrollDelta({ fieldTop: 380, fieldBottom: 424, viewportHeight: 400 })).toBe(
      424 + FOCUS_MARGIN - 400,
    );
  });

  it('scrolls up when the field is above the viewport', () => {
    expect(computeScrollDelta({ fieldTop: -30, fieldBottom: 14, viewportHeight: 400 })).toBe(
      -30 - FOCUS_MARGIN,
    );
  });

  it('keeps the bottom edge visible when the field is taller than the viewport (caret at the end)', () => {
    expect(computeScrollDelta({ fieldTop: 10, fieldBottom: 500, viewportHeight: 400 })).toBe(
      500 + FOCUS_MARGIN - 400,
    );
  });
});

describe('Android: padding follows the measured keyboard overlap', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'android');
  });

  it('listens for the keyboard, pads the container by the overlap, and clears it on hide', () => {
    const r = mount(
      <KeyboardAwareScreen>
        <Text>content</Text>
      </KeyboardAwareScreen>,
    );
    expect(Keyboard.addListener).toHaveBeenCalledWith('keyboardDidShow', expect.any(Function));
    expect(Keyboard.addListener).toHaveBeenCalledWith('keyboardDidHide', expect.any(Function));

    act(() => handlers.keyboardDidShow({ endCoordinates: { screenY: 500, height: 300 } }));
    expect(containerHost(r).props.style).toEqual(expect.arrayContaining([{ paddingBottom: 300 }]));

    act(() => handlers.keyboardDidHide());
    expect(containerHost(r).props.style).toEqual(expect.arrayContaining([{ paddingBottom: 0 }]));
  });

  it('adds no padding when the OS already resized the window above the keyboard', () => {
    containerWindow.height = 450; // container ends at y=450, above the keyboard at 500
    const r = mount(
      <KeyboardAwareScreen>
        <Text>content</Text>
      </KeyboardAwareScreen>,
    );
    act(() => handlers.keyboardDidShow({ endCoordinates: { screenY: 500, height: 300 } }));
    expect(containerHost(r).props.style).toEqual(expect.arrayContaining([{ paddingBottom: 0 }]));
  });

  it('re-measures when the container is resized after the keyboard event', () => {
    const r = mount(
      <KeyboardAwareScreen>
        <Text>content</Text>
      </KeyboardAwareScreen>,
    );
    act(() => handlers.keyboardDidShow({ endCoordinates: { screenY: 500, height: 300 } }));
    expect(containerHost(r).props.style).toEqual(expect.arrayContaining([{ paddingBottom: 300 }]));

    containerWindow.height = 500; // window shrank to the keyboard top
    act(() => containerHost(r).props.onLayout());
    expect(containerHost(r).props.style).toEqual(expect.arrayContaining([{ paddingBottom: 0 }]));
  });

  it('has no KeyboardAvoidingView', () => {
    const r = mount(
      <KeyboardAwareScreen>
        <Text>content</Text>
      </KeyboardAwareScreen>,
    );
    expect(r.root.findAll(n => typeof n.props.behavior === 'string')).toHaveLength(0);
  });

  it('removes its keyboard listeners on unmount', () => {
    const r = mount(
      <KeyboardAwareScreen>
        <Text>content</Text>
      </KeyboardAwareScreen>,
    );
    act(() => r.unmount());
    expect(removeSpy).toHaveBeenCalled();
  });
});

describe('iOS: KeyboardAvoidingView padding', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'ios');
  });

  it('uses KeyboardAvoidingView with padding behavior and no manual padding', () => {
    const r = mount(
      <KeyboardAwareScreen>
        <Text>content</Text>
      </KeyboardAwareScreen>,
    );
    expect(r.root.findAll(n => n.props.behavior === 'padding').length).toBeGreaterThan(0);
    act(() => handlers.keyboardDidShow({ endCoordinates: { screenY: 500, height: 300 } }));
    expect(containerHost(r).props.style).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ paddingBottom: 300 })]),
    );
  });
});

describe.each(['android', 'ios'] as const)('scroll view on %s', os => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', os);
  });

  it('persists handled taps, dismisses on drag, and grows bottom padding while the keyboard is open', () => {
    const r = mount(
      <KeyboardAwareScreen contentContainerStyle={{ padding: 16 }}>
        <Text>content</Text>
      </KeyboardAwareScreen>,
    );
    const scroll = scrollHost(r);
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
    expect(scroll.props.keyboardDismissMode).toBe('on-drag');
    expect(scroll.props.contentContainerStyle).toEqual([{ padding: 16 }, null]);

    act(() => handlers.keyboardDidShow({ endCoordinates: { screenY: 500, height: 300 } }));
    const grown = scrollHost(r).props.contentContainerStyle;
    expect(grown[1]).toEqual(expect.objectContaining({ paddingBottom: expect.any(Number) }));

    act(() => handlers.keyboardDidHide());
    expect(scrollHost(r).props.contentContainerStyle[1]).toBeNull();
  });

  it('scrolls a focused field into view above the keyboard', () => {
    const r = mount(
      <KeyboardAwareScreen>
        <TextField placeholder="Name" />
      </KeyboardAwareScreen>,
    );
    act(() => scrollHost(r).props.onLayout({ nativeEvent: { layout: { height: 400 } } }));
    fieldLayout.y = 380; // bottom edge (424) is below the 400 viewport
    const input = r.root.findAll(n => (n.type as unknown) === 'TextInput')[0];

    act(() => input.props.onFocus({}));

    expect(scrollToSpy).toHaveBeenCalledWith({ y: 424 + FOCUS_MARGIN - 400, animated: true });
  });

  it('adds the current scroll offset to the delta', () => {
    const r = mount(
      <KeyboardAwareScreen>
        <TextField placeholder="Name" />
      </KeyboardAwareScreen>,
    );
    act(() => scrollHost(r).props.onLayout({ nativeEvent: { layout: { height: 400 } } }));
    act(() => scrollHost(r).props.onScroll({ nativeEvent: { contentOffset: { y: 100 } } }));
    fieldLayout.y = 380;
    act(() => r.root.findAll(n => (n.type as unknown) === 'TextInput')[0].props.onFocus({}));

    expect(scrollToSpy).toHaveBeenCalledWith({ y: 100 + (424 + FOCUS_MARGIN - 400), animated: true });
  });

  it('does not scroll a field that is already visible', () => {
    const r = mount(
      <KeyboardAwareScreen>
        <TextField placeholder="Name" />
      </KeyboardAwareScreen>,
    );
    act(() => scrollHost(r).props.onLayout({ nativeEvent: { layout: { height: 400 } } }));
    fieldLayout.y = 50;
    act(() => r.root.findAll(n => (n.type as unknown) === 'TextInput')[0].props.onFocus({}));

    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it('re-scrolls the focused field when the viewport shrinks (keyboard finished appearing)', () => {
    const r = mount(
      <KeyboardAwareScreen>
        <TextField placeholder="Name" />
      </KeyboardAwareScreen>,
    );
    act(() => scrollHost(r).props.onLayout({ nativeEvent: { layout: { height: 700 } } }));
    fieldLayout.y = 380;
    act(() => r.root.findAll(n => (n.type as unknown) === 'TextInput')[0].props.onFocus({}));
    expect(scrollToSpy).not.toHaveBeenCalled(); // visible in the 700 viewport

    act(() => scrollHost(r).props.onLayout({ nativeEvent: { layout: { height: 400 } } }));
    expect(scrollToSpy).toHaveBeenCalledWith({ y: 424 + FOCUS_MARGIN - 400, animated: true });
  });

  it('stops following a field after it blurs', () => {
    const r = mount(
      <KeyboardAwareScreen>
        <TextField placeholder="Name" />
      </KeyboardAwareScreen>,
    );
    act(() => scrollHost(r).props.onLayout({ nativeEvent: { layout: { height: 700 } } }));
    const input = r.root.findAll(n => (n.type as unknown) === 'TextInput')[0];
    fieldLayout.y = 380;
    act(() => input.props.onFocus({}));
    act(() => input.props.onBlur({}));

    act(() => scrollHost(r).props.onLayout({ nativeEvent: { layout: { height: 400 } } }));
    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it('keeps a multiline field in view while it grows as the user types', () => {
    const r = mount(
      <KeyboardAwareScreen>
        <TextField placeholder="Description" multiline />
      </KeyboardAwareScreen>,
    );
    act(() => scrollHost(r).props.onLayout({ nativeEvent: { layout: { height: 400 } } }));
    const input = r.root.findAll(n => (n.type as unknown) === 'TextInput')[0];
    fieldLayout.y = 300;
    act(() => input.props.onFocus({})); // bottom 344 + margin fits
    expect(scrollToSpy).not.toHaveBeenCalled();

    fieldLayout.height = 120; // a few lines typed: bottom is now 420
    act(() => input.props.onContentSizeChange({ nativeEvent: { contentSize: { height: 120 } } }));
    expect(scrollToSpy).toHaveBeenCalledWith({ y: 420 + FOCUS_MARGIN - 400, animated: true });
  });

  it("still calls the caller's own onFocus / onBlur / onContentSizeChange", () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    const onSize = jest.fn();
    const r = mount(
      <KeyboardAwareScreen>
        <TextField multiline onFocus={onFocus} onBlur={onBlur} onContentSizeChange={onSize} />
      </KeyboardAwareScreen>,
    );
    const input = r.root.findAll(n => (n.type as unknown) === 'TextInput')[0];
    act(() => input.props.onFocus({}));
    act(() => input.props.onContentSizeChange({}));
    act(() => input.props.onBlur({}));
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onSize).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});

describe('TextField outside a KeyboardAwareScreen', () => {
  it('works standalone (no provider)', () => {
    const r = mount(<TextField placeholder="Solo" />);
    const input = r.root.findAll(n => (n.type as unknown) === 'TextInput')[0];
    expect(() => act(() => input.props.onFocus({}))).not.toThrow();
  });
});
