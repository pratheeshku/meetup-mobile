/**
 * Bottom-bar icons and labels (AD-5): every tab has an Appendix A SVG icon
 * (the records are typed on `AppTabParamList`, so a new tab without one is
 * also a type error); the Tournaments route is labelled "Games" with the
 * gamepad; the active label is brand-coloured and bold. EXECUTES renders.
 */
import { StyleSheet } from 'react-native';

import { GamesIcon, GroupsIcon, HomeIcon, ProfileIcon } from '../../components/icons/DashboardIcons';
import { render, texts } from '../../test-utils/render';
import { dash, dashSize } from '../../theme/dashboardTheme';
import { TAB_ICONS, TAB_LABELS, TabIcon, TabLabel } from '../tabIcons';

describe('tab icon and label tables', () => {
  it('maps each tab to its Appendix A icon, with the gamepad for the Games tab', () => {
    expect(TAB_ICONS).toEqual({
      Home: HomeIcon,
      Groups: GroupsIcon,
      Tournaments: GamesIcon,
      Profile: ProfileIcon,
    });
  });

  it('renames the Tournaments tab to "Games" and keeps the other labels', () => {
    expect(TAB_LABELS).toEqual({
      Home: 'Home',
      Groups: 'Groups',
      Tournaments: 'Games',
      Profile: 'Profile',
    });
    expect(Object.values(TAB_LABELS)).not.toContain('Tournaments');
  });
});

describe('TabIcon / TabLabel', () => {
  it('renders the icon at 30px', () => {
    const icon = render(<TabIcon name="Tournaments" />).findByType(GamesIcon);
    expect(icon.props.size).toBe(dashSize.navIcon);
    expect(dashSize.navIcon).toBe(30);
  });

  it('renders the label at 11px, bold brand when active and muted when idle', () => {
    const active = StyleSheet.flatten(
      render(<TabLabel name="Tournaments" focused />).findByType('Text' as never).props.style,
    );
    const idle = StyleSheet.flatten(
      render(<TabLabel name="Home" focused={false} />).findByType('Text' as never).props.style,
    );
    expect(active).toMatchObject({ fontSize: 11, color: dash.brand, fontWeight: '700' });
    expect(idle).toMatchObject({ fontSize: 11, color: dash.navInactive });
    expect(texts(render(<TabLabel name="Tournaments" focused />))).toEqual(['Games']);
  });
});
