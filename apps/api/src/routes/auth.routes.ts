import { Router }  from 'express';
import { body }     from 'express-validator';
import passport     from '../config/passport';
import * as ctrl    from '../controllers/auth.controller';
import { protect }  from '../middlewares/auth.middleware';
import { authLimiter } from '../middlewares/rateLimiter.middleware';
import { validate } from '../middlewares/validate.middleware';

const router = Router();

// ─── Local auth ───────────────────────────────────────────────────────────────
router.post('/register',
  authLimiter,
  [
    body('handle')
      .trim().isLength({ min: 3, max: 50 })
      .matches(/^[a-zA-Z0-9_]+$/).withMessage('Handle may only contain letters, numbers, underscores'),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('display_name').optional().trim().isLength({ max: 100 }),
  ],
  validate,
  ctrl.register
);

router.post('/login',
  authLimiter,
  [
    body('identifier').trim().notEmpty().withMessage('Email or handle required'),
    body('password').notEmpty().withMessage('Password required'),
  ],
  validate,
  ctrl.login
);

router.post('/refresh',
  [body('refresh_token').notEmpty()],
  validate,
  ctrl.refreshToken
);

router.post('/logout', protect, ctrl.logout);

// ─── Email verification ───────────────────────────────────────────────────────
router.get('/verify-email', ctrl.verifyEmail);

// ─── Password reset ───────────────────────────────────────────────────────────
router.post('/forgot-password',
  authLimiter,
  [body('email').isEmail().normalizeEmail()],
  validate,
  ctrl.forgotPassword
);

router.post('/reset-password',
  authLimiter,
  [
    body('token').notEmpty(),
    body('password').isLength({ min: 8 }),
  ],
  validate,
  ctrl.resetPassword
);

// ─── Current user ─────────────────────────────────────────────────────────────
router.get('/me', protect, ctrl.getMe);

// ─── OAuth — Google ───────────────────────────────────────────────────────────
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  ctrl.oauthSuccess
);

// ─── OAuth — GitHub ───────────────────────────────────────────────────────────
router.get('/github',
  passport.authenticate('github', { scope: ['user:email'], session: false })
);
router.get('/github/callback',
  passport.authenticate('github', { session: false, failureRedirect: '/login' }),
  ctrl.oauthSuccess
);

export default router;
