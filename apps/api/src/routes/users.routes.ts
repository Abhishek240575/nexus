import { Router } from 'express';
import { body }   from 'express-validator';
import * as ctrl  from '../controllers/users.controller';
import { protect, optionalAuth } from '../middlewares/auth.middleware';
import { searchLimiter }         from '../middlewares/rateLimiter.middleware';
import { validate }              from '../middlewares/validate.middleware';

const router = Router();

// ─── Search (must be before /:handle) ────────────────────────────────────────
router.get('/search', searchLimiter, optionalAuth, ctrl.search);

// ─── Me routes (must be before /:handle) ─────────────────────────────────────
router.patch('/me/profile',
  protect,
  [
    body('display_name').optional().trim().isLength({ max: 100 }),
    body('bio').optional().trim().isLength({ max: 160 }),
    body('location').optional().trim().isLength({ max: 100 }),
    body('website').optional().trim(),
  ],
  validate,
  ctrl.updateProfile
);

// ─── Follow ───────────────────────────────────────────────────────────────────
router.post('/:id/follow',   protect,      ctrl.followUser);
router.get('/:id/followers', optionalAuth, ctrl.getFollowers);
router.get('/:id/following', optionalAuth, ctrl.getFollowing);

// ─── Profile (must be after /me and /search) ──────────────────────────────────
router.get('/:handle',       optionalAuth, ctrl.getProfile);
router.get('/:handle/posts', optionalAuth, ctrl.getUserPosts);

export default router;