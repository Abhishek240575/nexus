import { Router } from 'express';
import { body }   from 'express-validator';
import * as ctrl  from '../controllers/moderation.controller';
import { protect } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';

const router = Router();

// All moderation routes require auth (admin check is done inside controllers)
router.get('/queue',              protect, ctrl.getModerationQueue);
router.get('/stats',              protect, ctrl.getModerationStats);
router.get('/users/:userId/violations', protect, ctrl.getUserViolations);

router.post('/queue/:id/review',
  protect,
  [
    body('action').isIn(['approve', 'reject', 'warn']),
    body('note').optional().isString(),
  ],
  validate,
  ctrl.reviewPost
);

router.post('/users/:userId/ban',
  protect,
  [
    body('reason').notEmpty(),
    body('permanent').optional().isBoolean(),
    body('duration_days').optional().isInt({ min: 1, max: 365 }),
  ],
  validate,
  ctrl.banUser
);

export default router;
