import { Request, Response } from 'express';
import { db }  from '../config/db';
import * as R  from '../utils/response';
import { AuthenticatedRequest } from '../types';

// ─── Get moderation queue (flagged posts) ─────────────────────────────────────
export const getModerationQueue = async (req: Request, res: Response): Promise<void> => {
  const limit  = Math.min(Number(req.query.limit) || 20, 100);
  const status = (req.query.status as string) || 'pending';

  const { rows } = await db.query(
    `SELECT mq.*, p.content, p.user_id,
            u.handle AS author_handle, u.display_name AS author_name,
            u.email AS author_email
     FROM moderation_queue mq
     JOIN posts p ON p.id = mq.post_id
     JOIN users u ON u.id = p.user_id
     WHERE mq.status = $1
     ORDER BY mq.created_at ASC
     LIMIT $2`,
    [status, limit]
  );

  R.ok(res, rows);
};

// ─── Review a flagged post ────────────────────────────────────────────────────
export const reviewPost = async (req: Request, res: Response): Promise<void> => {
  const { id: reviewerId } = (req as AuthenticatedRequest).user;
  const { id }             = req.params;
  const { action, note }   = req.body;
  // action: 'approve' | 'reject' | 'warn'

  const { rows: queueRows } = await db.query(
    'SELECT * FROM moderation_queue WHERE id = $1',
    [id]
  );
  if (!queueRows[0]) { R.notFound(res, 'Queue item not found'); return; }
  const item = queueRows[0];

  if (action === 'approve') {
    // Publish the post
    await db.query(
      'UPDATE posts SET is_published = TRUE WHERE id = $1',
      [item.post_id]
    );
    await db.query(
      'UPDATE moderation_queue SET status = $1, reviewed_by = $2, reviewer_note = $3, reviewed_at = NOW() WHERE id = $4',
      ['approved', reviewerId, note || null, id]
    );
  } else if (action === 'reject') {
    // Delete the post
    await db.query('DELETE FROM posts WHERE id = $1', [item.post_id]);
    await db.query(
      'UPDATE moderation_queue SET status = $1, reviewed_by = $2, reviewer_note = $3, reviewed_at = NOW() WHERE id = $4',
      ['rejected', reviewerId, note || null, id]
    );
    // Notify user
    await db.query(
      `INSERT INTO notifications (user_id, type, actor_id)
       SELECT user_id, 'system', $1 FROM posts WHERE id = $2`,
      [reviewerId, item.post_id]
    );
  } else if (action === 'warn') {
    // Publish with warning
    await db.query(
      'UPDATE posts SET is_published = TRUE, has_warning = TRUE WHERE id = $1',
      [item.post_id]
    );
    await db.query(
      'UPDATE moderation_queue SET status = $1, reviewed_by = $2, reviewer_note = $3, reviewed_at = NOW() WHERE id = $4',
      ['warned', reviewerId, note || null, id]
    );
  }

  R.ok(res, null, `Post ${action}d`);
};

// ─── Ban a user ───────────────────────────────────────────────────────────────
export const banUser = async (req: Request, res: Response): Promise<void> => {
  const { id: adminId } = (req as AuthenticatedRequest).user;
  const { userId }      = req.params;
  const { reason, permanent = false, duration_days = 7 } = req.body;

  await db.query(
    'UPDATE users SET suspended = TRUE WHERE id = $1',
    [userId]
  );

  await db.query(
    `INSERT INTO user_bans (user_id, banned_by, reason, permanent, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      userId,
      adminId,
      reason,
      permanent,
      permanent ? null : new Date(Date.now() + duration_days * 86400000),
    ]
  );

  // Delete all pending posts by this user
  await db.query(
    'UPDATE posts SET is_published = FALSE WHERE user_id = $1 AND is_published = FALSE',
    [userId]
  );

  R.ok(res, null, `User banned ${permanent ? 'permanently' : `for ${duration_days} days`}`);
};

// ─── Get moderation stats ─────────────────────────────────────────────────────
export const getModerationStats = async (_req: Request, res: Response): Promise<void> => {
  const { rows } = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM moderation_queue WHERE status = 'pending')  AS pending_reviews,
       (SELECT COUNT(*) FROM moderation_queue WHERE status = 'rejected') AS total_rejected,
       (SELECT COUNT(*) FROM moderation_queue WHERE status = 'approved') AS total_approved,
       (SELECT COUNT(*) FROM moderation_queue WHERE created_at >= NOW() - INTERVAL '24 hours') AS flagged_24h,
       (SELECT COUNT(*) FROM users WHERE suspended = TRUE)               AS banned_users,
       (SELECT COUNT(*) FROM posts WHERE is_published = FALSE AND created_at >= NOW() - INTERVAL '24 hours') AS pending_posts`
  );
  R.ok(res, rows[0]);
};

// ─── Get user violation history ───────────────────────────────────────────────
export const getUserViolations = async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.params;

  const { rows } = await db.query(
    `SELECT mq.*, p.content
     FROM moderation_queue mq
     JOIN posts p ON p.id = mq.post_id
     WHERE p.user_id = $1 AND mq.status IN ('rejected', 'warned')
     ORDER BY mq.created_at DESC`,
    [userId]
  );

  R.ok(res, rows);
};
