import { Request, Response } from 'express';
import bcrypt   from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db }   from '../config/db';
import { redis } from '../config/redis';
import {
  signAccessToken, signRefreshToken,
  verifyRefreshToken, blacklistToken,
  storeRefreshToken, deleteRefreshToken,
  getStoredRefreshToken,
} from '../utils/jwt';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from '../utils/email';
import * as R from '../utils/response';
import { AuthenticatedRequest } from '../types';

// ─── Register ─────────────────────────────────────────────────────────────────
export const register = async (req: Request, res: Response): Promise<void> => {
  const { handle, email, password, display_name } = req.body;

  // Check uniqueness
  const existing = await db.query(
    'SELECT id FROM users WHERE handle = $1 OR email = $2',
    [handle.toLowerCase(), email.toLowerCase()]
  );
  if (existing.rows[0]) {
    R.conflict(res, 'Handle or email already taken');
    return;
  }

  const password_hash = await bcrypt.hash(password, 12);
  const verifyToken   = uuidv4();

  const { rows } = await db.query(
    `INSERT INTO users (handle, email, password_hash, display_name)
     VALUES ($1, $2, $3, $4)
     RETURNING id, handle, email, display_name, verified, premium_tier`,
    [handle.toLowerCase(), email.toLowerCase(), password_hash, display_name || handle]
  );

  const user = rows[0];

  // Store email verification token in Redis (24h TTL)
  await redis.setex(`verify:${verifyToken}`, 86400, user.id);

  // Record consent at registration
  await db.query(
    `INSERT INTO user_consents (user_id, consent_type, granted, ip_address, version)
     VALUES ($1, 'terms', TRUE, $2, '1.0'), ($1, 'privacy', TRUE, $2, '1.0')`,
    [user.id, req.ip]
  ).catch(() => {}); // non-blocking

  // Send verification email — non-blocking, don't fail registration if email fails
  sendVerificationEmail(email, handle, verifyToken).catch(err => {
    console.error('[Email] Failed to send verification email:', err?.message);
  });

  R.created(res, {
    message: 'Account created. Please check your email to verify your account.',
  }, 'Account created. Please verify your email.');
};

// ─── Login ────────────────────────────────────────────────────────────────────
export const login = async (req: Request, res: Response): Promise<void> => {
  const { identifier, password } = req.body; // identifier = email or handle

  const { rows } = await db.query(
    'SELECT * FROM users WHERE email = $1 OR handle = $1',
    [identifier.toLowerCase()]
  );

  const user = rows[0];
  if (!user) { R.unauthorized(res, 'Invalid credentials'); return; }
  if (user.suspended) { R.forbidden(res, 'Account suspended'); return; }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) { R.unauthorized(res, 'Invalid credentials'); return; }

  const accessToken  = signAccessToken(user);
  const refreshToken = signRefreshToken(user.id);
  await storeRefreshToken(user.id, refreshToken);

  R.ok(res, {
    user: {
      id:           user.id,
      handle:       user.handle,
      email:        user.email,
      display_name: user.display_name,
      avatar_url:   user.avatar_url,
      verified:     user.verified,
      premium_tier: user.premium_tier,
      is_onboarded: user.is_onboarded ?? false,
    },
    access_token:  accessToken,
    refresh_token: refreshToken,
  });
};

// ─── Refresh token ────────────────────────────────────────────────────────────
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  const { refresh_token } = req.body;
  if (!refresh_token) { R.badRequest(res, 'Refresh token required'); return; }

  let payload: any;
  try {
    payload = verifyRefreshToken(refresh_token);
  } catch {
    R.unauthorized(res, 'Invalid or expired refresh token');
    return;
  }

  const stored = await getStoredRefreshToken(payload.sub);
  if (stored !== refresh_token) {
    R.unauthorized(res, 'Refresh token reuse detected');
    return;
  }

  const { rows } = await db.query(
    'SELECT id, handle, premium_tier, suspended FROM users WHERE id = $1',
    [payload.sub]
  );
  if (!rows[0] || rows[0].suspended) { R.unauthorized(res); return; }

  const newAccessToken  = signAccessToken(rows[0]);
  const newRefreshToken = signRefreshToken(rows[0].id);
  await storeRefreshToken(rows[0].id, newRefreshToken);

  R.ok(res, { access_token: newAccessToken, refresh_token: newRefreshToken });
};

// ─── Logout ───────────────────────────────────────────────────────────────────
export const logout = async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthenticatedRequest).user;

  // Blacklist current access token (extract jti from auth header)
  const token   = req.headers.authorization?.split(' ')[1];
  if (token) {
    try {
      const { jti, exp, iat } = require('../utils/jwt').verifyAccessToken(token);
      const ttl = (exp || 0) - Math.floor(Date.now() / 1000);
      if (ttl > 0) await blacklistToken(jti, ttl);
    } catch { /* already expired */ }
  }

  await deleteRefreshToken(user.id);
  R.ok(res, null, 'Logged out');
};

// ─── Verify email ─────────────────────────────────────────────────────────────
export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  const { token } = req.query as { token: string };
  if (!token) { res.redirect(`${process.env.FRONTEND_URL || 'https://nexus-web-bjks.onrender.com'}/login?error=invalid_token`); return; }

  const userId = await redis.get(`verify:${token}`);
  if (!userId) { res.redirect(`${process.env.FRONTEND_URL || 'https://nexus-web-bjks.onrender.com'}/login?error=expired_token`); return; }

  await db.query(
    'UPDATE users SET email_verified = TRUE, verified = TRUE WHERE id = $1',
    [userId]
  );
  await redis.del(`verify:${token}`);

  // Redirect to login with success message
  res.redirect(`${process.env.FRONTEND_URL || 'https://nexus-web-bjks.onrender.com'}/login?verified=1`);
};

// ─── Forgot password ──────────────────────────────────────────────────────────
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;
  const { rows }  = await db.query(
    'SELECT id, handle FROM users WHERE email = $1',
    [email.toLowerCase()]
  );
  // Always return 200 to avoid email enumeration
  if (!rows[0]) { R.ok(res, null, 'If that email exists, a reset link has been sent'); return; }

  const resetToken = uuidv4();
  await redis.setex(`reset:${resetToken}`, 3600, rows[0].id); // 1h TTL
  await sendPasswordResetEmail(email, rows[0].handle, resetToken);

  R.ok(res, null, 'If that email exists, a reset link has been sent');
};

// ─── Reset password ───────────────────────────────────────────────────────────
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  const { token, password } = req.body;

  const userId = await redis.get(`reset:${token}`);
  if (!userId) { R.badRequest(res, 'Invalid or expired reset link'); return; }

  const password_hash = await bcrypt.hash(password, 12);
  await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [password_hash, userId]);
  await redis.del(`reset:${token}`);
  await deleteRefreshToken(userId); // force re-login everywhere

  R.ok(res, null, 'Password updated. Please log in.');
};

// ─── OAuth success callback (redirect with tokens) ────────────────────────────
export const oauthSuccess = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  if (!user) { res.redirect(`${process.env.CLIENT_URL}/login?error=oauth_failed`); return; }

  const accessToken  = signAccessToken(user);
  const refreshToken = signRefreshToken(user.id);
  await storeRefreshToken(user.id, refreshToken);

  res.redirect(
    `${process.env.CLIENT_URL}/auth/callback?access_token=${accessToken}&refresh_token=${refreshToken}`
  );
};

// ─── Get current user (me) ────────────────────────────────────────────────────
export const getMe = async (req: Request, res: Response): Promise<void> => {
  const { id } = (req as AuthenticatedRequest).user;

  const { rows } = await db.query(
    `SELECT id, handle, email, display_name, bio, avatar_url, header_url,
            location, website, verified, premium_tier,
            followers_count, following_count, posts_count,
            email_verified, created_at
     FROM users WHERE id = $1`,
    [id]
  );

  if (!rows[0]) { R.notFound(res, 'User not found'); return; }
  R.ok(res, rows[0]);
};
