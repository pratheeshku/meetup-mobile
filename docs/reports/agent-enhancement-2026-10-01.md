# Agent Enhancement Note — 2026-10-01

## Reflection 1: Act Wrapping for Synthetic Input Events in React 19 Test Renderers

- **What happened**: When testing text input components in `react-test-renderer` under React 19, invoking `input.props.onChangeText(val)` synchronously outside `act(() => { ... })` failed to flush state updates before submitting the enclosing form. As a result, handlers evaluated stale initial state and triggered validation errors unexpectedly.
- **Why it matters generally**: In modern React concurrent and batched updating models, synthetic event callbacks on rendered host nodes do not automatically execute within a browser event loop dispatch phase. Any direct prop invocation altering component hook state requires explicit `act()` scheduling to guarantee state synchronization before downstream assertions or handler triggers.
- **Suggested addition**: Add to `Developer Agent — Shared Instructions / Debugging discipline`:
  *"In React component tests (using `react-test-renderer` or testing libraries), all synthetic event prop invocations (`onChangeText`, `onSelect`, etc.) altering hook state must be explicitly wrapped in `act(() => { ... })` before downstream interaction triggers or assertions run."*

## Reflection 2: Evaluating Pressable Functional Styles in Accessibility Assertions

- **What happened**: When verifying touch target height constraints (`minHeight >= 44`) on design-system `Button` and `TextLink` components, `StyleSheet.flatten(pressable.props.style)` returned empty objects. In React Native, `Pressable` commonly defines its style as an interaction function `({ pressed }) => [...]`. Calling `StyleSheet.flatten` directly on a function yields `undefined` unless evaluated.
- **Why it matters generally**: Tests enforcing accessibility guidelines (WCAG touch targets, dynamic theme colors) will produce false negatives when inspecting interactive elements unless dynamic functional style props are evaluated with default interaction states (`pressed: false`).
- **Suggested addition**: Add to `Developer Agent — Shared Instructions / Testing discipline`:
  *"When inspecting style properties of interactive elements utilizing functional style declarations (such as `Pressable.props.style`), evaluate the function with `{ pressed: false }` prior to flattening with `StyleSheet.flatten`."*
