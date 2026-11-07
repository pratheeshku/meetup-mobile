/**
 * TASK 3.1: GameOn SG invite message built from admin labels and store config.
 * The label texts below are test fixtures standing in for the live admin labels.
 */
import { buildInviteMessage, buildShareText } from '../shareInvite';

const LABELS = {
  'share.invite_message': 'Hi, {name} invites you to GameOn SG 📲\n{store_links}\nSee you on court!',
  'share.invite_android_line': '🤖 Android: {url}',
  'share.invite_ios_line': '🍎 iPhone: {url}',
};
const ANDROID = 'https://play.example/app';
const IOS = 'https://apps.example/app';
const GROUP_LINK = 'https://api.example/public/group-invite/abc';

describe('buildInviteMessage', () => {
  it('includes both store lines, android first, when both URLs are set', () => {
    expect(buildInviteMessage(LABELS, 'Sam', { android: ANDROID, ios: IOS })).toBe(
      `Hi, Sam invites you to GameOn SG 📲\n🤖 Android: ${ANDROID}\n🍎 iPhone: ${IOS}\nSee you on court!`,
    );
  });

  it('includes only the android line when only android is set', () => {
    const msg = buildInviteMessage(LABELS, 'Sam', { android: ANDROID, ios: '' });
    expect(msg).toContain(`🤖 Android: ${ANDROID}`);
    expect(msg).not.toContain('🍎');
  });

  it('includes only the iOS line when only iOS is set', () => {
    const msg = buildInviteMessage(LABELS, 'Sam', { android: '', ios: IOS });
    expect(msg).toContain(`🍎 iPhone: ${IOS}`);
    expect(msg).not.toContain('🤖');
  });

  it('omits both lines when the client config has not loaded', () => {
    expect(buildInviteMessage(LABELS, 'Sam')).toBe('Hi, Sam invites you to GameOn SG 📲\n\nSee you on court!');
  });

  it('returns empty when share.invite_message is missing or blank', () => {
    expect(buildInviteMessage({}, 'Sam', { android: ANDROID })).toBe('');
    expect(buildInviteMessage({ ...LABELS, 'share.invite_message': '  ' }, 'Sam', { android: ANDROID })).toBe('');
    expect(buildInviteMessage(null, 'Sam')).toBe('');
  });

  it('preserves emoji (📲 🤖 🍎) in the text', () => {
    const msg = buildInviteMessage(LABELS, 'Sam', { android: ANDROID, ios: IOS });
    expect(msg).toContain('📲');
    expect(msg).toContain('🤖');
    expect(msg).toContain('🍎');
  });
});

describe('buildShareText', () => {
  const urls = { android: ANDROID, ios: '' };

  it('game / tournament share: the message only, no link', () => {
    const text = buildShareText(LABELS, 'Sam', urls);
    expect(text).toBe(buildInviteMessage(LABELS, 'Sam', urls));
    expect(text).not.toMatch(/\/public\/|#event/);
  });

  it('group share: the message, a blank line, then the invite link', () => {
    const text = buildShareText(LABELS, 'Sam', urls, GROUP_LINK);
    expect(text).toBe(`${buildInviteMessage(LABELS, 'Sam', urls)}\n\n${GROUP_LINK}`);
  });

  it('shares nothing when the invite label is missing, even with a link', () => {
    expect(buildShareText({}, 'Sam', urls, GROUP_LINK)).toBe('');
  });
});
