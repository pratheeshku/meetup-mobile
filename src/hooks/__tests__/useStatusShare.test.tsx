/** priority1-nov23 P1-06: Android hands the screenshot straight to WhatsApp when it is installed. */
import React from 'react';
import { Platform } from 'react-native';
import { act, create } from 'react-test-renderer';

import { useStatusShare } from '../useStatusShare';
import type { StatusShare } from '../useStatusShare';

const share = (jest.requireMock('react-native-share') as {
  default: { open: jest.Mock; shareSingle: jest.Mock; isPackageInstalled: jest.Mock };
}).default;

const viewShot = jest.requireMock('react-native-view-shot') as { captureRef: jest.Mock };

function mountHook(options?: { scrollView?: boolean }): () => StatusShare {
  let latest: StatusShare | undefined;
  const ref = { current: {} };
  function Probe(): null {
    latest = useStatusShare(ref, 'Friday doubles', options);
    return null;
  }
  act(() => {
    create(<Probe />);
  });
  return () => latest as StatusShare;
}

const setOS = (os: 'ios' | 'android'): void => {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
};

beforeEach(() => {
  share.open.mockClear();
  share.shareSingle.mockClear();
  share.isPackageInstalled.mockReset().mockResolvedValue({ isInstalled: false });
});

it('Android with WhatsApp: shareSingle to WhatsApp with the image and the label message', async () => {
  setOS('android');
  share.isPackageInstalled.mockImplementation((pkg: string) => Promise.resolve({ isInstalled: pkg === 'com.whatsapp' }));
  const hook = mountHook();
  await act(async () => {
    await hook().share();
  });
  expect(share.shareSingle).toHaveBeenCalledWith(
    expect.objectContaining({ social: 'whatsapp', url: 'file:///tmp/status.png', message: 'Friday doubles: who is in' }),
  );
  expect(share.open).not.toHaveBeenCalled();
});

it('Android with WhatsApp Business only: shares to WhatsApp Business', async () => {
  setOS('android');
  share.isPackageInstalled.mockImplementation((pkg: string) => Promise.resolve({ isInstalled: pkg === 'com.whatsapp.w4b' }));
  const hook = mountHook();
  await act(async () => {
    await hook().share();
  });
  expect(share.shareSingle).toHaveBeenCalledWith(expect.objectContaining({ social: 'whatsappbusiness' }));
});

it('Android without WhatsApp: falls back to the system share sheet', async () => {
  setOS('android');
  const hook = mountHook();
  await act(async () => {
    await hook().share();
  });
  expect(share.shareSingle).not.toHaveBeenCalled();
  expect(share.open).toHaveBeenCalledWith(expect.objectContaining({ url: 'file:///tmp/status.png', type: 'image/png' }));
  expect(hook().error).toBeNull();
});

it('a plain View target (tournament page) is captured without the full-scroll option; a ScrollView target asks for it', async () => {
  setOS('ios');
  viewShot.captureRef.mockClear();
  const plain = mountHook();
  await act(async () => {
    await plain().share();
  });
  expect(viewShot.captureRef.mock.calls[0][1]).not.toHaveProperty('snapshotContentContainer');
  const scroll = mountHook({ scrollView: true });
  await act(async () => {
    await scroll().share();
  });
  expect(viewShot.captureRef.mock.calls[1][1]).toEqual(expect.objectContaining({ snapshotContentContainer: true }));
});
