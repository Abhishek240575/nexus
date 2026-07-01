import { Router }   from 'express';
import passport     from 'passport';
import { signAccessToken, signRefreshToken, storeRefreshToken } from '../utils/jwt';

const router  = Router();
const FRONTEND = process.env.FRONTEND_URL || 'https://nexus-web-bjks.onrender.com';

const oauthCallback = async (user: any, res: any) => {
  const accessToken  = signAccessToken(user);
  const refreshToken = signRefreshToken(user.id);
  await storeRefreshToken(user.id, refreshToken);
  const dest = user.is_onboarded === false ? '/onboarding' : '/';
  res.redirect(`${FRONTEND}/oauth-callback?access_token=${accessToken}&refresh_token=${refreshToken}&redirect=${encodeURIComponent(dest)}`);
};

router.get('/google',          passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport.authenticate('google', { session: false, failureRedirect: `${FRONTEND}/login?error=oauth_failed` }), async (req: any, res: any) => oauthCallback(req.user, res));
router.get('/github',          passport.authenticate('github', { scope: ['user:email'] }));
router.get('/github/callback', passport.authenticate('github', { session: false, failureRedirect: `${FRONTEND}/login?error=oauth_failed` }), async (req: any, res: any) => oauthCallback(req.user, res));

export default router;
