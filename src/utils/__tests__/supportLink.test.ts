import { toSupportLink } from '../supportLink';

describe('toSupportLink', () => {
  it.each([[''], ['   '], [undefined], [null]])('returns null for empty/blank %p', value => {
    expect(toSupportLink(value)).toBeNull();
  });

  it.each([
    ['http://help.example.com'],
    ['ftp://help.example.com'],
    ['help.example.com'],
    ['not a contact'],
    ['a@b'],
    ['a@@b.com'],
    ['a b@c.com'],
    ['a@b .com'],
    ['@b.com'],
    ['a@.com'],
    ['a@b.'],
    ['mailto:help@example.com'],
  ])('returns null for %p', value => {
    expect(toSupportLink(value)).toBeNull();
  });

  it('returns a valid https URL trimmed', () => {
    expect(toSupportLink('  https://help.example.com/contact  ')).toBe(
      'https://help.example.com/contact',
    );
  });

  it('turns a plain email address into a mailto: link', () => {
    expect(toSupportLink('  support@example.com ')).toBe('mailto:support@example.com');
    expect(toSupportLink('a.b+c@mail.example.co.uk')).toBe('mailto:a.b+c@mail.example.co.uk');
  });
});
