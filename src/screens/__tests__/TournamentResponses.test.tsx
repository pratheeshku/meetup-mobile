import React from 'react';
import { act, pressableLabelled, renderAsync, texts } from '../../test-utils/render';
import {
  mockGet,
  mockPost,
  mountTournament,
  rawTournament,
} from '../../test-utils/tournamentDetailHarness';
import TournamentDetailScreen from '../TournamentDetailScreen';

jest.mock('../../api/client', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn().mockResolvedValue({ items: [] }) }));
jest.mock('../../api/users', () => ({ searchUsers: jest.fn().mockResolvedValue([]) }));
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-me' } }) }));

describe('TournamentDetailScreen decline and responses', () => {
  it('shows Decline button for an open tournament and calls declineTournament', async () => {
    mockGet.mockReset().mockImplementation((url: string) => {
      if (url === '/tournaments/t-1') {
        return Promise.resolve({
          data: rawTournament({
            registration_open: true,
          }),
        });
      }
      if (url === '/tournaments/t-1/registrations') return Promise.resolve({ data: [] });
      if (url === '/tournaments/t-1/fixtures') return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });

    const props = {
      route: { key: 'k', name: 'TournamentDetail', params: { tournamentId: 't-1' } },
      navigation: {},
    } as any;
    const root = await renderAsync(<TournamentDetailScreen {...props} />);
    const content = texts(root).join(' ');
    expect(content).toContain('Decline');

    const declineBtn = pressableLabelled(root, 'Decline');
    await act(async () => {
      declineBtn.props.onPress();
    });

    expect(mockPost).toHaveBeenCalledWith(
      '/tournaments/t-1/decline',
      {},
      expect.any(Object),
    );
  });

  it('shows Declined status chip and recovery Register button when tournament was declined', async () => {
    const root = await mountTournament({
      my_registration_status: null,
      my_declined: true,
      status: 'upcoming',
    });
    const content = texts(root).join(' ');

    expect(content).toContain('Declined');
    expect(content).toContain('Register');

    const registerBtn = pressableLabelled(root, 'Register');
    await act(async () => {
      registerBtn.props.onPress();
    });
    // Register opens the confirmation sheet (tr-mobile); Confirm sends the request.
    await act(async () => {
      pressableLabelled(root, 'Confirm').props.onPress();
    });

    expect(mockPost).toHaveBeenCalledWith(
      '/tournaments/t-1/registrations',
      undefined,
      expect.any(Object),
    );
  });

  it('renders ResponsesSection when responses are returned', async () => {
    mockGet.mockReset().mockImplementation((url: string) => {
      if (url === '/tournaments/t-1') {
        return Promise.resolve({
          data: rawTournament({
            organizer_id: 'user-me',
          }),
        });
      }
      if (url === '/tournaments/t-1/responses') {
        return Promise.resolve({
          data: {
            accepted: { total: 1, items: [{ user_id: 'u1', display_name: 'Alice', photo_url: null, waitlisted: false }] },
            pending: { total: 0, items: [] },
            declined: { total: 1, items: [{ user_id: 'u2', display_name: 'Bob', photo_url: null, via: 'invitation' }] },
          },
        });
      }
      if (url === '/tournaments/t-1/fixtures') return Promise.resolve({ data: [] });
      if (url === '/tournaments/t-1/registrations') return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });

    const props = {
      route: { key: 'k', name: 'TournamentDetail', params: { tournamentId: 't-1' } },
      navigation: {},
    } as any;
    const root = await renderAsync(<TournamentDetailScreen {...props} />);
    const content = texts(root).join(' ');

    expect(content).toContain('Responses');
    expect(content).toContain('Accepted');
    expect(content).toContain('Alice');
    expect(content).toContain('Declined');
    expect(content).toContain('Bob');
  });
});
