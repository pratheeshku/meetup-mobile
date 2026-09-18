/** Tournaments header "+" in a real native stack (regression: same hooks pattern as Groups). */
import { getTournaments } from '../../api/tournaments';
import { describeHeaderAction } from '../../test-utils/headerActionHarness';
import TournamentsScreen from '../TournamentsScreen';

jest.mock('../../api/tournaments', () => ({ getTournaments: jest.fn() }));
(getTournaments as jest.Mock).mockResolvedValue({ items: [], total: 0, page: 1, page_size: 0 });

describeHeaderAction({
  screen: TournamentsScreen as never,
  initial: 'TournamentsList',
  target: 'CreateTournament',
  label: 'Create Tournament',
});
