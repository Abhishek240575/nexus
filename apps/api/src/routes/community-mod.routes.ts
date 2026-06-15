import { Router } from 'express';
import { body }   from 'express-validator';
import * as ctrl  from '../controllers/community-mod.controller';
import { protect, optionalAuth } from '../middlewares/auth.middleware';
import { validate }              from '../middlewares/validate.middleware';

const router = Router({ mergeParams: true });

// Rules
router.get('/rules',          optionalAuth, ctrl.getRules);
router.post('/rules',
  protect,
  [body('title').trim().isLength({ min: 2, max: 200 })],
  validate,
  ctrl.addRule
);
router.delete('/rules/:ruleId', protect, ctrl.deleteRule);

// Approval mode
router.patch('/approval',
  protect,
  [body('requires_approval').isBoolean()],
  validate,
  ctrl.toggleApproval
);

// Mod queue
router.get('/queue',           protect, ctrl.getModQueue);
router.post('/queue/:queueId/review',
  protect,
  [body('action').isIn(['approve', 'reject'])],
  validate,
  ctrl.reviewQueuedPost
);

// Bans
router.get('/bans',            protect, ctrl.getBannedUsers);
router.post('/bans',
  protect,
  [body('user_id').isUUID(), body('reason').optional().isString()],
  validate,
  ctrl.banFromCommunity
);
router.delete('/bans/:userId', protect, ctrl.unbanFromCommunity);

// Promotions
router.post('/promote',
  protect,
  [body('user_id').isUUID()],
  validate,
  ctrl.promoteModerator
);

// Reports
router.get('/reports',         protect, ctrl.getCommunityReports);
router.post('/reports',
  protect,
  [
    body('post_id').isUUID(),
    body('reason').isString().isLength({ min: 2, max: 100 }),
  ],
  validate,
  ctrl.reportPost
);

export default router;
