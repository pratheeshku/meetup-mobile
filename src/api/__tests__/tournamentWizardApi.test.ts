import { apiClient } from '../client';
import { createWizardTournament, getWizardTemplates } from '../tournaments';
import { TEMPLATES, createdResult } from '../../test-utils/tournamentWizardFixtures';
import type { WizardCreateBody } from '../../types/tournamentWizard';

jest.mock('../client', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));

const get = apiClient.get as jest.Mock;
const post = apiClient.post as jest.Mock;

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

describe('getWizardTemplates', () => {
  it('reads GET /tournaments/v2/templates with the correlation id and keeps the limits', async () => {
    get.mockResolvedValueOnce({ data: TEMPLATES });
    const out = await getWizardTemplates({ correlationId: 'c-1' });
    expect(get).toHaveBeenCalledWith('/tournaments/v2/templates', { correlationId: 'c-1' });
    expect(out.limits?.min_gap_hours).toBe(0);
    expect(out.templates).toHaveLength(2);
  });

  it('the flag-off answer is an empty list, never undefined', async () => {
    get.mockResolvedValueOnce({ data: { templates: [] } });
    expect((await getWizardTemplates()).templates).toEqual([]);
    get.mockResolvedValueOnce({ data: {} });
    expect((await getWizardTemplates()).templates).toEqual([]);
  });
});

describe('createWizardTournament', () => {
  const body = { client_request_id: 'req-1' } as unknown as WizardCreateBody;

  it('201 is a new tournament, 200 is the replay of the same client_request_id: both are success', async () => {
    post.mockResolvedValueOnce({ status: 201, data: createdResult() });
    const first = await createWizardTournament(body, { correlationId: 'c-1' });
    expect(post).toHaveBeenCalledWith('/tournaments/v2/create', body, { correlationId: 'c-1' });
    expect(first).toMatchObject({ replayed: false, result: { id: 'tour-1' } });

    post.mockResolvedValueOnce({ status: 200, data: createdResult() });
    expect(await createWizardTournament(body)).toMatchObject({ replayed: true, result: { id: 'tour-1' } });
  });

  it('a rejection propagates with its body for the field mapping', async () => {
    post.mockRejectedValueOnce({ response: { status: 422, data: { code: 'TOURNAMENT_DATES_INVALID' } } });
    await expect(createWizardTournament(body)).rejects.toMatchObject({ response: { status: 422 } });
  });
});
