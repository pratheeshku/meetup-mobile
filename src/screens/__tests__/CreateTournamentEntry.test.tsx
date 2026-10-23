/** The Create tournament entry: the wizard when a groups and knockout format is published, the v1 form otherwise. */
import React from 'react';

import { getClientConfig } from '../../api/config';
import { getGameLimits } from '../../api/config';
import { getMyGroups } from '../../api/groups';
import { getSports } from '../../api/sports';
import { createTournament, getWizardTemplates } from '../../api/tournaments';
import { act, renderAsync } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { KNOCKOUT_TEMPLATE, TEMPLATES } from '../../test-utils/tournamentWizardFixtures';
import CreateGameScreen from '../CreateGameScreen';

jest.mock('../../api/config', () => ({ getClientConfig: jest.fn(), getGameLimits: jest.fn() }));
jest.mock('../../api/sports', () => ({ getSports: jest.fn() }));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn() }));
jest.mock('../../api/events', () => ({ createEvent: jest.fn(), inviteEmailToEvent: jest.fn() }));
jest.mock('../../api/users', () => ({ searchUsers: jest.fn() }));
jest.mock('../../api/tournaments', () => ({ createTournament: jest.fn(), getWizardTemplates: jest.fn() }));
jest.mock('../../navigation/showCompletion', () => ({ showCompletion: jest.fn() }));

type Props = React.ComponentProps<typeof CreateGameScreen>;

async function mount(): Promise<{ root: Instance; navigate: jest.Mock }> {
  const navigate = jest.fn();
  const props = { navigation: { popTo: jest.fn(), navigate, goBack: jest.fn() }, route: { params: undefined } };
  const root = await renderAsync(<CreateGameScreen {...(props as unknown as Props)} />);
  return { root, navigate };
}
const tournamentCard = (root: Instance): Instance =>
  root.findAll(n => n.props.accessibilityRole === 'radio' && typeof n.props.onPress === 'function' && /Tournament/.test(String(n.props.accessibilityLabel)))[0];

beforeEach(() => {
  (getGameLimits as jest.Mock).mockResolvedValue({ players_min: 2, players_max: 100 });
  (getClientConfig as jest.Mock).mockResolvedValue({ google_maps_api_key: null, venue_catalogue_enabled: false });
  (getSports as jest.Mock).mockResolvedValue([{ id: 's1', name: 'badminton', display_name: 'Badminton', icon_key: 'badminton', color: '#000' }]);
  (getMyGroups as jest.Mock).mockResolvedValue({ items: [], total: 0, page: 1, page_size: 1 });
  (createTournament as jest.Mock).mockReset();
  (getWizardTemplates as jest.Mock).mockReset();
});

describe('Create tournament entry (AD-20)', () => {
  it('opens the wizard, with the templates it already fetched, when a groups and knockout format is published', async () => {
    (getWizardTemplates as jest.Mock).mockResolvedValue(TEMPLATES);
    const { root, navigate } = await mount();
    await act(async () => tournamentCard(root).props.onPress());
    expect(navigate).toHaveBeenCalledWith('TournamentWizard', { templates: TEMPLATES });
  });

  it.each([
    ['an empty list (flag off)', { templates: [] }],
    ['only formats this build does not offer', { templates: [KNOCKOUT_TEMPLATE] }],
  ])('keeps the v1 form for %s', async (_name, response) => {
    (getWizardTemplates as jest.Mock).mockResolvedValue(response);
    const { root, navigate } = await mount();
    await act(async () => tournamentCard(root).props.onPress());
    expect(navigate).not.toHaveBeenCalled();
    expect(tournamentCard(root).props.accessibilityState.selected).toBe(true);
  });

  it('keeps the v1 form when the templates call fails', async () => {
    (getWizardTemplates as jest.Mock).mockRejectedValue(new Error('Network Error'));
    const { root, navigate } = await mount();
    await act(async () => tournamentCard(root).props.onPress());
    expect(navigate).not.toHaveBeenCalled();
    expect(tournamentCard(root).props.accessibilityState.selected).toBe(true);
  });
});
