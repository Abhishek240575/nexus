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
