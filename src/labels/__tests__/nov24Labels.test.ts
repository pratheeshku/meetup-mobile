/**
 * Bundled defaults for DES-MEETUP-ADDENDUM-nov24-enhancements (AD-4, data contracts) and
 * DES-MEETUP-ADDENDUM-app-update-prompt (4.6). Wording is fixed by the designs.
 */
import { DEFAULT_LABELS } from '../defaultLabels';

const labels = DEFAULT_LABELS as Record<string, string>;

describe('nov24-enhancements labels', () => {
  it.each([
    ['mob.venue.my_venues', 'My venues'],
    ['mob.venue.saved_remove', 'Remove'],
    ['mob.venue.saved_remove_confirm', 'Remove this venue from My venues?'],
    ['mob.create_game.banner', 'Banner (optional)'],
    ['mob.profile.share_app', 'Share app link'],
    ['mob.nav.title_stats', 'My games'],
    ['mob.home.tab_groups', 'My groups'],
  ])('%s = %s', (key, text) => {
    expect(labels[key]).toBe(text);
  });

  it('no bundled default reads "Your games" or "Your groups" (AD-4)', () => {
    const offenders = Object.entries(labels).filter(([, value]) => /^Your (games|groups)$/i.test(value));
    expect(offenders).toEqual([]);
  });
});

describe('app-update-prompt labels (4.6)', () => {
  it.each([
    ['mob.app_update.title', 'New version available'],
    ['mob.app_update.message', 'A new version of GameOn SG is available. Update now to get the latest features and fixes.'],
    ['mob.app_update.action', 'Update'],
    ['mob.app_update.later', 'Later'],
    ['mob.force_update.title', 'Update required'],
    ['mob.force_update.message', 'Please update GameOn SG to continue.'],
    ['mob.force_update.action', 'Update'],
  ])('%s = %s', (key, text) => {
    expect(labels[key]).toBe(text);
  });

  it('no update label says Meetup or Shuttlr', () => {
    const update = Object.entries(labels).filter(([key]) => /^mob\.(app_update|force_update)\./.test(key));
    expect(update.filter(([, value]) => /meetup|shuttlr/i.test(value))).toEqual([]);
  });
});
