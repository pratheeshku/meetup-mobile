/** Icon module: EXECUTES renders (react-native-svg elements), not source checks. */
import React from 'react';
import Svg from 'react-native-svg';

import { render } from '../../../test-utils/render';
import {
  BannerBackground,
  FallbackBallIcon,
  GamesIcon,
  SPORT_ICONS,
  SportIcon,
  hasSportIcon,
  sportSlug,
} from '../DashboardIcons';

function hostSvg(element: React.ReactElement) {
  return render(element).findByType(Svg);
}

describe('sport icon lookup', () => {
  it.each(['badminton', 'basketball', 'football', 'tennis'])('has an icon for %s', slug => {
    expect(hasSportIcon(slug)).toBe(true);
    expect(SPORT_ICONS[slug]).toBeDefined();
  });

  it('matches the slug case-insensitively and ignoring whitespace', () => {
    expect(hasSportIcon('BADMINTON')).toBe(true);
    expect(hasSportIcon('  Tennis ')).toBe(true);
    expect(sportSlug(' Football ')).toBe('football');
  });

  it('uses the fallback ball for an unknown, empty or missing slug', () => {
    for (const slug of ['curling', '', null, undefined]) {
      expect(hasSportIcon(slug)).toBe(false);
      const rendered = render(<SportIcon slug={slug} size={24} />);
      expect(rendered.findAllByType(FallbackBallIcon)).toHaveLength(1);
    }
  });

  it('renders the matching icon (not the fallback) for a known slug', () => {
    const rendered = render(<SportIcon slug="Basketball" size={24} />);
    expect(rendered.findAllByType(SPORT_ICONS.basketball)).toHaveLength(1);
    expect(rendered.findAllByType(FallbackBallIcon)).toHaveLength(0);
  });
});

describe('icon geometry', () => {
  it('draws on the 48-unit Appendix A viewBox at the requested size', () => {
    const svg = hostSvg(<GamesIcon size={30} />);
    expect(svg.props.viewBox).toBe('0 0 48 48');
    expect(svg.props.width).toBe(30);
    expect(svg.props.height).toBe(30);
  });

  it('is hidden from screen readers (decorative)', () => {
    const svg = hostSvg(<GamesIcon size={30} />);
    expect(svg.props.accessibilityElementsHidden).toBe(true);
  });

  it('uses the Appendix B banner viewBox for the background', () => {
    const svg = hostSvg(<BannerBackground width="100%" height="100%" />);
    expect(svg.props.viewBox).toBe('0 0 390 208');
    expect(svg.props.preserveAspectRatio).toBe('xMidYMid slice');
  });
});
