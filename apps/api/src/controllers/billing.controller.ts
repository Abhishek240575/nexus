import { Request, Response } from 'express';
import { db }  from '../config/db';
import * as R  from '../utils/response';
import { createOrder, createSubscription, cancelSubscription as cancelRazorpaySub, verifySubscriptionSignature, createCustomer } from '../services/razorpay.service';

interface AuthReq extends Request { user: { id: string; handle: string; email: string; premium_tier: string } }

// ─── Get all available tiers ──────────────────────────────────────────────────
export const getTiers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { rows } = await db.query(
      `SELECT id, name, price_inr_monthly, max_post_length, features
       FROM subscription_tiers
       ORDER BY price_inr_monthly ASC`
    );
    R.ok(res, rows);
  } catch (err: any) {
    console.error('[Billing] getTiers error:', err.message);
    R.serverError(res, 'Could not load subscription tiers');
  }
};

// ─── Get current user subscription ───────────────────────────────────────────
export const getMySubscription = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthReq).user;
  try {
    const { rows } = await db.query(
      `SELECT s.*, t.name AS tier_name, t.price_inr_monthly, t.max_post_length, t.features
       FROM subscriptions s
       JOIN subscription_tiers t ON t.name = s.tier
       WHERE s.user_id = $1::uuid AND s.status = 'active'
       ORDER BY s.created_at DESC LIMIT 1`,
      [userId]
    );
    R.ok(res, rows[0] || null);
  } catch (err: any) {
    console.error('[Billing] getMySubscription error:', err.message);
    R.serverError(res, 'Could not load subscription');
  }
};

// ─── Create subscription checkout ────────────────────────────────────────────
export const createSubscriptionCheckout = async (req: Request, res: Response): Promise<void> => {
  const { id: userId, handle, email } = (req as AuthReq).user;
  const { tier_id } = req.body;

  try {
    const { rows: tierRows } = await db.query(
      `SELECT * FROM subscription_tiers WHERE name = $1`, [tier_id]
    );
    if (!tierRows[0]) { R.notFound(res, 'Subscription tier not found'); return; }

    const { rows: existing } = await db.query(
      `SELECT id FROM subscriptions WHERE user_id = $1::uuid AND status = 'active' AND tier != 'free'`,
      [userId]
    );
    if (existing[0]) { R.badRequest(res, 'You already have an active subscription. Cancel it first to switch tiers.'); return; }

    const tier = tierRows[0];
    const amountPaise = tier.price_inr_monthly * 100;

    const order = await createOrder(amountPaise, `sub_${userId.slice(0,8)}_${tier_id}`);

    R.ok(res, {
      order_id:   order.id,
      amount:     amountPaise,
      currency:   'INR',
      tier:       tier_id,
      tier_name:  tier.name,
    });
  } catch (err: any) {
    console.error('[Billing] checkout error:', err.message);
    R.serverError(res, 'Could not create checkout: ' + err.message);
  }
};

// ─── Verify subscription payment ──────────────────────────────────────────────
export const verifySubscriptionPayment = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthReq).user;
  const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature, tier } = req.body;

  try {
    const valid = verifySubscriptionSignature(razorpay_subscription_id, razorpay_payment_id, razorpay_signature);
    if (!valid) { R.badRequest(res, 'Invalid payment signature'); return; }

    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    // Upsert subscription
    await db.query(
      `INSERT INTO subscriptions (user_id, tier, status, razorpay_subscription_id, current_period_start, current_period_end)
       VALUES ($1::uuid, $2, 'active', $3, NOW(), $4)
       ON CONFLICT (user_id) DO UPDATE SET
         tier = $2, status = 'active',
         razorpay_subscription_id = $3,
         current_period_start = NOW(),
         current_period_end = $4,
         updated_at = NOW()`,
      [userId, tier, razorpay_subscription_id, periodEnd]
    ).catch(() =>
      db.query(
        `INSERT INTO subscriptions (user_id, tier, status, razorpay_subscription_id, current_period_start, current_period_end)
         VALUES ($1::uuid, $2, 'active', $3, NOW(), $4)`,
        [userId, tier, razorpay_subscription_id, periodEnd]
      )
    );

    await db.query(`UPDATE users SET premium_tier = $1 WHERE id = $2::uuid`, [tier, userId]);

    R.ok(res, { verified: true, tier });
  } catch (err: any) {
    console.error('[Billing] verify error:', err.message);
    R.serverError(res, 'Payment verification failed');
  }
};

// ─── Cancel subscription ──────────────────────────────────────────────────────
export const cancelSubscription = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthReq).user;

  try {
    const { rows } = await db.query(
      `SELECT * FROM subscriptions WHERE user_id = $1::uuid AND status = 'active'`,
      [userId]
    );
    if (!rows[0]) { R.notFound(res, 'No active subscription found'); return; }

    if (rows[0].razorpay_subscription_id) {
      await cancelRazorpaySub(rows[0].razorpay_subscription_id, true).catch(() => {});
    }

    await db.query(
      `UPDATE subscriptions SET cancel_at_period_end = TRUE, cancelled_at = NOW(), updated_at = NOW()
       WHERE user_id = $1::uuid`,
      [userId]
    );

    R.ok(res, { cancelled: true, effective_date: rows[0].current_period_end });
  } catch (err: any) {
    console.error('[Billing] cancel error:', err.message);
    R.serverError(res, 'Could not cancel subscription');
  }
};

// ─── Razorpay webhook ─────────────────────────────────────────────────────────
export const handleWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const { verifyWebhookSignature } = await import('../services/razorpay.service');
    const signature = req.headers['x-razorpay-signature'] as string;
    const body      = JSON.stringify(req.body);

    if (!verifyWebhookSignature(body, signature)) {
      res.status(400).json({ error: 'Invalid signature' }); return;
    }

    const { event, payload } = req.body;

    if (event === 'subscription.charged') {
      const sub = payload?.subscription?.entity;
      if (sub) {
        await db.query(
          `UPDATE subscriptions SET status = 'active', updated_at = NOW()
           WHERE razorpay_subscription_id = $1`,
          [sub.id]
        );
      }
    }

    if (event === 'subscription.cancelled' || event === 'subscription.completed') {
      const sub = payload?.subscription?.entity;
      if (sub) {
        await db.query(
          `UPDATE subscriptions SET status = 'cancelled', updated_at = NOW()
           WHERE razorpay_subscription_id = $1`,
          [sub.id]
        );
        await db.query(
          `UPDATE users SET premium_tier = 'free'
           WHERE id = (SELECT user_id FROM subscriptions WHERE razorpay_subscription_id = $1)`,
          [sub.id]
        );
      }
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error('[Billing] webhook error:', err.message);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};
