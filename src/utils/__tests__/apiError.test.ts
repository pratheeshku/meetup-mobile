import { getApiErrorMessage } from '../apiError';

const FALLBACK = 'Something went wrong.';
const httpError = (status: number, detail?: unknown) => ({ response: { status, data: { detail } } });

describe('getApiErrorMessage', () => {
  it('shows a string detail from a 4xx response', () => {
    expect(getApiErrorMessage(httpError(409, 'Group name already taken'), FALLBACK)).toBe(
      'Group name already taken',
    );
  });

  it('formats 422 validation details as "field: message" lines (HTTPValidationError shape)', () => {
    const error = httpError(422, [
      { loc: ['body', 'capacity'], msg: 'Input should be greater than 1', type: 'greater_than' },
      { loc: ['body', 'registration_closes_at'], msg: 'Invalid date', type: 'value_error' },
    ]);
    expect(getApiErrorMessage(error, FALLBACK)).toBe(
      'capacity: Input should be greater than 1\nregistration closes at: Invalid date',
    );
  });

  it('falls back for 5xx, network errors and unexpected shapes (no internals leaked)', () => {
    expect(getApiErrorMessage(httpError(500, 'Traceback ...'), FALLBACK)).toBe(FALLBACK);
    expect(getApiErrorMessage(new Error('Network Error'), FALLBACK)).toBe(FALLBACK);
    expect(getApiErrorMessage(null, FALLBACK)).toBe(FALLBACK);
    expect(getApiErrorMessage(httpError(422, { weird: true }), FALLBACK)).toBe(FALLBACK);
  });

  it('gives a permission message for a 403 with no usable detail', () => {
    expect(getApiErrorMessage(httpError(403), FALLBACK)).toBe(
      'You do not have permission to do this.',
    );
  });
});
