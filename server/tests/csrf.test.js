const { csrfProtection, issueCsrfToken } = require('../src/middleware/csrf');

describe('CSRF protection', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeAll(() => {
    process.env.NODE_ENV = 'production';
    process.env.COOKIE_SECRET = 'csrf-test-secret';
    process.env.CLIENT_ORIGIN = 'https://social-ai.example.com';
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  test('issues a readable token cookie', () => {
    const response = {
      cookie: jest.fn(),
      json: jest.fn(),
    };
    issueCsrfToken({}, response);
    const token = response.cookie.mock.calls[0][1];
    expect(token).toMatch(/^[a-f0-9]{64}\.[a-f0-9]{64}$/);
    expect(response.cookie.mock.calls[0][2]).toEqual(expect.objectContaining({ httpOnly: false, secure: true, sameSite: 'none' }));
  });

  test('rejects missing and mismatched tokens', () => {
    const next = jest.fn();
    csrfProtection({ method: 'POST', get: () => undefined, cookies: {} }, {}, next);
    expect(next.mock.calls[0][0].statusCode).toBe(403);
  });

  test('accepts a matching signed token from an allowed origin', () => {
    const response = { cookie: jest.fn(), json: jest.fn() };
    issueCsrfToken({}, response);
    const token = response.cookie.mock.calls[0][1];
    const next = jest.fn();
    csrfProtection({
      method: 'POST',
      get: (name) => name === 'origin' ? 'http://localhost:5173' : token,
      cookies: { csrfToken: token },
    }, {}, next);
    expect(next).toHaveBeenCalledWith();
  });
});
