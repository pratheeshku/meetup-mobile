/**
 * Tests for shareable link utilities (DES-MEETUP-MOBILE-ADDENDUM-shareable-links).
 */
import { Clipboard, Linking, Share } from 'react-native';

import { ENV } from '../../../config/env';
import {
  composeShareMessage,
  copyLinkToClipboard,
  getEventShareUrl,
  shareGeneric,
  shareToWhatsApp,
} from '../shareLink';

describe('shareLink utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getEventShareUrl', () => {
    it('appends ?ref=<user_id> when currentUserId is provided', () => {
      const url = getEventShareUrl('event-123', 'user-abc');
      const expectedBase = ENV.API_BASE_URL.replace(/\/+$/, '');
      expect(url).toBe(`${expectedBase}/events/event-123?ref=user-abc`);
    });

    it('returns canonical event URL without ?ref= when currentUserId is omitted', () => {
      const url = getEventShareUrl('event-123');
      const expectedBase = ENV.API_BASE_URL.replace(/\/+$/, '');
      expect(url).toBe(`${expectedBase}/events/event-123`);
    });

    it('URL-encodes user_id in the ?ref= query parameter', () => {
      const url = getEventShareUrl('event-123', 'user with spaces&symbols');
      expect(url).toContain('?ref=user%20with%20spaces%26symbols');
    });
  });

  describe('composeShareMessage', () => {
    it('formats default copy matching Decision 7 template verbatim', () => {
      const msg = composeShareMessage(
        'Pratheesh',
        'Sunday Badminton',
        'https://meetups.duckdns.org/events/ev-1?ref=u-1',
      );
      expect(msg).toBe(
        'Pratheesh invited you to Sunday Badminton on Shuttlr — https://meetups.duckdns.org/events/ev-1?ref=u-1',
      );
      // Explicitly check for the em-dash (\u2014)
      expect(msg).toContain(' \u2014 ');
    });
  });

  describe('shareGeneric', () => {
    it('calls Share.share with message and url', async () => {
      const spy = jest.spyOn(Share, 'share').mockResolvedValueOnce({ action: 'sharedAction' });
      await shareGeneric({
        message: 'Join us!',
        url: 'https://meetups.duckdns.org/events/1',
      });
      expect(spy).toHaveBeenCalledWith({
        message: 'Join us!',
        url: 'https://meetups.duckdns.org/events/1',
      });
    });
  });

  describe('shareToWhatsApp', () => {
    it('opens whatsapp:// URL when Linking.canOpenURL succeeds', async () => {
      const canOpenSpy = jest.spyOn(Linking, 'canOpenURL').mockResolvedValueOnce(true);
      const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValueOnce(undefined as never);

      const message = 'Pratheesh invited you to Game on Shuttlr — https://meetups.duckdns.org/events/1';
      await shareToWhatsApp(message);

      expect(canOpenSpy).toHaveBeenCalledWith('whatsapp://send');
      expect(openSpy).toHaveBeenCalledWith(`whatsapp://send?text=${encodeURIComponent(message)}`);
    });

    it('falls back to https://wa.me/ URL when Linking.canOpenURL returns false', async () => {
      const canOpenSpy = jest.spyOn(Linking, 'canOpenURL').mockResolvedValueOnce(false);
      const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValueOnce(undefined as never);

      const message = 'Pratheesh invited you to Game on Shuttlr — https://meetups.duckdns.org/events/1';
      await shareToWhatsApp(message);

      expect(canOpenSpy).toHaveBeenCalledWith('whatsapp://send');
      expect(openSpy).toHaveBeenCalledWith(`https://wa.me/?text=${encodeURIComponent(message)}`);
    });

    it('falls back to https://wa.me/ URL when Linking.canOpenURL rejects', async () => {
      const canOpenSpy = jest.spyOn(Linking, 'canOpenURL').mockRejectedValueOnce(new Error('native err'));
      const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValueOnce(undefined as never);

      const message = 'Pratheesh invited you to Game on Shuttlr — https://meetups.duckdns.org/events/1';
      await shareToWhatsApp(message);

      expect(canOpenSpy).toHaveBeenCalledWith('whatsapp://send');
      expect(openSpy).toHaveBeenCalledWith(`https://wa.me/?text=${encodeURIComponent(message)}`);
    });
  });

  describe('copyLinkToClipboard', () => {
    it('calls Clipboard.setString with the provided URL', () => {
      const setStringSpy = jest.spyOn(Clipboard, 'setString');
      copyLinkToClipboard('https://meetups.duckdns.org/events/123');
      expect(setStringSpy).toHaveBeenCalledWith('https://meetups.duckdns.org/events/123');
    });
  });
});
