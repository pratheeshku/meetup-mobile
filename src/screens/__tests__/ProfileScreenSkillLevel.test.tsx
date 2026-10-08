import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { renderAsync, texts } from '../../test-utils/render';
import ProfileScreen from '../ProfileScreen';
import { getProfile, getProfileSummary } from '../../api/profile';
import { getMyGroups } from '../../api/groups';
import { getCachedBanners } from '../../api/home';
import { colors } from '../../theme/tokens';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/types';

jest.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ signOut: jest.fn() }),
}));

jest.mock('../../api/profile', () => ({
  getProfile: jest.fn(),
  getProfileSummary: jest.fn(),
}));

jest.mock('../../api/groups', () => ({
  getMyGroups: jest.fn(),
}));

jest.mock('../../api/home', () => ({
  getCachedBanners: jest.fn(),
}));

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileHome'>;

describe('ProfileScreen skills card', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getProfile as jest.Mock).mockResolvedValue({
      id: 'u-1',
      email: 'test@example.com',
      nickname: 'tester',
      display_name: 'Test User',
      skill_levels: [{ sport: 'badminton', skill_level: 'beginner' }],
    });
    (getProfileSummary as jest.Mock).mockResolvedValue({
      games_played: 2,
      games_hosted: 1,
      groups_count: 0,
      recent_games: [],
    });
    (getMyGroups as jest.Mock).mockResolvedValue({ items: [], total: 0 });
    (getCachedBanners as jest.Mock).mockResolvedValue(null);
  });

  it("renders 'beginner' API value as 'Beginner' with warning colour", async () => {
    const mockNavigation = {
      navigate: jest.fn(),
      goBack: jest.fn(),
      addListener: jest.fn(() => jest.fn()),
      isFocused: jest.fn(() => true),
    } as unknown as Props['navigation'];

    const mockRoute = {
      key: 'ProfileHome',
      name: 'ProfileHome' as const,
    } as Props['route'];

    const root = await renderAsync(
      <NavigationContainer>
        <ProfileScreen navigation={mockNavigation} route={mockRoute} />
      </NavigationContainer>,
    );

    const allTexts = texts(root);
    expect(allTexts).toContain('Beginner');
    expect(allTexts).not.toContain('beginner');

    // Find the skill level text node
    const levelTextNode = root.find(
      node =>
        (node.type as unknown) === 'Text' &&
        Array.isArray(node.children) &&
        node.children.includes('Beginner'),
    );

    expect(levelTextNode).toBeDefined();

    // Check warning colour on text
    const textStyle = Array.isArray(levelTextNode.props.style)
      ? Object.assign({}, ...levelTextNode.props.style)
      : levelTextNode.props.style;
    expect(textStyle.color).toBe(colors.warning);

    // Check warningLight background on skill tile
    const skillTileNode = root.find(
      node =>
        (node.type as unknown) === 'View' &&
        node.props.style &&
        (Array.isArray(node.props.style)
          ? node.props.style.some(
              (s: any) => s && s.backgroundColor === colors.warningLight,
            )
          : node.props.style.backgroundColor === colors.warningLight),
    );
    expect(skillTileNode).toBeDefined();
  });
});
