import { Router } from 'express';
import { body }   from 'express-validator';
import * as ctrl  from '../controllers/narrative.controller';
import { protect, optionalAuth } from '../middlewares/auth.middleware';
import { validate }              from '../middlewares/validate.middleware';

const router = Router();

// ─── Trending topics ──────────────────────────────────────────────────────────
router.get('/trending', ctrl.getTrendingTopics);

// ─── Hashtag stats ────────────────────────────────────────────────────────────
router.get('/hashtag/:tag', ctrl.getHashtagStats);

// ─── Pinned posts ─────────────────────────────────────────────────────────────
router.get('/pinned',    ctrl.getPinnedPosts);
router.post('/pinned',
  protect,
  [
    body('post_id').isUUID(),
    body('reason').optional().isString(),
    body('expires_hours').optional().isInt({ min: 1, max: 168 }),
  ],
  validate,
  ctrl.pinPost
);
router.delete('/pinned/:id', protect, ctrl.unpinPost);

// ─── Campaigns ────────────────────────────────────────────────────────────────
router.get('/campaigns',       optionalAuth, ctrl.getCampaigns);
router.get('/campaigns/:id',   optionalAuth, ctrl.getCampaign);
router.post('/campaigns',
  protect,
  [
    body('hashtag').trim().isLength({ min: 2, max: 100 }),
    body('title').trim().isLength({ min: 5, max: 280 }),
    body('description').optional().trim().isLength({ max: 1000 }),
    body('goal').optional().trim().isLength({ max: 500 }),
    body('category').optional().isString(),
    body('ends_hours').optional().isInt({ min: 1, max: 720 }),
  ],
  validate,
  ctrl.createCampaign
);
router.post('/campaigns/:id/support', protect, ctrl.supportCampaign);

export default router;
