import { Request, Response } from 'express';
import { db }  from '../config/db';
import * as R  from '../utils/response';
import { AuthenticatedRequest } from '../types';

// ─── Get user's lists ─────────────────────────────────────────────────────────
export const getLists = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user?.id || null;
  const { handle } = req.params;

  const { rows: owner } = await db.query('SELECT id FROM users WHERE handle = $1', [handle]);
  if (!owner[0]) { R.notFound(res, 'User not found'); return; }

  const { rows } = await db.query(
    `SELECT l.*, u.handle AS owner_handle, u.display_name AS owner_name, u.avatar_url AS owner_avatar,
            EXISTS(SELECT 1 FROM list_followers WHERE list_id = l.id AND user_id = $2::uuid) AS is_following
     FROM lists l JOIN users u ON u.id = l.owner_id
     WHERE l.owner_id = $1
     ORDER BY l.created_at DESC`,
    [owner[0].id, userId]
  );
  R.ok(res, rows);
};

// ─── Get all lists (explore) ──────────────────────────────────────────────────
export const getAllLists = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user?.id || null;
  const limit  = Math.min(Number(req.query.limit) || 20, 50);

  const { rows } = await db.query(
    `SELECT l.*, u.handle AS owner_handle, u.display_name AS owner_name, u.avatar_url AS owner_avatar,
            EXISTS(SELECT 1 FROM list_followers WHERE list_id = l.id AND user_id = $1::uuid) AS is_following
     FROM lists l JOIN users u ON u.id = l.owner_id
     WHERE l.is_private = FALSE
     ORDER BY l.follower_count DESC, l.created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  R.ok(res, rows);
};

// ─── Get single list ──────────────────────────────────────────────────────────
export const getList = async (req: Request, res: Response): Promise<void> => {
  const { id }  = req.params;
  const userId  = (req as any).user?.id || null;

  const { rows } = await db.query(
    `SELECT l.*, u.handle AS owner_handle, u.display_name AS owner_name, u.avatar_url AS owner_avatar,
            EXISTS(SELECT 1 FROM list_followers WHERE list_id = l.id AND user_id = $2::uuid) AS is_following
     FROM lists l JOIN users u ON u.id = l.owner_id
     WHERE l.id = $1`,
    [id, userId]
  );
  if (!rows[0]) { R.notFound(res, 'List not found'); return; }
  R.ok(res, rows[0]);
};

// ─── Create list ──────────────────────────────────────────────────────────────
export const createList = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const { name, description, is_private = false } = req.body;

  const { rows } = await db.query(
    `INSERT INTO lists (owner_id, name, description, is_private)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [userId, name, description || null, is_private]
  );
  R.created(res, rows[0]);
};

// ─── Update list ──────────────────────────────────────────────────────────────
export const updateList = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const { id }         = req.params;
  const { name, description, is_private } = req.body;

  const { rows } = await db.query('SELECT owner_id FROM lists WHERE id = $1', [id]);
  if (!rows[0]) { R.notFound(res, 'List not found'); return; }
  if (rows[0].owner_id !== userId) { R.forbidden(res, 'Not your list'); return; }

  const { rows: updated } = await db.query(
    `UPDATE lists SET name = COALESCE($1, name), description = COALESCE($2, description),
      is_private = COALESCE($3, is_private) WHERE id = $4 RETURNING *`,
    [name, description, is_private, id]
  );
  R.ok(res, updated[0]);
};

// ─── Delete list ──────────────────────────────────────────────────────────────
export const deleteList = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const { id }         = req.params;

  const { rows } = await db.query('SELECT owner_id FROM lists WHERE id = $1', [id]);
  if (!rows[0]) { R.notFound(res, 'List not found'); return; }
  if (rows[0].owner_id !== userId) { R.forbidden(res, 'Not your list'); return; }

  await db.query('DELETE FROM lists WHERE id = $1', [id]);
  R.noContent(res);
};

// ─── Get list members ─────────────────────────────────────────────────────────
export const getListMembers = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const { rows } = await db.query(
    `SELECT u.id, u.handle, u.display_name, u.avatar_url, u.bio, u.verified, u.premium_tier
     FROM list_members lm JOIN users u ON u.id = lm.user_id
     WHERE lm.list_id = $1
     ORDER BY lm.created_at DESC`,
    [id]
  );
  R.ok(res, rows);
};

// ─── Add member to list ───────────────────────────────────────────────────────
export const addMember = async (req: Request, res: Response): Promise<void> => {
  const { id: ownerId } = (req as AuthenticatedRequest).user;
  const { id }          = req.params;
  const { user_id }     = req.body;

  const { rows } = await db.query('SELECT owner_id FROM lists WHERE id = $1', [id]);
  if (!rows[0]) { R.notFound(res, 'List not found'); return; }
  if (rows[0].owner_id !== ownerId) { R.forbidden(res, 'Not your list'); return; }

  await db.query(
    `INSERT INTO list_members (list_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [id, user_id]
  );
  await db.query('UPDATE lists SET member_count = member_count + 1 WHERE id = $1', [id]);
  R.ok(res, null, 'Member added');
};

// ─── Remove member from list ──────────────────────────────────────────────────
export const removeMember = async (req: Request, res: Response): Promise<void> => {
  const { id: ownerId }     = (req as AuthenticatedRequest).user;
  const { id, userId }      = req.params;

  const { rows } = await db.query('SELECT owner_id FROM lists WHERE id = $1', [id]);
  if (!rows[0]) { R.notFound(res, 'List not found'); return; }
  if (rows[0].owner_id !== ownerId) { R.forbidden(res, 'Not your list'); return; }

  await db.query('DELETE FROM list_members WHERE list_id = $1 AND user_id = $2', [id, userId]);
  await db.query('UPDATE lists SET member_count = GREATEST(member_count - 1, 0) WHERE id = $1', [id]);
  R.noContent(res);
};

// ─── Follow/unfollow list ─────────────────────────────────────────────────────
export const toggleFollowList = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const { id }         = req.params;

  const existing = await db.query(
    'SELECT 1 FROM list_followers WHERE list_id = $1 AND user_id = $2',
    [id, userId]
  );

  if (existing.rows[0]) {
    await db.query('DELETE FROM list_followers WHERE list_id = $1 AND user_id = $2', [id, userId]);
    await db.query('UPDATE lists SET follower_count = GREATEST(follower_count - 1, 0) WHERE id = $1', [id]);
    R.ok(res, { following: false });
  } else {
    await db.query('INSERT INTO list_followers (list_id, user_id) VALUES ($1, $2)', [id, userId]);
    await db.query('UPDATE lists SET follower_count = follower_count + 1 WHERE id = $1', [id]);
    R.ok(res, { following: true });
  }
};

// ─── Get list feed ────────────────────────────────────────────────────────────
export const getListFeed = async (req: Request, res: Response): Promise<void> => {
  const { id }   = req.params;
  const userId   = (req as any).user?.id || null;
  const limit    = Math.min(Number(req.query.limit) || 20, 50);

  const { rows } = await db.query(
    `SELECT p.*, u.handle AS author_handle, u.display_name AS author_name,
            u.avatar_url AS author_avatar, u.verified AS author_verified,
            u.premium_tier AS author_tier,
            EXISTS(SELECT 1 FROM likes WHERE user_id = $2::uuid AND post_id = p.id) AS is_liked,
            EXISTS(SELECT 1 FROM reposts WHERE user_id = $2::uuid AND post_id = p.id) AS is_reposted,
            EXISTS(SELECT 1 FROM bookmarks WHERE user_id = $2::uuid AND post_id = p.id) AS is_bookmarked
     FROM posts p
     JOIN users u ON u.id = p.user_id
     JOIN list_members lm ON lm.user_id = p.user_id AND lm.list_id = $1
     WHERE p.is_published = TRUE AND p.reply_to_id IS NULL
     ORDER BY p.created_at DESC
     LIMIT $3`,
    [id, userId, limit]
  );
  R.ok(res, rows);
};

// ─── Get post activity ────────────────────────────────────────────────────────
export const getPostActivity = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const { rows } = await db.query(
    `SELECT
       p.views_count,
       p.likes_count,
       p.reposts_count,
       p.replies_count,
       (SELECT COUNT(*) FROM bookmarks WHERE post_id = p.id) AS bookmarks_count,
       p.created_at,
       p.content
     FROM posts p
     WHERE p.id = $1 AND p.is_published = TRUE`,
    [id]
  );

  if (!rows[0]) { R.notFound(res, 'Post not found'); return; }

  const post = rows[0];
  const engagementRate = post.views_count > 0
    ? (((Number(post.likes_count) + Number(post.reposts_count) + Number(post.replies_count)) / Number(post.views_count)) * 100).toFixed(1)
    : '0.0';

  R.ok(res, {
    views:           Number(post.views_count),
    likes:           Number(post.likes_count),
    reposts:         Number(post.reposts_count),
    replies:         Number(post.replies_count),
    bookmarks:       Number(post.bookmarks_count),
    engagement_rate: engagementRate,
  });
};
