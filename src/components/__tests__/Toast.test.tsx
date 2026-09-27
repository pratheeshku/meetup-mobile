/**
 * Tests for Toast component (DES-MEETUP-MOBILE-ADDENDUM-shareable-links Decision 5).
 */
import React from 'react';

import { act, render, texts } from '../../test-utils/render';
import Toast from '../Toast';

describe('Toast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders nothing when message is null', () => {
    const onDismiss = jest.fn();
    const root = render(<Toast message={null} onDismiss={onDismiss} />);
    expect(root.children.length).toBe(0);
  });

  it('renders the message text when provided', () => {
    const onDismiss = jest.fn();
    const root = render(<Toast message="Link copied to clipboard" onDismiss={onDismiss} />);
    expect(texts(root)).toContain('Link copied to clipboard');
  });

  it('auto-dismisses after duration expires', () => {
    const onDismiss = jest.fn();
    render(<Toast message="Copied!" duration={1000} onDismiss={onDismiss} />);

    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1000 + 200);
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
