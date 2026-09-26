/**
 * Tests for `getAvatarUrl` — the utility that resolves a backend
 * `avatar_storage_key` to a full display URL (DES-MEETUP-ADDENDUM-profile-photo
 * §5, §10.1).
 */
import { getAvatarUrl } from '../avatar';

// The default AVATAR_BUCKET_BASE_URL from config/env.ts (react-native-config
// returns `{}` under Jest — see jest.setup.js, so Config.AVATAR_BUCKET_BASE_URL
// is undefined and the fallback is used).
const BUCKET_BASE = 'https://meetup.hel1.your-objectstorage.com';

describe('getAvatarUrl', () => {
  it('returns the full URL for a non-null storage key', () => {
    expect(getAvatarUrl('avatars/u-1.png')).toBe(`${BUCKET_BASE}/avatars/u-1.png`);
  });

  it('returns null for a null storage key', () => {
    expect(getAvatarUrl(null)).toBeNull();
  });

  it('returns null for an undefined storage key', () => {
    expect(getAvatarUrl(undefined)).toBeNull();
  });

  it('returns null for an empty-string storage key', () => {
    expect(getAvatarUrl('')).toBeNull();
  });

  it('handles keys with path separators (e.g. "avatars/uuid/filename.jpg")', () => {
    expect(getAvatarUrl('avatars/abc-123/photo.jpg')).toBe(
      `${BUCKET_BASE}/avatars/abc-123/photo.jpg`,
    );
  });
});
