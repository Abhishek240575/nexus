import { Router } from 'express';
import { body }   from 'express-validator';
import * as ctrl  from '../controllers/monetization.controller';
import { protect, optionalAuth } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';

const router = Router();

router.get('/badges/:handle',     optionalAuth, ctrl.getUserBadges);

router.post('/tips/order',
  protect,
  [
    body('to_handle').notEmpty(),
    body('amount_inr').isFloat({ min: 10 }),
  ],
  validate,
  ctrl.createTipOrder
);

router.post('/tips/confirm',
  protect,
  [
    body('order_id').notEmpty(),
    body('payment_id').notEmpty(),
    body('signature').notEmpty(),
    body('to_handle').notEmpty(),
    body('amount_inr').isFloat({ min: 10 }),
  ],
  validate,
  ctrl.confirmTip
);

router.get('/tips/summary',       protect, ctrl.getMyTipsSummary);

export default router;
