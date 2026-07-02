import { Router } from 'express';
import passport   from '../config/passport';
import { signAccessToken, signRefreshToken, storeRefreshToken } from '../utils/jwt';

const router   = Router();
const FRONTEND = process.env.FRONTEND_URL || 'https://nexus-web-bjks.onrender.com';

const oauthCallback = async (user: any, res: any) => {
  try {
    if (!user) throw new Error('No user returned from OAuth');
    const accessToken  = signAccessToken(user);
    const refreshToken = signRefreshToken(user.id);
    await storeRefreshToken(user.id, refreshToken);
    const dest = user.is_onboarded === false ? '/onboarding' : '/';
    res.redirect(`${FRONTEND}/oauth-callback?access_token=${accessToken}&refresh_token=${refreshToken}&redirect=${encodeURIComponent(dest)}`);
  } catch (err: any) {
    console.error('[OAuth] Callback error:', err.message, err.stack);
    res.redirect(`${FRONTEND}/login?error=oauth_failed&reason=${encodeURIComponent(err.message)}`);
  }
};

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback',
  (req, res, next) => {
    passport.authenticate('google', { session: false }, async (err: any, user: any) => {
      if (err) { console.error('[OAuth] Google error:', err.message); return res.redirect(`${FRONTEND}/login?error=oauth_failed`); }
      await oauthCallback(user, res);
    })(req, res, next);
  }
);

router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));
router.get('/github/callback',
  (req, res, next) => {
    passport.authenticate('github', { session: false }, async (err: any, user: any) => {
      if (err) { console.error('[OAuth] GitHub error:', err.message); return res.redirect(`${FRONTEND}/login?error=oauth_failed`); }
      await oauthCallback(user, res);
    })(req, res, next);
  }
);

export default router;
