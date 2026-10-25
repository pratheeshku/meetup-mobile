/**
 * Brief M11: the `mob.reg.*` keys (server seed, version 1) are in the bundled fallbacks with exactly the seeded text, so a first launch with no
 * network shows the right words. `npm run check:labels` covers the other direction (every key used in source exists).
 */
import { DEFAULT_LABELS } from '../defaultLabels';

const SEED: Record<string, string> = {
  'mob.reg.register': 'Register',
  'mob.reg.confirm': 'Confirm',
  'mob.reg.cancel': 'Cancel',
  'mob.reg.retry': 'Try again',
  'mob.reg.free': 'Free registration',
  'mob.reg.fee_per_player': 'Registration fee: {amount} per player',
  'mob.reg.fee_per_team': 'Registration fee: {amount} per tournament team',
  'mob.reg.fee_note': 'The fee is arranged with the organizer outside the app. No payment is taken in the app.',
  'mob.reg.success_title': "You're registered",
  'mob.reg.failure_title': 'Could not register',
  'mob.reg.err.registration_closed': 'Registration is closed for this tournament.',
  'mob.reg.err.skill_level_required': 'Set your skill level for this sport before you register.',
  'mob.reg.err.skill_level_link': 'Set skill level',
  'mob.reg.err.already_registered': 'You are already registered.',
  'mob.reg.err.tournament_full': 'This tournament is full.',
  'mob.reg.err.invitation_required': 'You need an invitation to register for this tournament.',
  'mob.reg.err.team_required': 'Choose a tournament team to register.',
  'mob.reg.err.fee_changed': 'The registration fee has changed. Check the new fee and confirm again.',
  'mob.reg.err.fee_ack_required': 'Confirm the registration fee to register.',
  'mob.reg.err.generic': 'Could not register. Please try again.',
  'mob.reg.invite_only': 'Invite only',
  'mob.reg.groups_more': '+{count}',
  'mob.reg.close_a11y': 'Close',
  'mob.reg.media_empty': 'No photos or videos yet.',
  'mob.reg.push.registered': "You're registered.",
  'mob.reg.push.registered_free': "You're registered. Free registration.",
  'mob.reg.push.open_app': 'Open the app to confirm the fee.',
  'mob.reg.push.already_registered': 'You are already registered.',
};

describe('mob.reg.* fallbacks', () => {
  it.each(Object.entries(SEED))('%s', (key, text) => {
    expect((DEFAULT_LABELS as Record<string, string>)[key]).toBe(text);
  });

  it('no payment wording anywhere in the registration labels (the app takes no payment)', () => {
    const regLabels = Object.entries(DEFAULT_LABELS).filter(([key]) => key.startsWith('mob.reg.'));
    for (const [, text] of regLabels) {
      expect(String(text)).not.toMatch(/\bpay now\b|\brefund\b|\bcheckout\b/i);
    }
  });
});
