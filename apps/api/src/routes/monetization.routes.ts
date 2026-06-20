import { Router } from 'express';
import { body }   from 'express-validator';
import * as ctrl  from '../controllers/monetization.controller';
import { protect, optionalAuth } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';

const router = Router();

// ─── Badges ───────────────────────────────────────────────────────────────────
router.get('/badges/:handle', optionalAuth, ctrl.getUserBadges);

// ─── Tips ─────────────────────────────────────────────────────────────────────
router.post('/tips/order',
  protect,
  [body('to_handle').notEmpty(), body('amount_inr').isFloat({ min: 10 })],
  validate, ctrl.createTipOrder
);
router.post('/tips/confirm',
  protect,
  [body('order_id').notEmpty(), body('payment_id').notEmpty(), body('signature').notEmpty(),
   body('to_handle').notEmpty(), body('amount_inr').isFloat({ min: 10 })],
  validate, ctrl.confirmTip
);
router.get('/tips/summary', protect, ctrl.getMyTipsSummary);

// ─── Creator subscriptions ────────────────────────────────────────────────────
// Creator: manage their own subscription offering
router.post('/creator-sub/setup',
  protect,
  [body('price_inr').optional().isFloat({ min: 10 }), body('enabled').isBoolean()],
  validate, ctrl.setupCreatorSubscription
);
router.get('/creator-sub/subscribers', protect, ctrl.getMySubscribers);

// Viewer: subscribe / manage subscriptions
router.get('/creator-sub/mine',            protect, ctrl.getMyCreatorSubscriptions);
router.get('/creator-sub/:handle',         optionalAuth, ctrl.getCreatorSubscriptionInfo);
router.post('/creator-sub/:handle/order',  protect, ctrl.createCreatorSubOrder);
router.post('/creator-sub/:handle/confirm',
  protect,
  [body('order_id').notEmpty(), body('payment_id').notEmpty(), body('signature').notEmpty()],
  validate, ctrl.confirmCreatorSub
);
router.delete('/creator-sub/:handle', protect, ctrl.cancelCreatorSub);

// Exclusive post access check
router.get('/exclusive-access/:postId', protect, ctrl.checkExclusiveAccess);

export default router;
