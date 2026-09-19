import { describeError } from '../logSafeError';

describe('describeError', () => {
  it('prefers the HTTP status, then the code, then the name', () => {
    expect(describeError({ response: { status: 503 }, code: 'ERR_BAD_RESPONSE', name: 'AxiosError' })).toBe('503');
    expect(describeError({ code: 'ECONNABORTED', name: 'AxiosError' })).toBe('ECONNABORTED');
    expect(describeError(new TypeError('x'))).toBe('TypeError');
  });

  it('never echoes message, config or headers', () => {
    const error = Object.assign(new Error('Bearer secret-token'), {
      code: 'ERR_NETWORK',
      config: { headers: { Authorization: 'Bearer secret-token' }, data: '{"deviceToken":"t"}' },
    });
    const tag = describeError(error);
    expect(tag).toBe('ERR_NETWORK');
    expect(tag).not.toContain('secret');
  });

  it('returns "unknown" for non-objects and unrecognisable shapes', () => {
    expect(describeError(null)).toBe('unknown');
    expect(describeError('Bearer abc')).toBe('unknown');
    expect(describeError({})).toBe('unknown');
    expect(describeError({ code: { nested: true } })).toBe('unknown');
  });
});
