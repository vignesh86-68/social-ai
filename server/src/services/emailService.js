const nodemailer = require('nodemailer');

let transporter;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
};

const from = () => process.env.EMAIL_FROM || 'Social AI <no-reply@social-ai.app>';
const clientUrl = () => {
  const origins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',');
  return origins[0].trim();
};

const sendVerificationEmail = async (to, username, token, userId) => {
  const link = `${clientUrl()}/verify-email?userId=${userId}&token=${token}`;
  console.log(`\n📧 [DEV VERIFICATION EMAIL] Verification email prepared for @${username}.\n`);
  try {
    if (process.env.SMTP_USER && !process.env.SMTP_USER.includes('your_email')) {
      await getTransporter().sendMail({
        from: from(),
        to,
        subject: 'Verify your Social AI account',
        html: `
          <div style="font-family:Inter,sans-serif;max-width:480px;margin:auto;padding:32px">
            <h2 style="color:#6366f1">Social AI</h2>
            <p>Hi <strong>${username}</strong>, welcome aboard!</p>
            <p>Please verify your email address by clicking the button below. This link expires in <strong>24 hours</strong>.</p>
            <a href="${link}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Verify Email</a>
            <p style="margin-top:24px;color:#6b7280;font-size:13px">If you did not create an account, you can safely ignore this email.</p>
          </div>`,
      });
    }
  } catch (err) {
    console.warn('⚠️  Could not deliver verification email via SMTP:', err.message);
  }
};

const sendPasswordResetEmail = async (to, username, token, userId) => {
  const link = `${clientUrl()}/reset-password?userId=${userId}&token=${token}`;
  console.log(`\n🔑 [DEV PASSWORD RESET EMAIL] Password reset email prepared for @${username}.\n`);
  try {
    if (process.env.SMTP_USER && !process.env.SMTP_USER.includes('your_email')) {
      await getTransporter().sendMail({
        from: from(),
        to,
        subject: 'Reset your Social AI password',
        html: `
          <div style="font-family:Inter,sans-serif;max-width:480px;margin:auto;padding:32px">
            <h2 style="color:#6366f1">Social AI</h2>
            <p>Hi <strong>${username}</strong>,</p>
            <p>We received a request to reset your password. Click the button below. This link expires in <strong>1 hour</strong>.</p>
            <a href="${link}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Reset Password</a>
            <p style="margin-top:24px;color:#6b7280;font-size:13px">If you did not request this, please secure your account immediately.</p>
          </div>`,
      });
    }
  } catch (err) {
    console.warn('⚠️  Could not deliver password reset email via SMTP:', err.message);
  }
};

const sendAdminLoginAlert = async (adminEmail, username, ip, userAgent) => {
  console.log(`\n🛡️ [DEV ADMIN LOGIN ALERT] Admin @${username} logged in from IP ${ip}\n`);
  try {
    if (process.env.SMTP_USER && !process.env.SMTP_USER.includes('your_email')) {
      await getTransporter().sendMail({
        from: from(),
        to: adminEmail,
        subject: 'Security Alert: Admin login to Social AI',
        html: `
          <div style="font-family:Inter,sans-serif;max-width:480px;margin:auto;padding:32px">
            <h2 style="color:#ef4444">Security Alert</h2>
            <p>A new administrative login was recorded for your account <strong>${username}</strong>.</p>
            <p><strong>IP Address:</strong> ${ip}</p>
            <p><strong>Device:</strong> ${userAgent}</p>
            <p><strong>Timestamp:</strong> ${new Date().toUTCString()}</p>
            <p style="color:#6b7280;font-size:13px">If this was not you, please immediately revoke all sessions and change your credentials.</p>
          </div>`,
      });
    }
  } catch (err) {
    console.warn('⚠️  Could not deliver admin login alert via SMTP:', err.message);
  }
};

const sendAdminInvitationEmail = async (to, token) => {
  const link = `${clientUrl()}/admin/invitations/accept?token=${encodeURIComponent(token)}`;
  try {
    if (process.env.SMTP_USER && !process.env.SMTP_USER.includes('your_email')) {
      await getTransporter().sendMail({
        from: from(),
        to,
        subject: 'Your SOCIAL AI administrator invitation',
        html: `
          <div style="font-family:Inter,sans-serif;max-width:480px;margin:auto;padding:32px">
            <h2 style="color:#6366f1">SOCIAL AI Command Centre</h2>
            <p>You have been invited to create an administrator account.</p>
            <a href="${link}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Accept invitation</a>
            <p style="margin-top:24px;color:#6b7280;font-size:13px">This invitation expires in 24 hours and can only be used once.</p>
          </div>`,
      });
    }
  } catch (err) {
    console.warn('Could not deliver administrator invitation email via SMTP:', err.message);
    throw err;
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendAdminLoginAlert,
  sendAdminInvitationEmail,
};
