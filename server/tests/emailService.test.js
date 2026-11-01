const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-message-id' });
const mockCreateTransport = jest.fn(() => ({ sendMail: mockSendMail }));

jest.mock('nodemailer', () => ({ createTransport: mockCreateTransport }));

describe('email service Nodemailer integration', () => {
  let emailService;
  const originalEnvironment = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.SMTP_HOST = 'smtp.example.test';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'smtp-user@example.test';
    process.env.SMTP_PASS = 'smtp-password';
    process.env.EMAIL_FROM = 'Social AI <no-reply@example.test>';
    process.env.CLIENT_ORIGIN = 'https://social.example.test';
    emailService = require('../src/services/emailService');
  });

  afterAll(() => {
    process.env = originalEnvironment;
  });

  it('sends verification email using the configured SMTP transport', async () => {
    await emailService.sendVerificationEmail(
      'user@example.test',
      'test-user',
      'verification-token',
      'user-id'
    );

    expect(mockCreateTransport).toHaveBeenCalledWith({
      host: 'smtp.example.test',
      port: 587,
      secure: false,
      auth: {
        user: 'smtp-user@example.test',
        pass: 'smtp-password',
      },
    });
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Social AI <no-reply@example.test>',
        to: 'user@example.test',
        subject: 'Verify your Social AI account',
      })
    );
    expect(mockSendMail.mock.calls[0][0].html).toContain(
      'https://social.example.test/verify-email?userId=user-id&token=verification-token'
    );
  });

  it('sends password reset email using the same transport', async () => {
    await emailService.sendPasswordResetEmail(
      'user@example.test',
      'test-user',
      'reset-token',
      'user-id'
    );

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.test',
        subject: 'Reset your Social AI password',
      })
    );
    expect(mockSendMail.mock.calls[0][0].html).toContain(
      'https://social.example.test/reset-password?userId=user-id&token=reset-token'
    );
  });

  it('sends admin login alerts without logging SMTP credentials', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await emailService.sendAdminLoginAlert(
      'admin@example.test',
      'admin-user',
      '192.0.2.10',
      'test-browser'
    );

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@example.test',
        subject: 'Security Alert: Admin login to Social AI',
      })
    );
    expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('smtp-password'));
    consoleSpy.mockRestore();
  });
});
