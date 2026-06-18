import { Router } from 'express';
import { body }   from 'express-validator';
import * as ctrl  from '../controllers/billing.controller';
import { protect } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';

const router = Router();

router.get('/tiers',              ctrl.getTiers);
router.get('/me',                 protect, ctrl.getMySubscription);

router.post('/checkout',
  protect,
  [body('tier_id').isIn(['plus', 'pro', 'enterprise'])],
  validate,
  ctrl.createSubscriptionCheckout
);

router.post('/cancel',            protect, ctrl.cancelSubscription);

// Webhook — no auth middleware (Razorpay signs requests instead)
router.post('/webhook',           ctrl.handleWebhook);

export default router;
