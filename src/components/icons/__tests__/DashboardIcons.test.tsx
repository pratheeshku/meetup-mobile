/** Icon module: EXECUTES renders (react-native-svg elements), not source checks. */
import React from 'react';
import Svg from 'react-native-svg';

import { render } from '../../../test-utils/render';
import { SPORT_ICON_KEYS } from '../../../sports/iconKeys';
import { dashSize } from '../../../theme/dashboardTheme';
import { skillSizes } from '../../../theme/tokens';
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
    for (const iconKey of ['not-a-glyph', 'curling-stone', '', null, undefined]) {
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

describe('shared sport icon library', () => {
  it('has the 84 manifest keys, all unique', () => {
    expect(SPORT_ICON_KEYS).toHaveLength(84);
    expect(new Set(SPORT_ICON_KEYS).size).toBe(84);
  });

  it.each([...SPORT_ICON_KEYS])('has a glyph for %s that renders at every size the app uses (not the fallback ball)', iconKey => {
    expect(hasSportIcon(iconKey)).toBe(true);
    expect(typeof ICON_GLYPHS[iconKey]).toBe('function');
    // SportPicker, GameRow/GroupRow, HomeTopBar chips, NextGameCard/SportChipsRow, default.
    for (const size of [skillSizes.sportIcon, dashSize.rowIcon, 20, dashSize.sportIcon, 24]) {
      const rendered = render(<SportIcon iconKey={iconKey.toUpperCase()} size={size} />);
      expect(rendered.findAllByType(FallbackBallIcon)).toHaveLength(0);
      const svg = rendered.findByType(Svg);
      expect(svg.props.viewBox).toBe('0 0 48 48');
      expect(svg.props.width).toBe(size);
      if (!(WHITELIST as readonly string[]).includes(iconKey)) {
        expect(svg.props.accessibilityElementsHidden).toBe(true); // new glyphs are decorative
      }
    }
  });

  it('keeps the existing seven glyphs unchanged and registers nothing outside the manifest', () => {
    for (const key of WHITELIST) {
      expect(SPORT_ICON_KEYS).toContain(key);
    }
    expect(Object.keys(ICON_GLYPHS).sort()).toEqual([...SPORT_ICON_KEYS].sort());
  });

  it('an unknown key renders the neutral fallback ball (existing behaviour)', () => {
    const rendered = render(<SportIcon iconKey="no-such-sport" size={24} />);
    expect(rendered.findAllByType(FallbackBallIcon)).toHaveLength(1);
  });
});
