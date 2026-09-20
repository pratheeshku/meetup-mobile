/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';
import { installFakeBackend } from '../src/test-utils/apiHarness';

// `App` makes requests on launch (version policy, session restore). Route them
// through the fake backend so this smoke test never touches the network.
beforeEach(() => {
  installFakeBackend();
});

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
