import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { Strategy as GoogleStrategy }           from 'passport-google-oauth20';
import { Strategy as GitHubStrategy }           from 'passport-github2';
import { db }    from './db';
import { redis } from './redis';

// ─── JWT (always active) ──────────────────────────────────────────────────────
passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey:    process.env.JWT_SECRET!,
    },
    async (payload, done) => {
      try {
        const blacklisted = await redis.get(`blacklist:${payload.jti}`);
        if (blacklisted) return done(null, false);

        const { rows } = await db.query(
          'SELECT id, handle, email, verified, premium_tier, suspended FROM users WHERE id = $1',
          [payload.sub]
        );
        if (!rows[0] || rows[0].suspended) return done(null, false);
        return done(null, rows[0]);
      } catch (err) {
        return done(err, false);
      }
    }
  )
);

// ─── Google OAuth (only if credentials are set) ───────────────────────────────
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID:     process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:  process.env.GOOGLE_CALLBACK_URL!,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) return done(new Error('No email from Google'));

          const { rows } = await db.query(
            `INSERT INTO users (handle, email, display_name, avatar_url, email_verified)
             VALUES ($1, $2, $3, $4, TRUE)
             ON CONFLICT (email) DO UPDATE
               SET display_name = EXCLUDED.display_name,
                   avatar_url   = EXCLUDED.avatar_url
             RETURNING id, handle, email, verified, premium_tier`,
            [
              email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_'),
              email,
              (profile as any).displayName,
              (profile as any).photos?.[0]?.value,
            ]
          );

          await db.query(
            `INSERT INTO oauth_accounts (user_id, provider, provider_user_id)
             VALUES ($1, 'google', $2)
             ON CONFLICT (provider, provider_user_id) DO NOTHING`,
            [rows[0].id, profile.id]
          );

          return done(null, rows[0]);
        } catch (err) {
          return done(err as Error);
        }
      }
    )
  );
  console.log('[Passport] Google OAuth enabled');
} else {
  console.log('[Passport] Google OAuth disabled — GOOGLE_CLIENT_ID not set');
}

// ─── GitHub OAuth (only if credentials are set) ───────────────────────────────
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(
    new GitHubStrategy(
      {
        clientID:     process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL:  process.env.GITHUB_CALLBACK_URL!,
        scope:        ['user:email'],
      },
      async (_accessToken: string, _refreshToken: string, profile: any, done: any) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) return done(new Error('No email from GitHub'));

          const { rows } = await db.query(
            `INSERT INTO users (handle, email, display_name, avatar_url, email_verified)
             VALUES ($1, $2, $3, $4, TRUE)
             ON CONFLICT (email) DO UPDATE
               SET display_name = EXCLUDED.display_name
             RETURNING id, handle, email, verified, premium_tier`,
            [
              (profile.username || email.split('@')[0]).toLowerCase().replace(/[^a-z0-9_]/g, '_'),
              email,
              profile.displayName || profile.username,
              profile.photos?.[0]?.value,
            ]
          );

          await db.query(
            `INSERT INTO oauth_accounts (user_id, provider, provider_user_id)
             VALUES ($1, 'github', $2)
             ON CONFLICT (provider, provider_user_id) DO NOTHING`,
            [rows[0].id, String(profile.id)]
          );

          return done(null, rows[0]);
        } catch (err) {
          return done(err);
        }
      }
    )
  );
  console.log('[Passport] GitHub OAuth enabled');
} else {
  console.log('[Passport] GitHub OAuth disabled — GITHUB_CLIENT_ID not set');
}

export default passport;