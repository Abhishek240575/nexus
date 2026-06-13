import { Request, Response } from 'express';
import { db }  from '../config/db';
import * as R  from '../utils/response';
import { AuthenticatedRequest } from '../types';

// ─── Get notifications ────────────────────────────────────────────────────────
export const getNotifications = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const limit  = Math.min(Number(req.query.limit) || 20, 50);
  const cursor = req.query.cursor as string | undefined;

  const { rows } = await db.query(
    `SELECT n.*,
            u.handle AS actor_handle, u.display_name AS actor_name,
            u.avatar_url AS actor_avatar, u.verified AS actor_verified,
            p.content AS post_content
     FROM notifications n
     LEFT JOIN users u ON u.id = n.actor_id
     LEFT JOIN posts p ON p.id = n.post_id
     WHERE n.user_id = $1
       AND ($3::timestamptz IS NULL OR n.created_at < $3::timestamptz)
     ORDER BY n.created_at DESC
     LIMIT $2`,
    [userId, limit, cursor || null]
  );

  R.ok(res, {
    data:        rows,
    next_cursor: rows.length === limit ? rows[rows.length - 1].created_at : null,
    has_more:    rows.length === limit,
  });
};

// ─── Mark all as read ─────────────────────────────────────────────────────────
export const markAllRead = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  await db.query('UPDATE notifications SET read = TRUE WHERE user_id = $1', [userId]);
  R.ok(res, null, 'Notifications marked as read');
};

// ─── Mark one as read ─────────────────────────────────────────────────────────
export const markOneRead = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const { id }         = req.params;
  await db.query(
    'UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  R.ok(res, null);
};

// ─── Get unread count ─────────────────────────────────────────────────────────
export const getUnreadCount = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const { rows } = await db.query(
    'SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND read = FALSE',
    [userId]
  );
  R.ok(res, { count: Number(rows[0].count) });
};

// ─── Helper: create notification (called from other controllers) ──────────────
export const createNotification = async (data: {
  user_id:  string;
  type:     string;
  actor_id: string;
  post_id?: string;
}): Promise<void> => {
  // Don't notify yourself
  if (data.user_id === data.actor_id) return;

  await db.query(
    `INSERT INTO notifications (user_id, type, actor_id, post_id)
     VALUES ($1, $2, $3, $4)`,
    [data.user_id, data.type, data.actor_id, data.post_id || null]
  );
};
