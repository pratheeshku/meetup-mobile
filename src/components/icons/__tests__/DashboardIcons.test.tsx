/** Icon module: EXECUTES renders (react-native-svg elements), not source checks. */
import React from 'react';
import Svg from 'react-native-svg';

import { render } from '../../../test-utils/render';
import { SportMarkerIcon } from '../SharedIcons';
import {
  BannerBackground,
  FallbackBallIcon,
  GamesIcon,
  ICON_GLYPHS,
  SportIcon,
  hasSportIcon,
  sportSlug,
} from '../DashboardIcons';

const WHITELIST = [
  'badminton',
  'basketball',
  'football',
  'tennis',
  'volleyball',
  'swimming',
  'sport-marker',
] as const;

function hostSvg(element: React.ReactElement) {
  return render(element).findByType(Svg);
}

describe('sport icon lookup', () => {
  it.each(WHITELIST)('has a bundled glyph for whitelist icon_key %s', iconKey => {
    expect(hasSportIcon(iconKey)).toBe(true);
    expect(ICON_GLYPHS[iconKey]).toBeDefined();
    const rendered = render(<SportIcon iconKey={iconKey} size={24} />);
    expect(rendered.findAllByType(FallbackBallIcon)).toHaveLength(0);
    expect(rendered.findAllByType(Svg).length).toBeGreaterThan(0);
  });

  it('renders the sport-marker glyph, not the neutral ball', () => {
    const rendered = render(<SportIcon iconKey="  Sport-Marker  " size={24} />);
    expect(rendered.findAllByType(SportMarkerIcon)).toHaveLength(1);
    expect(rendered.findAllByType(FallbackBallIcon)).toHaveLength(0);
  });

  it('matches an icon_key case-insensitively and ignoring whitespace', () => {
    expect(hasSportIcon('BADMINTON')).toBe(true);
    expect(hasSportIcon('  Tennis ')).toBe(true);
    expect(sportSlug(' Football ')).toBe('football');
  });

  it('uses the fallback ball for an unknown, empty or missing icon_key', () => {
    for (const iconKey of ['curling', 'not-a-glyph', '', null, undefined]) {
      expect(hasSportIcon(iconKey)).toBe(false);
      const rendered = render(<SportIcon iconKey={iconKey} size={24} />);
      expect(rendered.findAllByType(FallbackBallIcon)).toHaveLength(1);
      expect(rendered.findAllByType(Svg).length).toBeGreaterThan(0);
    }
  });

  it('renders the matching glyph (not the fallback) for a known icon_key', () => {
    const rendered = render(<SportIcon iconKey="Basketball" size={24} />);
    expect(rendered.findAllByType(ICON_GLYPHS.basketball)).toHaveLength(1);
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
