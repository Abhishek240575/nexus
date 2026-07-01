import passport from 'passport';
import { Strategy as GoogleStrategy }  from 'passport-google-oauth20';
import { Strategy as GitHubStrategy }  from 'passport-github2';
import { db } from './db';
import { v4 as uuidv4 } from 'uuid';

const BACKEND = process.env.BACKEND_URL || 'https://nexus-api-dvhz.onrender.com';

// ─── Generate unique handle from name ─────────────────────────────────────────
const makeHandle = async (base: string): Promise<string> => {
  const cleaned = base.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20) || 'user';
  let handle    = cleaned;
  let suffix    = 1;
  while (true) {
    const { rows } = await db.query('SELECT id FROM users WHERE handle = $1', [handle]);
    if (!rows[0]) return handle;
    handle = `${cleaned}${suffix++}`;
  }
};

// ─── Find or create user from OAuth profile ───────────────────────────────────
const findOrCreateOAuthUser = async (
  provider: 'google' | 'github',
  providerId: string,
  email: string,
  displayName: string,
  avatarUrl?: string
) => {
  // Check if user exists by email
  const { rows: existing } = await db.query(
    `SELECT * FROM users WHERE email = $1`, [email.toLowerCase()]
  );

  if (existing[0]) {
    // Update OAuth provider ID if not set
    await db.query(
      `UPDATE users SET ${provider}_id = $1, avatar_url = COALESCE(avatar_url, $2) WHERE id = $3`,
      [providerId, avatarUrl || null, existing[0].id]
    ).catch(() => {});
    return existing[0];
  }

  // Create new user
  const handle = await makeHandle(displayName.split(' ')[0] || 'user');
  const { rows } = await db.query(
    `INSERT INTO users (id, handle, email, display_name, avatar_url, email_verified, ${provider}_id, premium_tier, is_onboarded)
     VALUES ($1, $2, $3, $4, $5, TRUE, $6, 'free', FALSE)
     RETURNING *`,
    [uuidv4(), handle, email.toLowerCase(), displayName, avatarUrl || null, providerId]
  );

  // Record consent
  await db.query(
    `INSERT INTO user_consents (user_id, consent_type, granted, version) VALUES ($1, 'terms', TRUE, '1.0'), ($1, 'privacy', TRUE, '1.0')`,
    [rows[0].id]
  ).catch(() => {});

  return rows[0];
};

// ─── Google Strategy ──────────────────────────────────────────────────────────
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID:     process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:  `${BACKEND}/api/auth/google/callback`,
  }, async (_accessToken, _refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      if (!email) return done(new Error('No email from Google'), false);
      const user = await findOrCreateOAuthUser(
        'google', profile.id, email,
        profile.displayName || email.split('@')[0],
        profile.photos?.[0]?.value
      );
      done(null, user);
    } catch (err) {
      done(err as Error, false);
    }
  }));
  console.log('[Passport] Google OAuth enabled');
} else {
  console.log('[Passport] Google OAuth disabled — GOOGLE_CLIENT_ID not set');
}

// ─── GitHub Strategy ──────────────────────────────────────────────────────────
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(new GitHubStrategy({
    clientID:     process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL:  `${BACKEND}/api/auth/github/callback`,
  }, async (_accessToken: string, _refreshToken: string, profile: any, done: any) => {
    try {
      const email = profile.emails?.[0]?.value || `${profile.username}@github.deemona.in`;
      const user  = await findOrCreateOAuthUser(
        'github', profile.id, email,
        profile.displayName || profile.username || 'github_user',
        profile.photos?.[0]?.value
      );
      done(null, user);
    } catch (err) {
      done(err as Error, false);
    }
  }));
  console.log('[Passport] GitHub OAuth enabled');
} else {
  console.log('[Passport] GitHub OAuth disabled — GITHUB_CLIENT_ID not set');
}

export default passport;
