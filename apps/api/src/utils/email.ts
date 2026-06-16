import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST || 'smtp.gmail.com',
  port:   465,
  secure: true,  // true for 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface MailOptions {
  to:      string;
  subject: string;
  html:    string;
}

export const sendMail = async (opts: MailOptions): Promise<void> => {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    ...opts,
  });
};

export const sendVerificationEmail = async (
  to: string, handle: string, token: string
): Promise<void> => {
  const url = `${process.env.CLIENT_URL}/verify-email?token=${token}`;
  await sendMail({
    to,
    subject: 'Verify your Nexus account',
    html: `
      <h2>Welcome to Nexus, @${handle}!</h2>
      <p>Click the link below to verify your email address.</p>
      <a href="${url}" style="background:#1d9bf0;color:#fff;padding:12px 24px;border-radius:24px;text-decoration:none;font-weight:600">
        Verify email
      </a>
      <p>This link expires in 24 hours.</p>
    `,
  });
};

export const sendPasswordResetEmail = async (
  to: string, handle: string, token: string
): Promise<void> => {
  const url = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
  await sendMail({
    to,
    subject: 'Reset your Nexus password',
    html: `
      <h2>Password reset request</h2>
      <p>Hi @${handle}, we received a request to reset your password.</p>
      <a href="${url}" style="background:#1d9bf0;color:#fff;padding:12px 24px;border-radius:24px;text-decoration:none;font-weight:600">
        Reset password
      </a>
      <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>
    `,
  });
};
