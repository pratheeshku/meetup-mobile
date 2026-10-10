/**
 * Splash retry state. Labels resolve from the bundled defaults when no
 * LabelsProvider has fetched remote copy (cold start, offline).
 */
import React from 'react';

import { pressableWithText, render, texts } from '../../test-utils/render';
import SessionCheckRetry from '../SessionCheckRetry';

it('renders the network fallback and the Retry button', () => {
  const onRetry = jest.fn();
  const root = render(
    <SessionCheckRetry failure="network" onRetry={onRetry} />,
  );

  expect(texts(root)).toContain('Unable to connect to server.');
  pressableWithText(root, 'Retry').props.onPress();
  expect(onRetry).toHaveBeenCalledTimes(1);
});

it.each([
  ['server', 'Something went wrong. Try again.'],
  ['rate_limit', 'Too many attempts. Try again in a minute.'],
] as const)('renders the %s fallback', (failure, message) => {
  const root = render(
    <SessionCheckRetry failure={failure} onRetry={jest.fn()} />,
  );

  expect(texts(root)).toContain(message);
  expect(texts(root)).toContain('Retry');
});
