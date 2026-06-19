import { Request, Response } from 'express';
import { db }  from '../config/db';
import * as R  from '../utils/response';
import { AuthenticatedRequest } from '../types';
import * as razorpayService from '../services/razorpay.service';
import { logAudit } from '../services/audit.service';
import { awardBadge } from '../services/badges.service';

// ─── Get all available tiers (public pricing page) ───────────────────────────
export const getTiers = async (req: Request, res: Response): Promise<void> => {
  const { rows } = await db.query(
    `SELECT id, display_name, price_inr_paise, billing_period, max_post_length,
            max_space_listeners, features
     FROM subscription_tiers WHERE is_active = TRUE ORDER BY price_inr_paise ASC`
  );
  R.ok(res, rows);
};

// ─── Get current user's subscription ──────────────────────────────────────────
export const getMySubscription = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;

  const { rows } = await db.query(
    `SELECT s.*, t.display_name AS tier_name, t.price_inr_paise, t.features, t.max_post_length, t.max_space_listeners
     FROM subscriptions s JOIN subscription_tiers t ON t.id = s.tier_id
     WHERE s.user_id = $1 AND s.status = 'active'
     ORDER BY s.created_at DESC LIMIT 1`,
    [userId]
  );

  if (!rows[0]) {
    // No active paid subscription — return free tier defaults
    const { rows: freeTier } = await db.query(
      `SELECT id, display_name, price_inr_paise, features, max_post_length, max_space_listeners
       FROM subscription_tiers WHERE id = 'free'`
    );
    R.ok(res, { tier_id: 'free', status: 'active', ...freeTier[0] });
    return;
  }

  R.ok(res, rows[0]);
};

// ─── Start a subscription checkout (creates Razorpay subscription) ───────────
export const createSubscriptionCheckout = async (req: Request, res: Response): Promise<void> => {
  const { id: userId, email, handle } = (req as AuthenticatedRequest).user;
  const { tier_id } = req.body;

  if (!['plus', 'pro', 'enterprise'].includes(tier_id)) {
    R.badRequest(res, 'Invalid tier'); return;
  }

  // Check for existing active subscription
  const { rows: existing } = await db.query(
    `SELECT id FROM subscriptions WHERE user_id = $1 AND status = 'active'`, [userId]
  );
  if (existing[0]) { R.badRequest(res, 'You already have an active subscription. Cancel it first to switch tiers.'); return; }

  try {
    const { rows: userRows } = await db.query('SELECT display_name FROM users WHERE id = $1', [userId]);
    const displayName = userRows[0]?.display_name || handle;

    const customerId = await razorpayService.createCustomer(displayName, email, undefined);

    const { razorpaySubscriptionId, shortUrl } = await razorpayService.createSubscription(tier_id, customerId);

    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const { rows } = await db.query(
      `INSERT INTO subscriptions
         (user_id, tier_id, status, razorpay_customer_id, razorpay_subscription_id, current_period_end)
       VALUES ($1, $2, 'pending', $3, $4, $5) RETURNING *`,
      [userId, tier_id, customerId, razorpaySubscriptionId, periodEnd]
    );

    await logAudit({ userId, actorId: userId, action: 'subscription.checkout_started', details: { tier_id, razorpaySubscriptionId } });

    R.created(res, {
      subscription:            rows[0],
      checkout_url:            shortUrl,
      razorpay_subscription_id: razorpaySubscriptionId,
      razorpay_key_id:         process.env.RAZORPAY_KEY_ID,
    });
  } catch (err: any) {
    console.error('[Billing] Checkout creation failed:', err.message);
    R.serverError(res, 'Could not start checkout. Please try again.');
  }
};

// ─── Cancel subscription ──────────────────────────────────────────────────────
export const cancelSubscription = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;

  const { rows } = await db.query(
    `SELECT * FROM subscriptions WHERE user_id = $1 AND status = 'active'`, [userId]
  );
  if (!rows[0]) { R.notFound(res, 'No active subscription found'); return; }

  try {
    if (rows[0].razorpay_subscription_id) {
      await razorpayService.cancelSubscription(rows[0].razorpay_subscription_id, true);
    }

    await db.query(
      `UPDATE subscriptions SET cancel_at_period_end = TRUE, cancelled_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [rows[0].id]
    );

    await logAudit({ userId, actorId: userId, action: 'subscription.cancelled', details: { subscription_id: rows[0].id } });

    R.ok(res, { message: 'Subscription will end at the current billing period.' });
  } catch (err: any) {
    console.error('[Billing] Cancel failed:', err.message);
    R.serverError(res, 'Could not cancel subscription.');
  }
};

// ─── Razorpay webhook handler ─────────────────────────────────────────────────
export const handleWebhook = async (req: Request, res: Response): Promise<void> => {
  const signature = req.headers['x-razorpay-signature'] as string;
  const rawBody    = (req as any).rawBody || JSON.stringify(req.body);

  if (!razorpayService.verifyWebhookSignature(rawBody, signature)) {
    res.status(400).json({ error: 'Invalid webhook signature' });
    return;
  }

  const event = req.body.event;
  const payload = req.body.payload;

  try {
    switch (event) {
      case 'subscription.activated': {
        const subEntity = payload.subscription.entity;
        await activateSubscription(subEntity.id);
        break;
      }
      case 'subscription.charged': {
        const subEntity    = payload.subscription.entity;
        const paymentEntity = payload.payment.entity;
        await recordCharge(subEntity.id, paymentEntity);
        break;
      }
      case 'subscription.cancelled':
      case 'subscription.completed': {
        const subEntity = payload.subscription.entity;
        await expireSubscription(subEntity.id);
        break;
      }
      case 'subscription.halted': {
        const subEntity = payload.subscription.entity;
        await db.query(
          `UPDATE subscriptions SET status = 'past_due', updated_at = NOW() WHERE razorpay_subscription_id = $1`,
          [subEntity.id]
        );
        break;
      }
      default:
        console.log(`[Webhook] Unhandled event: ${event}`);
    }
    res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('[Webhook] Processing error:', err.message);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
async function activateSubscription(razorpaySubscriptionId: string) {
  const { rows } = await db.query(
    `UPDATE subscriptions SET status = 'active', updated_at = NOW()
     WHERE razorpay_subscription_id = $1 RETURNING user_id, tier_id`,
    [razorpaySubscriptionId]
  );
  if (rows[0]) {
    await db.query('UPDATE users SET premium_tier = $1, verified = TRUE WHERE id = $2',
      [rows[0].tier_id, rows[0].user_id]);
    await maybeAwardEarlySupporter(rows[0].user_id);
    await logAudit({ userId: rows[0].user_id, actorId: null, action: 'subscription.activated', details: { tier_id: rows[0].tier_id } });
  }
}

async function recordCharge(razorpaySubscriptionId: string, payment: any) {
  const { rows } = await db.query(
    `SELECT id, user_id, tier_id FROM subscriptions WHERE razorpay_subscription_id = $1`,
    [razorpaySubscriptionId]
  );
  if (!rows[0]) return;

  await db.query(
    `INSERT INTO payment_transactions
       (user_id, subscription_id, razorpay_payment_id, amount_inr_paise, status, purpose)
     VALUES ($1, $2, $3, $4, 'captured', 'subscription')`,
    [rows[0].user_id, rows[0].id, payment.id, payment.amount]
  );

  const newPeriodEnd = new Date();
  newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
  await db.query(
    `UPDATE subscriptions SET current_period_start = NOW(), current_period_end = $1, status = 'active', updated_at = NOW() WHERE id = $2`,
    [newPeriodEnd, rows[0].id]
  );
}

async function expireSubscription(razorpaySubscriptionId: string) {
  const { rows } = await db.query(
    `UPDATE subscriptions SET status = 'expired', updated_at = NOW()
     WHERE razorpay_subscription_id = $1 RETURNING user_id`,
    [razorpaySubscriptionId]
  );
  if (rows[0]) {
    await db.query(`UPDATE users SET premium_tier = 'free', verified = FALSE WHERE id = $1`, [rows[0].user_id]);
    await logAudit({ userId: rows[0].user_id, actorId: null, action: 'subscription.expired', details: {} });
  }
}

async function maybeAwardEarlySupporter(userId: string) {
  const { rows } = await db.query(`SELECT COUNT(*) AS count FROM subscriptions WHERE status IN ('active','expired')`);
  if (Number(rows[0].count) <= 1000) {
    await awardBadge(userId, 'early_supporter');
  }
}

// ─── Verify subscription payment (called after Razorpay checkout completes) ──
// Provides immediate activation without waiting for webhook
export const verifySubscriptionPayment = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = req.body;

  if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
    R.badRequest(res, 'Missing payment verification fields'); return;
  }

  // Verify signature: HMAC-SHA256 of payment_id + '|' + subscription_id
  const crypto = require('crypto');
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
    .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
    .digest('hex');

  if (expected !== razorpay_signature) {
    R.badRequest(res, 'Payment verification failed — invalid signature'); return;
  }

  // Activate subscription immediately (webhook will also fire but that's idempotent)
  const { rows } = await db.query(
    `UPDATE subscriptions SET status = 'active', updated_at = NOW()
     WHERE razorpay_subscription_id = $1 AND user_id = $2
     RETURNING id, tier_id`,
    [razorpay_subscription_id, userId]
  );

  if (!rows[0]) {
    R.notFound(res, 'Subscription not found'); return;
  }

  const { tier_id } = rows[0];

  // Update user tier and verified status immediately
  await db.query(
    'UPDATE users SET premium_tier = $1, verified = TRUE WHERE id = $2',
    [tier_id, userId]
  );

  // Record the payment
  await db.query(
    `INSERT INTO payment_transactions
       (user_id, subscription_id, razorpay_payment_id, amount_inr_paise, status, purpose)
     SELECT $1, $2, $3,
       (SELECT price_inr_paise FROM subscription_tiers WHERE id = $4),
       'captured', 'subscription'`,
    [userId, rows[0].id, razorpay_payment_id, tier_id]
  );

  // Award Early Supporter badge
  await maybeAwardEarlySupporter(userId);

  await logAudit({
    userId,
    actorId: userId,
    action: 'subscription.activated',
    details: { tier_id, razorpay_subscription_id, razorpay_payment_id },
  });

  R.ok(res, { activated: true, tier_id, message: `Welcome to Deemona ${tier_id.charAt(0).toUpperCase() + tier_id.slice(1)}!` });
};
