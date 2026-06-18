import { Router } from 'express';
import { body }   from 'express-validator';
import * as comm  from '../controllers/communities.controller';
import * as polls from '../controllers/polls.controller';
import { protect, optionalAuth } from '../middlewares/auth.middleware';
import { validate }              from '../middlewares/validate.middleware';

const router = Router();

// ─── Communities ──────────────────────────────────────────────────────────────
router.get('/',         optionalAuth, comm.getCommunities);
router.get('/:slug',    optionalAuth, comm.getCommunity);
router.get('/:slug/posts',   optionalAuth, comm.getCommunityPosts);
router.get('/:slug/members', optionalAuth, comm.getCommunityMembers);

router.post('/',
  protect,
  [
    body('name').trim().isLength({ min: 2, max: 100 }),
    body('slug').trim().isLength({ min: 2, max: 100 }).matches(/^[a-z0-9-]+$/),
    body('description').optional().trim().isLength({ max: 500 }),
  ],
  validate,
  comm.createCommunity
);

router.post('/:slug/join', protect, comm.joinCommunity);

router.patch('/:slug',
  protect,
  [
    body('name').optional().trim().isLength({ min: 2, max: 100 }),
    body('description').optional().trim().isLength({ max: 500 }),
    body('brand_color').optional().matches(/^#[0-9A-Fa-f]{6}$/),
    body('brand_logo_url').optional().isURL(),
  ],
  validate,
  comm.updateCommunity
);

// ─── Polls ────────────────────────────────────────────────────────────────────
router.post('/polls',
  protect,
  [
    body('post_id').isUUID(),
    body('options').isArray({ min: 2, max: 4 }),
    body('expires_hours').optional().isInt({ min: 1, max: 168 }),
  ],
  validate,
  polls.createPoll
);
router.get('/polls/:postId',      optionalAuth, polls.getPoll);
router.post('/polls/:postId/vote',
  protect,
  [body('option_id').isUUID()],
  validate,
  polls.votePoll
);

export default router;
