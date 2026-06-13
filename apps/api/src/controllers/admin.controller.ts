import { Request, Response } from 'express';
import { db }  from '../config/db';
import * as R  from '../utils/response';
import { AuthenticatedRequest } from '../types';

// ─── Admin guard helper ───────────────────────────────────────────────────────
const isAdmin = async (userId: string): Promise<boolean> => {
  const { rows } = await db.query(
    'SELECT verified FROM users WHERE id = $1 AND premium_tier = $2',
    [userId, 'creator']
  );
  // For now: creator + verified = admin. Replace with a proper admin flag later.
  return rows[0]?.verified === true;
};

// ─── Get all users ────────────────────────────────────────────────────────────
export const getUsers = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  if (!(await isAdmin(userId))) { R.forbidden(res, 'Admin only'); return; }

  const limit  = Math.min(Number(req.query.limit) || 20, 100);
  const cursor = (req.query.cursor as string) || null;
  const q      = (req.query.q as string) || null;

  const { rows } = await db.query(
    `SELECT id, handle, email, display_name, verified, premium_tier,
            suspended, followers_count, posts_count, created_at
     FROM users
     WHERE ($1::text IS NULL OR handle ILIKE '%' || $1 || '%' OR email ILIKE '%' || $1 || '%')
       AND ($3::timestamptz IS NULL OR created_at < $3::timestamptz)
     ORDER BY created_at DESC
     LIMIT $2`,
    [q, limit, cursor]
  );

  R.ok(res, {
    data:        rows,
    next_cursor: rows.length === limit ? rows[rows.length - 1].created_at : null,
    has_more:    rows.length === limit,
  });
};

// ─── Verify user ──────────────────────────────────────────────────────────────
export const verifyUser = async (req: Request, res: Response): Promise<void> => {
  const { id: adminId } = (req as AuthenticatedRequest).user;
  if (!(await isAdmin(adminId))) { R.forbidden(res, 'Admin only'); return; }

  const { id } = req.params;
  await db.query('UPDATE users SET verified = TRUE WHERE id = $1', [id]);
  R.ok(res, null, 'User verified');
};

// ─── Suspend / unsuspend user ─────────────────────────────────────────────────
export const suspendUser = async (req: Request, res: Response): Promise<void> => {
  const { id: adminId } = (req as AuthenticatedRequest).user;
  if (!(await isAdmin(adminId))) { R.forbidden(res, 'Admin only'); return; }

  const { id } = req.params;
  const { suspended } = req.body;

  await db.query('UPDATE users SET suspended = $1 WHERE id = $2', [suspended, id]);
  R.ok(res, null, suspended ? 'User suspended' : 'User unsuspended');
};

// ─── Get reports ──────────────────────────────────────────────────────────────
export const getReports = async (req: Request, res: Response): Promise<void> => {
  const { id: adminId } = (req as AuthenticatedRequest).user;
  if (!(await isAdmin(adminId))) { R.forbidden(res, 'Admin only'); return; }

  const status = (req.query.status as string) || 'pending';
  const limit  = Math.min(Number(req.query.limit) || 20, 100);

  const { rows } = await db.query(
    `SELECT r.*,
            u.handle AS reporter_handle,
            u.display_name AS reporter_name
     FROM reports r JOIN users u ON u.id = r.reporter_id
     WHERE r.status = $1
     ORDER BY r.created_at DESC
     LIMIT $2`,
    [status, limit]
  );

  R.ok(res, rows);
};

// ─── Update report status ─────────────────────────────────────────────────────
export const updateReport = async (req: Request, res: Response): Promise<void> => {
  const { id: adminId } = (req as AuthenticatedRequest).user;
  if (!(await isAdmin(adminId))) { R.forbidden(res, 'Admin only'); return; }

  const { id } = req.params;
  const { status } = req.body;

  await db.query(
    'UPDATE reports SET status = $1, reviewed_by = $2, reviewed_at = NOW() WHERE id = $3',
    [status, adminId, id]
  );
  R.ok(res, null, 'Report updated');
};

// ─── Platform stats ───────────────────────────────────────────────────────────
export const getStats = async (req: Request, res: Response): Promise<void> => {
  const { id: adminId } = (req as AuthenticatedRequest).user;
  if (!(await isAdmin(adminId))) { R.forbidden(res, 'Admin only'); return; }

  const { rows } = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM users)                         AS total_users,
       (SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '7 days') AS new_users_7d,
       (SELECT COUNT(*) FROM posts WHERE is_published = TRUE)  AS total_posts,
       (SELECT COUNT(*) FROM posts WHERE created_at >= NOW() - INTERVAL '24 hours') AS posts_24h,
       (SELECT COUNT(*) FROM likes)                         AS total_likes,
       (SELECT COUNT(*) FROM follows)                       AS total_follows,
       (SELECT COUNT(*) FROM communities)                   AS total_communities,
       (SELECT COUNT(*) FROM reports WHERE status = 'pending') AS pending_reports`
  );

  R.ok(res, rows[0]);
};

// ─── Delete any post (admin) ──────────────────────────────────────────────────
export const deletePost = async (req: Request, res: Response): Promise<void> => {
  const { id: adminId } = (req as AuthenticatedRequest).user;
  if (!(await isAdmin(adminId))) { R.forbidden(res, 'Admin only'); return; }

  const { id } = req.params;
  await db.query('DELETE FROM posts WHERE id = $1', [id]);
  R.noContent(res);
};
