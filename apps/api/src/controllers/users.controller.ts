import { Request, Response } from 'express';
import { db }  from '../config/db';
import * as R  from '../utils/response';
import { AuthenticatedRequest } from '../types';

// ─── Get user profile by handle ───────────────────────────────────────────────
export const getProfile = async (req: Request, res: Response): Promise<void> => {
  const { handle } = req.params;
  const viewerId   = (req as any).user?.id;

  const { rows } = await db.query(
    `SELECT u.id, u.handle, u.display_name, u.bio, u.avatar_url, u.header_url,
            u.location, u.website, u.verified, u.premium_tier,
            u.followers_count, u.following_count, u.posts_count, u.created_at,
            ${viewerId ? `
            EXISTS(SELECT 1 FROM follows WHERE follower_id = $2 AND following_id = u.id) AS is_following,
            EXISTS(SELECT 1 FROM blocks  WHERE blocker_id  = $2 AND blocked_id   = u.id) AS is_blocking
            ` : 'FALSE AS is_following, FALSE AS is_blocking'}
     FROM users u
     WHERE u.handle = $1 AND u.suspended = FALSE`,
    viewerId ? [handle, viewerId] : [handle]
  );

  if (!rows[0]) { R.notFound(res, 'User not found'); return; }
  R.ok(res, rows[0]);
};

// ─── Get user posts ───────────────────────────────────────────────────────────
export const getUserPosts = async (req: Request, res: Response): Promise<void> => {
  const { handle } = req.params;
  const limit  = Math.min(Number(req.query.limit) || 20, 50);
  const cursor = (req.query.cursor as string) || null;
  const tab    = (req.query.tab as string) || 'posts';

  const { rows: userRows } = await db.query('SELECT id FROM users WHERE handle = $1', [handle]);
  if (!userRows[0]) { R.notFound(res, 'User not found'); return; }
  const profileId = userRows[0].id;

  let whereClause = 'p.user_id = $1 AND p.is_published = TRUE';
  if (tab === 'replies') whereClause += ' AND p.reply_to_id IS NOT NULL';
  else if (tab === 'media') whereClause += ' AND array_length(p.media_urls, 1) > 0';
  else whereClause += ' AND p.reply_to_id IS NULL';

  const { rows } = await db.query(
    `SELECT p.*, u.handle AS author_handle, u.display_name AS author_name,
            u.avatar_url AS author_avatar, u.verified AS author_verified,
            u.premium_tier AS author_tier
     FROM posts p JOIN users u ON u.id = p.user_id
     WHERE ${whereClause}
       AND ($3::timestamptz IS NULL OR p.created_at < $3::timestamptz)
     ORDER BY p.created_at DESC
     LIMIT $2`,
    [profileId, limit, cursor]
  );

  R.ok(res, {
    data:        rows,
    next_cursor: rows.length === limit ? rows[rows.length - 1].created_at : null,
    has_more:    rows.length === limit,
  });
};

// ─── Follow / unfollow ────────────────────────────────────────────────────────
export const followUser = async (req: Request, res: Response): Promise<void> => {
  const { id: followerId } = (req as AuthenticatedRequest).user;
  const { id: followingId } = req.params;

  if (followerId === followingId) { R.badRequest(res, 'Cannot follow yourself'); return; }

  const { rows: target } = await db.query('SELECT id FROM users WHERE id = $1', [followingId]);
  if (!target[0]) { R.notFound(res, 'User not found'); return; }

  const existing = await db.query(
    'SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2',
    [followerId, followingId]
  );

  if (existing.rows[0]) {
    await db.query(
      'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2',
      [followerId, followingId]
    );
    R.ok(res, { following: false });
  } else {
    await db.query(
      'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [followerId, followingId]
    );
    R.ok(res, { following: true });
  }
};

// ─── Get followers ────────────────────────────────────────────────────────────
export const getFollowers = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const limit  = Math.min(Number(req.query.limit) || 20, 50);
  const cursor = req.query.cursor as string;

  const { rows } = await db.query(
    `SELECT u.id, u.handle, u.display_name, u.avatar_url, u.verified,
            u.premium_tier, u.bio, f.created_at AS followed_at
     FROM follows f JOIN users u ON u.id = f.follower_id
     WHERE f.following_id = $1
       ${cursor ? 'AND f.created_at < $3' : ''}
     ORDER BY f.created_at DESC LIMIT $2`,
    cursor ? [id, limit, cursor] : [id, limit]
  );

  R.ok(res, {
    data:        rows,
    next_cursor: rows.length === limit ? rows[rows.length - 1].followed_at : null,
    has_more:    rows.length === limit,
  });
};

// ─── Get following ────────────────────────────────────────────────────────────
export const getFollowing = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const limit  = Math.min(Number(req.query.limit) || 20, 50);
  const cursor = req.query.cursor as string;

  const { rows } = await db.query(
    `SELECT u.id, u.handle, u.display_name, u.avatar_url, u.verified,
            u.premium_tier, u.bio, f.created_at AS followed_at
     FROM follows f JOIN users u ON u.id = f.following_id
     WHERE f.follower_id = $1
       ${cursor ? 'AND f.created_at < $3' : ''}
     ORDER BY f.created_at DESC LIMIT $2`,
    cursor ? [id, limit, cursor] : [id, limit]
  );

  R.ok(res, {
    data:        rows,
    next_cursor: rows.length === limit ? rows[rows.length - 1].followed_at : null,
    has_more:    rows.length === limit,
  });
};

// ─── Update profile ───────────────────────────────────────────────────────────
export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  const { id } = (req as AuthenticatedRequest).user;
  const { display_name, bio, location, website, avatar_url, header_url } = req.body;

  const { rows } = await db.query(
    `UPDATE users SET
       display_name = COALESCE($1, display_name),
       bio          = COALESCE($2, bio),
       location     = COALESCE($3, location),
       website      = COALESCE($4, website),
       avatar_url   = COALESCE($5, avatar_url),
       header_url   = COALESCE($6, header_url),
       updated_at   = NOW()
     WHERE id = $7
     RETURNING id, handle, display_name, bio, avatar_url, header_url,
               location, website, verified, premium_tier,
               followers_count, following_count, posts_count`,
    [display_name, bio, location, website, avatar_url, header_url, id]
  );

  R.ok(res, rows[0]);
};

// ─── Search users + posts ─────────────────────────────────────────────────────
export const search = async (req: Request, res: Response): Promise<void> => {
  const q      = (req.query.q as string)?.trim();
  const type   = (req.query.type as string) || 'all'; // all | users | posts
  const limit  = Math.min(Number(req.query.limit) || 10, 30);

  if (!q || q.length < 2) { R.badRequest(res, 'Query too short'); return; }

  const results: any = {};

  if (type === 'all' || type === 'users') {
    const { rows } = await db.query(
      `SELECT id, handle, display_name, avatar_url, verified, premium_tier,
              followers_count, bio
       FROM users
       WHERE search_vector @@ plainto_tsquery('english', $1)
         AND suspended = FALSE
       ORDER BY followers_count DESC
       LIMIT $2`,
      [q, limit]
    );
    results.users = rows;
  }

  if (type === 'all' || type === 'posts') {
    const { rows } = await db.query(
      `SELECT p.*, u.handle AS author_handle, u.display_name AS author_name,
              u.avatar_url AS author_avatar, u.verified AS author_verified
       FROM posts p JOIN users u ON u.id = p.user_id
       WHERE p.search_vector @@ plainto_tsquery('english', $1)
         AND p.is_published = TRUE AND u.suspended = FALSE
       ORDER BY p.created_at DESC
       LIMIT $2`,
      [q, limit]
    );
    results.posts = rows;
  }

  R.ok(res, results);
};
