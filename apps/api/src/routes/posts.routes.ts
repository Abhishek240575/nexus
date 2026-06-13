import { Router } from 'express';
import { body }   from 'express-validator';
import * as ctrl  from '../controllers/posts.controller';
import { protect, optionalAuth } from '../middlewares/auth.middleware';
import { postLimiter }           from '../middlewares/rateLimiter.middleware';
import { validate }              from '../middlewares/validate.middleware';

const router = Router();

// ─── Feed ─────────────────────────────────────────────────────────────────────
router.get('/feed',         protect,      ctrl.getHomeFeed);
router.get('/feed/explore', optionalAuth, ctrl.getExploreFeed);

// ─── Posts CRUD ───────────────────────────────────────────────────────────────
router.post('/',
  protect,
  postLimiter,
  [
    body('content').optional().isString().isLength({ max: 280 }).withMessage('Max 280 characters'),
    body('media_urls').optional().isArray(),
    body('reply_to_id').optional().isUUID(),
    body('quote_of_id').optional().isUUID(),
    body('scheduled_at').optional().isISO8601(),
  ],
  validate,
  ctrl.createPost
);

router.get('/:id',    optionalAuth, ctrl.getPost);
router.delete('/:id', protect,      ctrl.deletePost);

// ─── Replies ──────────────────────────────────────────────────────────────────
router.get('/:id/replies', optionalAuth, ctrl.getReplies);

// ─── Interactions ─────────────────────────────────────────────────────────────
router.post('/:id/like',     protect, ctrl.likePost);
router.post('/:id/repost',   protect, ctrl.repostPost);
router.post('/:id/bookmark', protect, ctrl.bookmarkPost);

// ─── Bookmarks ────────────────────────────────────────────────────────────────
router.get('/bookmarks/me', protect, ctrl.getBookmarks);

// ─── Hashtags ─────────────────────────────────────────────────────────────────
router.get('/hashtags/trending',  ctrl.getTrending);
router.get('/hashtags/:tag/posts', optionalAuth, ctrl.getPostsByHashtag);

export default router;
