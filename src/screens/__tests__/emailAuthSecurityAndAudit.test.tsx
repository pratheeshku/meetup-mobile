declare const require: (id: string) => any;
declare const __dirname: string;

const fs = require('fs');
const path = require('path');

import { apiClient } from '../../api/client';
import {
  login,
  requestPasswordReset,
  resendVerification,
  signup,
  verifyEmail,
} from '../../auth/emailAuth';

jest.mock('../../api/client', () => ({
  apiClient: {
    post: jest.fn(),
  },
}));

jest.mock('../../storage/tokens', () => ({
  saveTokens: jest.fn(),
}));

describe('Email Auth Security & Audit (DES-MEETUP-ADDENDUM-email-auth AD-5, R-111, P10)', () => {
  const SENSITIVE_PASSWORD = 'superSecretPassword99!';
  const SENSITIVE_CODE = '849201';
  const SENSITIVE_TOKEN = 'secret-token-abc-123';

  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.post as jest.Mock).mockReset();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('[Execute] passwords, codes, and tokens are never printed to console logs during auth operations', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({
      data: { access_token: SENSITIVE_TOKEN, refresh_token: 'refresh-xyz', user: { id: 'u1' } },
    });

    // 1. Signup
    await signup({
      email: 'user@example.com',
      password: SENSITIVE_PASSWORD,
      display_name: 'User',
      nickname: 'user',
    });

    // 2. Login
    await login('user@example.com', SENSITIVE_PASSWORD);

    // 3. Verify
    await verifyEmail('user@example.com', SENSITIVE_CODE);

    // 4. Resend
    await resendVerification('user@example.com');

    // 5. Reset password request
    await requestPasswordReset('user@example.com');

    // Collect all arguments passed to any console logger
    const allLoggedArgs = [
      ...logSpy.mock.calls.flat(),
      ...warnSpy.mock.calls.flat(),
      ...errorSpy.mock.calls.flat(),
    ].map(arg => (typeof arg === 'string' ? arg : JSON.stringify(arg)));

    for (const entry of allLoggedArgs) {
      expect(entry).not.toContain(SENSITIVE_PASSWORD);
      expect(entry).not.toContain(SENSITIVE_CODE);
      expect(entry).not.toContain(SENSITIVE_TOKEN);
    }
  });

  it('[Execute] verifies exact endpoint and payload contracts for all auth helper functions', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });

    // signup
    await signup({
      email: 'bob@example.com',
      password: 'password123',
      display_name: 'Bob',
      nickname: 'bobbie',
    });
    expect(apiClient.post).toHaveBeenCalledWith('/auth/signup', {
      email: 'bob@example.com',
      password: 'password123',
      display_name: 'Bob',
      nickname: 'bobbie',
      terms_version: expect.any(String),
    });

    // verifyEmail
    await verifyEmail('bob@example.com', '654321');
    expect(apiClient.post).toHaveBeenCalledWith('/auth/verify-email', {
      email: 'bob@example.com',
      code: '654321',
    });

    // resendVerification
    await resendVerification('bob@example.com');
    expect(apiClient.post).toHaveBeenCalledWith('/auth/resend-verification', {
      email: 'bob@example.com',
    });

    // requestPasswordReset
    await requestPasswordReset('bob@example.com');
    expect(apiClient.post).toHaveBeenCalledWith('/auth/reset-password-request', {
      email: 'bob@example.com',
    });
  });

  it('[Execute] resendVerification is available and calls the endpoint directly', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });
    await resendVerification('live@example.com');
    expect(apiClient.post).toHaveBeenCalledWith('/auth/resend-verification', {
      email: 'live@example.com',
    });
  });

  it('[Source check] confirms navigation route params never contain password, code, or token fields', () => {
    const typesPath = path.resolve(__dirname, '../../navigation/types.ts');
    const typesContent = fs.readFileSync(typesPath, 'utf8');

    // Extract AuthStackParamList block
    const match = typesContent.match(/export type AuthStackParamList = (\{[\s\S]*?\n\};)/);
    expect(match).toBeTruthy();
    const authStackContent = match![1];

    expect(authStackContent).not.toContain('password');
    expect(authStackContent).not.toContain('code');
    expect(authStackContent).not.toContain('token');
  });

  it('[Source check] confirms no console.log calls exist in auth screens or emailAuth', () => {
    const filesToCheck = [
      path.resolve(__dirname, '../RegisterScreen.tsx'),
      path.resolve(__dirname, '../VerifyScreen.tsx'),
      path.resolve(__dirname, '../LoginScreen.tsx'),
      path.resolve(__dirname, '../ForgotPasswordScreen.tsx'),
      path.resolve(__dirname, '../../auth/emailAuth.ts'),
    ];

    for (const file of filesToCheck) {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).not.toMatch(/console\.(log|warn|error|info)\(.*(password|code|token)/i);
    }
  });
});
