import React from 'react';
import { Text } from 'react-native';

import { getLegalLinks } from '../../../api/home';
import { openLink } from '../../../utils/openLink';
import { act, renderAsync } from '../../../test-utils/render';
import SocialTermsNotice from '../SocialTermsNotice';

jest.mock('../../../api/home', () => ({
  getLegalLinks: jest.fn(),
}));

jest.mock('../../../utils/openLink', () => ({
  openLink: jest.fn(),
}));

const mockGetLegalLinks = getLegalLinks as jest.Mock;
const mockOpenLink = openLink as jest.Mock;

describe('SocialTermsNotice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders links when terms_url and privacy_url are provided and opens them on click', async () => {
    mockGetLegalLinks.mockResolvedValueOnce({
      terms_url: 'https://example.com/terms',
      privacy_url: 'https://example.com/privacy',
    });

    const root = await renderAsync(<SocialTermsNotice />);

    const linkTexts = root.findAll(
      node => node.type === Text && node.props.accessibilityRole === 'link',
    );
    expect(linkTexts).toHaveLength(2);

    const termsLink = linkTexts.find(n => n.props.children === 'Terms and Conditions');
    const privacyLink = linkTexts.find(n => n.props.children === 'Privacy Policy');

    expect(termsLink).toBeDefined();
    expect(privacyLink).toBeDefined();

    await act(async () => {
      termsLink?.props.onPress();
    });
    expect(mockOpenLink).toHaveBeenCalledWith('https://example.com/terms', expect.any(String));

    await act(async () => {
      privacyLink?.props.onPress();
    });
    expect(mockOpenLink).toHaveBeenCalledWith('https://example.com/privacy', expect.any(String));
  });

  it('renders plain text without links when URLs are empty strings', async () => {
    mockGetLegalLinks.mockResolvedValueOnce({
      terms_url: '',
      privacy_url: '',
    });

    const root = await renderAsync(<SocialTermsNotice />);

    const linkTexts = root.findAll(
      node => node.type === Text && node.props.accessibilityRole === 'link',
    );
    expect(linkTexts).toHaveLength(0);
  });

  it('renders plain text gracefully without error when API fetch fails', async () => {
    mockGetLegalLinks.mockRejectedValueOnce(new Error('Network failure'));

    const root = await renderAsync(<SocialTermsNotice />);

    const linkTexts = root.findAll(
      node => node.type === Text && node.props.accessibilityRole === 'link',
    );
    expect(linkTexts).toHaveLength(0);
  });
});
