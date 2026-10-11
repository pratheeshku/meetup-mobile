/**
 * Tests for shareable link utilities (DES-MEETUP-MOBILE-ADDENDUM-shareable-links).
 */
import { Clipboard, Linking, Share } from 'react-native';

import { ENV } from '../../../config/env';
import {
  copyLinkToClipboard,
  getShareUrl,
  SHARE_PATH,
  shareGeneric,
  shareToWhatsApp,
} from '../shareLink';

describe('shareLink utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getShareUrl', () => {
    it('returns API base URL plus /public/share', () => {
      const url = getShareUrl();
      const expectedBase = ENV.API_BASE_URL.replace(/\/+$/, '');
      expect(url).toBe(`${expectedBase}${SHARE_PATH}`);
    });
  });

  describe('shareGeneric', () => {
    it('calls Share.share with message only', async () => {
      const spy = jest.spyOn(Share, 'share').mockResolvedValueOnce({ action: 'sharedAction' });
      await shareGeneric({
        message: 'Join us!',
      });
      expect(spy).toHaveBeenCalledWith({
        message: 'Join us!',
      });
    });
  });

  describe('shareToWhatsApp', () => {
    it('opens whatsapp:// URL when Linking.canOpenURL succeeds', async () => {
      const canOpenSpy = jest.spyOn(Linking, 'canOpenURL').mockResolvedValueOnce(true);
      const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValueOnce(undefined as never);

      const message = 'Pratheesh invited you to Game on Shuttlr — https://meetups.duckdns.org/#event-detail/1?ref=u-1';
      await shareToWhatsApp(message);

      expect(canOpenSpy).toHaveBeenCalledWith('whatsapp://send');
      expect(openSpy).toHaveBeenCalledWith(`whatsapp://send?text=${encodeURIComponent(message)}`);
    });

    it('falls back to https://wa.me/ URL when Linking.canOpenURL returns false', async () => {
      const canOpenSpy = jest.spyOn(Linking, 'canOpenURL').mockResolvedValueOnce(false);
      const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValueOnce(undefined as never);

      const message = 'Pratheesh invited you to Game on Shuttlr — https://meetups.duckdns.org/#event-detail/1?ref=u-1';
      await shareToWhatsApp(message);

      expect(canOpenSpy).toHaveBeenCalledWith('whatsapp://send');
      expect(openSpy).toHaveBeenCalledWith(`https://wa.me/?text=${encodeURIComponent(message)}`);
    });

    it('falls back to https://wa.me/ URL when Linking.canOpenURL rejects', async () => {
      const canOpenSpy = jest.spyOn(Linking, 'canOpenURL').mockRejectedValueOnce(new Error('native err'));
      const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValueOnce(undefined as never);

      const message = 'Pratheesh invited you to Game on Shuttlr — https://meetups.duckdns.org/#event-detail/1?ref=u-1';
      await shareToWhatsApp(message);

      expect(canOpenSpy).toHaveBeenCalledWith('whatsapp://send');
      expect(openSpy).toHaveBeenCalledWith(`https://wa.me/?text=${encodeURIComponent(message)}`);
    });
  });

  describe('copyLinkToClipboard', () => {
    it('calls Clipboard.setString with the provided URL', () => {
      const setStringSpy = jest.spyOn(Clipboard, 'setString');
      copyLinkToClipboard('https://meetups.duckdns.org/#event-detail/123');
      expect(setStringSpy).toHaveBeenCalledWith('https://meetups.duckdns.org/#event-detail/123');
    });
  });
});
