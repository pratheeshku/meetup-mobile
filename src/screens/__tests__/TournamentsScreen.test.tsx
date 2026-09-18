/** Tournaments list: direct "+" create entry in the header, and refresh-after-create. */
import React from 'react';

import { getTournaments } from '../../api/tournaments';
import { act, pressableLabelled, render, renderAsync } from '../../test-utils/render';
import TournamentsScreen from '../TournamentsScreen';

type Props = React.ComponentProps<typeof TournamentsScreen>;

jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));
jest.mock('../../api/tournaments', () => ({ getTournaments: jest.fn() }));

const mockGetTournaments = getTournaments as jest.MockedFunction<typeof getTournaments>;
const mockNavigate = jest.fn();
const navigate = mockNavigate;
const setOptions = jest.fn();
const EMPTY = { items: [], total: 0, page: 1, page_size: 0 };

function element(params?: { refreshKey?: number }): React.ReactElement {
  const props = { navigation: { navigate, setOptions }, route: { params } };
  return <TournamentsScreen {...(props as unknown as Props)} />;
}

beforeEach(() => {
  mockGetTournaments.mockReset().mockResolvedValue(EMPTY);
  navigate.mockReset();
  setOptions.mockReset();
});

describe('TournamentsScreen create entry point', () => {
  it('puts a labelled "+" in the header that opens Create Tournament', async () => {
    await renderAsync(element());
    const { headerRight: HeaderRight } = setOptions.mock.calls[0][0];
    const button = render(<HeaderRight />);
    act(() => pressableLabelled(button, 'Create Tournament').props.onPress());
    expect(navigate).toHaveBeenCalledWith('CreateTournament');
  });

  it('keeps the header button even when the list failed to load', async () => {
    mockGetTournaments.mockReset().mockRejectedValue(new Error('down'));
    await renderAsync(element());
    expect(setOptions).toHaveBeenCalledWith({ headerRight: expect.any(Function) });
  });
});

describe('TournamentsScreen refresh after create', () => {
  it('loads once on a normal mount', async () => {
    await renderAsync(element());
    expect(mockGetTournaments).toHaveBeenCalledTimes(1);
  });

  it('re-fetches when returned to with a refreshKey', async () => {
    await renderAsync(element({ refreshKey: 123 }));
    expect(mockGetTournaments).toHaveBeenCalledTimes(2);
  });
});
