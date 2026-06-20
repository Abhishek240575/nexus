import { Request, Response } from 'express';
import { db }  from '../config/db';
import * as R  from '../utils/response';
import { AuthenticatedRequest } from '../types';
import * as razorpayService from '../services/razorpay.service';
import { logAudit } from '../services/audit.service';

// ─── Get a user's badges ──────────────────────────────────────────────────────
export const getUserBadges = async (req: Request, res: Response): Promise<void> => {
  const { handle } = req.params;
  const { rows: userRow } = await db.query('SELECT id FROM users WHERE handle = $1', [handle]);
  if (!userRow[0]) { R.notFound(res, 'User not found'); return; }

  const { rows } = await db.query(
    `SELECT ub.badge_id, ub.awarded_at, ub.context, bt.display_name, bt.description, bt.icon
     FROM user_badges ub JOIN badge_types bt ON bt.id = ub.badge_id
     WHERE ub.user_id = $1 ORDER BY ub.awarded_at DESC`,
    [userRow[0].id]
  );
  R.ok(res, rows);
};

// ─── Create a Razorpay order to send a tip ────────────────────────────────────
export const createTipOrder = async (req: Request, res: Response): Promise<void> => {
  const { id: fromUserId } = (req as AuthenticatedRequest).user;
  const { to_handle, amount_inr, post_id, message } = req.body;

  if (!amount_inr || amount_inr < 10) { R.badRequest(res, 'Minimum tip is ₹10'); return; }

  const { rows: toUser } = await db.query('SELECT id, handle FROM users WHERE handle = $1', [to_handle]);
  if (!toUser[0]) { R.notFound(res, 'Recipient not found'); return; }
  if (toUser[0].id === fromUserId) { R.badRequest(res, 'You cannot tip yourself'); return; }

  const amountPaise = Math.round(amount_inr * 100);

  try {
    const order = await razorpayService.createOrder(
      amountPaise,
      `tip_${Date.now()}`,
      { from_user_id: fromUserId, to_user_id: toUser[0].id, purpose: 'tip' }
    );

    R.created(res, {
      order_id:  order.id,
      amount:    amountPaise,
      currency:  'INR',
      key_id:    process.env.RAZORPAY_KEY_ID,
      to_handle: toUser[0].handle,
    });
  } catch (err: any) {
    console.error('[Tips] Order creation failed:', err.message);
    R.serverError(res, 'Could not create tip order');
  }
};

// ─── Confirm a tip after Razorpay checkout completes ──────────────────────────
export const confirmTip = async (req: Request, res: Response): Promise<void> => {
  const { id: fromUserId } = (req as AuthenticatedRequest).user;
  const { order_id, payment_id, signature, to_handle, amount_inr, post_id, message } = req.body;

  if (!razorpayService.verifyPaymentSignature(order_id, payment_id, signature)) {
    R.badRequest(res, 'Payment verification failed'); return;
  }

  const { rows: toUser } = await db.query('SELECT id FROM users WHERE handle = $1', [to_handle]);
  if (!toUser[0]) { R.notFound(res, 'Recipient not found'); return; }

  const amountPaise = Math.round(amount_inr * 100);

  const { rows } = await db.query(
    `INSERT INTO tips (from_user_id, to_user_id, post_id, amount_inr_paise, message, razorpay_payment_id, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'completed') RETURNING *`,
    [fromUserId, toUser[0].id, post_id || null, amountPaise, message || null, payment_id]
  );

  await db.query(
    `INSERT INTO payment_transactions (user_id, razorpay_payment_id, razorpay_order_id, amount_inr_paise, status, purpose)
     VALUES ($1, $2, $3, $4, 'captured', 'tip')`,
    [fromUserId, payment_id, order_id, amountPaise]
  );

  await logAudit({ userId: toUser[0].id, actorId: fromUserId, action: 'tip.received', details: { amount_inr, post_id } });

  R.created(res, rows[0]);
};

// ─── Get tips received by current user (creator dashboard) ──────────────────
export const getMyTipsSummary = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;

  const { rows: totals } = await db.query(
    `SELECT COUNT(*) AS tip_count, COALESCE(SUM(amount_inr_paise), 0) AS total_paise
     FROM tips WHERE to_user_id = $1 AND status = 'completed'`,
    [userId]
  );

  const { rows: recent } = await db.query(
    `SELECT t.*, u.handle AS from_handle, u.display_name AS from_name, u.avatar_url AS from_avatar
     FROM tips t JOIN users u ON u.id = t.from_user_id
     WHERE t.to_user_id = $1 AND t.status = 'completed'
     ORDER BY t.created_at DESC LIMIT 20`,
    [userId]
  );

  const { rows: topSupporters } = await db.query(
    `SELECT u.handle, u.display_name, u.avatar_url, COUNT(*) AS tip_count, SUM(t.amount_inr_paise) AS total_paise
     FROM tips t JOIN users u ON u.id = t.from_user_id
     WHERE t.to_user_id = $1 AND t.status = 'completed'
     GROUP BY u.id, u.handle, u.display_name, u.avatar_url
     ORDER BY total_paise DESC LIMIT 5`,
    [userId]
  );

  R.ok(res, {
    total_tips:     Number(totals[0].tip_count),
    total_amount:   Number(totals[0].total_paise) / 100,
    recent_tips:    recent,
    top_supporters: topSupporters,
  });
};

// =============================================================================
// CREATOR PAID SUBSCRIPTIONS
// =============================================================================

// ─── Set up / update creator subscription pricing ─────────────────────────────
export const setupCreatorSubscription = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const { price_inr, enabled } = req.body;

  // Requires Pro or Enterprise tier
  const { rows: tierRow } = await db.query(
    `SELECT u.premium_tier FROM users u WHERE u.id = $1`, [userId]
  );
  const tier = tierRow[0]?.premium_tier || 'free';
  if (!['pro', 'enterprise'].includes(tier)) {
    R.forbidden(res, 'Creator subscriptions require a Pro or Enterprise plan. Upgrade at /premium.'); return;
  }

  if (enabled && (!price_inr || price_inr < 10)) {
    R.badRequest(res, 'Minimum subscription price is ₹10/month'); return;
  }

  const pricePaise = enabled ? Math.round(price_inr * 100) : 0;

  const { rows } = await db.query(
    `UPDATE users SET
       creator_subscription_enabled = $1,
       creator_subscription_price   = $2
     WHERE id = $3
     RETURNING creator_subscription_enabled, creator_subscription_price`,
    [enabled, pricePaise, userId]
  );

  await logAudit({ userId, actorId: userId, action: 'creator_sub.updated', details: { enabled, price_inr } });
  R.ok(res, rows[0]);
};

// ─── Get creator subscription info for a profile ──────────────────────────────
export const getCreatorSubscriptionInfo = async (req: Request, res: Response): Promise<void> => {
  const { handle } = req.params;
  const viewerId   = (req as any).user?.id;

  const { rows: creator } = await db.query(
    `SELECT id, handle, display_name, avatar_url, verified, premium_tier,
            creator_subscription_enabled, creator_subscription_price, creator_subscriber_count
     FROM users WHERE handle = $1`,
    [handle]
  );
  if (!creator[0]) { R.notFound(res, 'Creator not found'); return; }

  let isSubscribed = false;
  let subscription = null;

  if (viewerId && viewerId !== creator[0].id) {
    const { rows: subRow } = await db.query(
      `SELECT id, status, current_period_end, price_inr_paise
       FROM creator_subscriptions
       WHERE creator_id = $1 AND subscriber_id = $2 AND status = 'active'`,
      [creator[0].id, viewerId]
    );
    isSubscribed = subRow.length > 0;
    subscription = subRow[0] || null;
  }

  R.ok(res, {
    creator:       creator[0],
    is_subscribed: isSubscribed,
    subscription,
  });
};

// ─── Create Razorpay order to subscribe to a creator ──────────────────────────
export const createCreatorSubOrder = async (req: Request, res: Response): Promise<void> => {
  const { id: subscriberId } = (req as AuthenticatedRequest).user;
  const { handle } = req.params;

  const { rows: creator } = await db.query(
    `SELECT id, handle, display_name, creator_subscription_enabled, creator_subscription_price
     FROM users WHERE handle = $1`,
    [handle]
  );
  if (!creator[0]) { R.notFound(res, 'Creator not found'); return; }
  if (!creator[0].creator_subscription_enabled) { R.badRequest(res, 'This creator has not enabled paid subscriptions'); return; }
  if (creator[0].id === subscriberId) { R.badRequest(res, 'You cannot subscribe to yourself'); return; }

  // Check not already subscribed
  const { rows: existing } = await db.query(
    `SELECT id FROM creator_subscriptions WHERE creator_id=$1 AND subscriber_id=$2 AND status='active'`,
    [creator[0].id, subscriberId]
  );
  if (existing[0]) { R.badRequest(res, 'You are already subscribed to this creator'); return; }

  const amountPaise = creator[0].creator_subscription_price;

  try {
    const order = await razorpayService.createOrder(
      amountPaise,
      `creator_sub_${Date.now()}`,
      { creator_id: creator[0].id, subscriber_id: subscriberId, purpose: 'creator_subscription' }
    );

    R.created(res, {
      order_id:     order.id,
      amount:       amountPaise,
      currency:     'INR',
      key_id:       process.env.RAZORPAY_KEY_ID,
      creator_name: creator[0].display_name || creator[0].handle,
    });
  } catch (err: any) {
    R.serverError(res, 'Could not create subscription order');
  }
};

// ─── Confirm creator subscription after Razorpay payment ──────────────────────
export const confirmCreatorSub = async (req: Request, res: Response): Promise<void> => {
  const { id: subscriberId } = (req as AuthenticatedRequest).user;
  const { handle } = req.params;
  const { order_id, payment_id, signature } = req.body;

  if (!razorpayService.verifyPaymentSignature(order_id, payment_id, signature)) {
    R.badRequest(res, 'Payment verification failed'); return;
  }

  const { rows: creator } = await db.query(
    `SELECT id, creator_subscription_price FROM users WHERE handle = $1`, [handle]
  );
  if (!creator[0]) { R.notFound(res, 'Creator not found'); return; }

  // Create subscription record (30-day period)
  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + 30);

  const { rows } = await db.query(
    `INSERT INTO creator_subscriptions
       (creator_id, subscriber_id, price_inr_paise, status, razorpay_subscription_id, current_period_end)
     VALUES ($1, $2, $3, 'active', $4, $5)
     ON CONFLICT (creator_id, subscriber_id)
     DO UPDATE SET status='active', current_period_end=$5, updated_at=NOW()
     RETURNING *`,
    [creator[0].id, subscriberId, creator[0].creator_subscription_price, payment_id, periodEnd.toISOString()]
  );

  // Increment subscriber count
  await db.query(
    `UPDATE users SET creator_subscriber_count = creator_subscriber_count + 1 WHERE id = $1`,
    [creator[0].id]
  );

  await db.query(
    `INSERT INTO payment_transactions (user_id, razorpay_payment_id, razorpay_order_id, amount_inr_paise, status, purpose)
     VALUES ($1, $2, $3, $4, 'captured', 'creator_subscription')`,
    [subscriberId, payment_id, order_id, creator[0].creator_subscription_price]
  );

  await logAudit({ userId: creator[0].id, actorId: subscriberId, action: 'creator_sub.new_subscriber', details: { payment_id } });
  R.created(res, rows[0]);
};

// ─── Cancel creator subscription ──────────────────────────────────────────────
export const cancelCreatorSub = async (req: Request, res: Response): Promise<void> => {
  const { id: subscriberId } = (req as AuthenticatedRequest).user;
  const { handle } = req.params;

  const { rows: creator } = await db.query('SELECT id FROM users WHERE handle = $1', [handle]);
  if (!creator[0]) { R.notFound(res, 'Creator not found'); return; }

  const { rows } = await db.query(
    `UPDATE creator_subscriptions SET status='cancelled', updated_at=NOW()
     WHERE creator_id=$1 AND subscriber_id=$2 AND status='active' RETURNING id`,
    [creator[0].id, subscriberId]
  );

  if (!rows[0]) { R.notFound(res, 'Active subscription not found'); return; }

  await db.query(
    `UPDATE users SET creator_subscriber_count = GREATEST(creator_subscriber_count - 1, 0) WHERE id = $1`,
    [creator[0].id]
  );

  R.ok(res, { cancelled: true });
};

// ─── Get my creator subscriptions (who I'm subscribed to) ────────────────────
export const getMyCreatorSubscriptions = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;

  const { rows } = await db.query(
    `SELECT cs.*, u.handle, u.display_name, u.avatar_url, u.verified, u.premium_tier
     FROM creator_subscriptions cs JOIN users u ON u.id = cs.creator_id
     WHERE cs.subscriber_id = $1 AND cs.status = 'active'
     ORDER BY cs.created_at DESC`,
    [userId]
  );
  R.ok(res, rows);
};

// ─── Get my subscribers (creator view) ────────────────────────────────────────
export const getMySubscribers = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;

  const { rows: totals } = await db.query(
    `SELECT COUNT(*) AS subscriber_count,
            COALESCE(SUM(price_inr_paise), 0) AS monthly_revenue_paise
     FROM creator_subscriptions WHERE creator_id = $1 AND status = 'active'`,
    [userId]
  );

  const { rows: subscribers } = await db.query(
    `SELECT cs.created_at, cs.current_period_end, cs.price_inr_paise,
            u.handle, u.display_name, u.avatar_url, u.verified
     FROM creator_subscriptions cs JOIN users u ON u.id = cs.subscriber_id
     WHERE cs.creator_id = $1 AND cs.status = 'active'
     ORDER BY cs.created_at DESC`,
    [userId]
  );

  R.ok(res, {
    subscriber_count:     Number(totals[0].subscriber_count),
    monthly_revenue_inr:  Number(totals[0].monthly_revenue_paise) / 100,
    subscribers,
  });
};

// ─── Check if viewer has access to exclusive post ─────────────────────────────
export const checkExclusiveAccess = async (req: Request, res: Response): Promise<void> => {
  const { id: viewerId } = (req as AuthenticatedRequest).user;
  const { postId } = req.params;

  const { rows: post } = await db.query(
    `SELECT p.id, p.user_id, p.is_exclusive FROM posts p WHERE p.id = $1`, [postId]
  );
  if (!post[0]) { R.notFound(res, 'Post not found'); return; }

  // Own post — always accessible
  if (post[0].user_id === viewerId) { R.ok(res, { has_access: true, reason: 'own_post' }); return; }

  if (!post[0].is_exclusive) { R.ok(res, { has_access: true, reason: 'public' }); return; }

  const { rows: sub } = await db.query(
    `SELECT id FROM creator_subscriptions
     WHERE creator_id=$1 AND subscriber_id=$2 AND status='active' AND current_period_end > NOW()`,
    [post[0].user_id, viewerId]
  );

  R.ok(res, { has_access: sub.length > 0, reason: sub.length > 0 ? 'subscribed' : 'not_subscribed' });
};
