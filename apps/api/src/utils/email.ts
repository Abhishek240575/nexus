const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL     = 'Deemona <onboarding@resend.dev>';

interface MailOptions {
  to:      string;
  subject: string;
  html:    string;
}

export const sendMail = async (opts: MailOptions): Promise<void> => {
  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    FROM_EMAIL,
      to:      [opts.to],
      subject: opts.subject,
      html:    opts.html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error: ${err}`);
  }
};

export const sendVerificationEmail = async (
  to: string, handle: string, token: string
): Promise<void> => {
  const url = `${process.env.CLIENT_URL}/verify-email?token=${token}`;
  await sendMail({
    to,
    subject: 'Verify your Deemona account',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1d9bf0">Welcome to Deemona, @${handle}!</h2>
        <p>Click the button below to verify your email address.</p>
        <a href="${url}" style="display:inline-block;background:#1d9bf0;color:#fff;padding:12px 28px;border-radius:24px;text-decoration:none;font-weight:600;margin:16px 0">
          Verify email
        </a>
        <p style="color:#666;font-size:14px">This link expires in 24 hours. If you did not create a Deemona account, ignore this email.</p>
      </div>
    `,
  });
};

export const sendPasswordResetEmail = async (
  to: string, handle: string, token: string
): Promise<void> => {
  const url = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
  await sendMail({
    to,
    subject: 'Reset your Deemona password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1d9bf0">Password reset request</h2>
        <p>Hi @${handle}, we received a request to reset your Deemona password.</p>
        <a href="${url}" style="display:inline-block;background:#1d9bf0;color:#fff;padding:12px 28px;border-radius:24px;text-decoration:none;font-weight:600;margin:16px 0">
          Reset password
        </a>
        <p style="color:#666;font-size:14px">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
};
