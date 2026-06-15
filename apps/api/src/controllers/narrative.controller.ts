import { Request, Response } from 'express';
import { db }    from '../config/db';
import { redis } from '../config/redis';
import * as R    from '../utils/response';
import { AuthenticatedRequest } from '../types';

// ─── TRENDING TOPICS ──────────────────────────────────────────────────────────

export const getTrendingTopics = async (req: Request, res: Response): Promise<void> => {
  const region = (req.query.region as string) || 'national';
  const limit  = Math.min(Number(req.query.limit) || 20, 50);

  const cacheKey = `trending:topics:${region}`;
  const cached   = await redis.get(cacheKey);
  if (cached) { R.ok(res, JSON.parse(cached)); return; }

  // Compute trending from hashtags in last 24 hours
  const { rows } = await db.query(
    `SELECT
       h.name AS hashtag,
       COUNT(ph.post_id) AS post_count,
       COUNT(ph.post_id) FILTER (WHERE p.created_at >= NOW() - INTERVAL '1 hour') AS posts_last_hour,
       COUNT(ph.post_id) FILTER (WHERE p.created_at >= NOW() - INTERVAL '6 hours') AS posts_last_6h,
       MAX(p.created_at) AS latest_post,
       COALESCE(SUM(p.likes_count + p.reposts_count), 0) AS total_engagement
     FROM hashtags h
     JOIN post_hashtags ph ON ph.hashtag_id = h.id
     JOIN posts p ON p.id = ph.post_id
     WHERE p.created_at >= NOW() - INTERVAL '24 hours'
       AND p.is_published = TRUE
     GROUP BY h.name
     ORDER BY posts_last_hour DESC, post_count DESC
     LIMIT $1`,
    [limit]
  );

  const topics = rows.map((r: any, i: number) => ({
    rank:            i + 1,
    hashtag:         r.hashtag,
    post_count:      Number(r.post_count),
    posts_last_hour: Number(r.posts_last_hour),
    posts_last_6h:   Number(r.posts_last_6h),
    total_engagement: Number(r.total_engagement),
    velocity:        Number(r.posts_last_hour),
    region,
    is_trending:     Number(r.posts_last_hour) > 0,
  }));

  await redis.setex(cacheKey, 300, JSON.stringify(topics)); // 5 min cache
  R.ok(res, topics);
};

// ─── PINNED POSTS ─────────────────────────────────────────────────────────────

export const getPinnedPosts = async (_req: Request, res: Response): Promise<void> => {
  const { rows } = await db.query(
    `SELECT pp.*, p.content, p.created_at AS post_created_at,
            p.likes_count, p.reposts_count, p.replies_count, p.views_count,
            u.handle AS author_handle, u.display_name AS author_name,
            u.avatar_url AS author_avatar, u.verified AS author_verified,
            pinner.handle AS pinned_by_handle
     FROM pinned_posts pp
     JOIN posts p ON p.id = pp.post_id
     JOIN users u ON u.id = p.user_id
     JOIN users pinner ON pinner.id = pp.pinned_by
     WHERE (pp.expires_at IS NULL OR pp.expires_at > NOW())
       AND p.is_published = TRUE
     ORDER BY pp.created_at DESC
     LIMIT 5`
  );
  R.ok(res, rows);
};

export const pinPost = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const { post_id, reason, expires_hours } = req.body;

  // Check if post exists
  const { rows: post } = await db.query('SELECT id FROM posts WHERE id = $1', [post_id]);
  if (!post[0]) { R.notFound(res, 'Post not found'); return; }

  const expires_at = expires_hours
    ? new Date(Date.now() + expires_hours * 3600000)
    : null;

  const { rows } = await db.query(
    `INSERT INTO pinned_posts (post_id, pinned_by, reason, expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [post_id, userId, reason || null, expires_at]
  );

  R.created(res, rows[0]);
};

export const unpinPost = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  await db.query('DELETE FROM pinned_posts WHERE id = $1', [id]);
  R.noContent(res);
};

// ─── CAMPAIGNS ────────────────────────────────────────────────────────────────

export const getCampaigns = async (req: Request, res: Response): Promise<void> => {
  const userId   = (req as any).user?.id || null;
  const category = (req.query.category as string) || null;
  const status   = (req.query.status as string) || 'active';
  const limit    = Math.min(Number(req.query.limit) || 20, 50);

  const { rows } = await db.query(
    `SELECT c.*,
            u.handle AS creator_handle, u.display_name AS creator_name,
            u.avatar_url AS creator_avatar, u.verified AS creator_verified,
            EXISTS(SELECT 1 FROM campaign_supporters WHERE campaign_id = c.id AND user_id = $1::uuid) AS is_supporting
     FROM campaigns c JOIN users u ON u.id = c.creator_id
     WHERE c.status = $2
       AND ($3::text IS NULL OR c.category = $3)
     ORDER BY c.supporter_count DESC, c.created_at DESC
     LIMIT $4`,
    [userId, status, category, limit]
  );

  R.ok(res, rows);
};

export const getCampaign = async (req: Request, res: Response): Promise<void> => {
  const { id }  = req.params;
  const userId  = (req as any).user?.id || null;

  const { rows } = await db.query(
    `SELECT c.*,
            u.handle AS creator_handle, u.display_name AS creator_name,
            u.avatar_url AS creator_avatar, u.verified AS creator_verified,
            EXISTS(SELECT 1 FROM campaign_supporters WHERE campaign_id = c.id AND user_id = $2::uuid) AS is_supporting
     FROM campaigns c JOIN users u ON u.id = c.creator_id
     WHERE c.id = $1`,
    [id, userId]
  );

  if (!rows[0]) { R.notFound(res, 'Campaign not found'); return; }
  R.ok(res, rows[0]);
};

export const createCampaign = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const { hashtag, title, description, goal, category = 'general', ends_hours } = req.body;

  // Clean hashtag
  const cleanTag = hashtag.replace(/^#/, '').toLowerCase().trim();

  const ends_at = ends_hours
    ? new Date(Date.now() + ends_hours * 3600000)
    : null;

  const { rows } = await db.query(
    `INSERT INTO campaigns (creator_id, hashtag, title, description, goal, category, ends_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [userId, cleanTag, title, description || null, goal || null, category, ends_at]
  );

  // Auto-support own campaign
  await db.query(
    'INSERT INTO campaign_supporters (campaign_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [rows[0].id, userId]
  );

  R.created(res, rows[0]);
};

export const supportCampaign = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const { id }         = req.params;

  const existing = await db.query(
    'SELECT 1 FROM campaign_supporters WHERE campaign_id = $1 AND user_id = $2',
    [id, userId]
  );

  if (existing.rows[0]) {
    await db.query('DELETE FROM campaign_supporters WHERE campaign_id = $1 AND user_id = $2', [id, userId]);
    R.ok(res, { supporting: false });
  } else {
    await db.query('INSERT INTO campaign_supporters (campaign_id, user_id) VALUES ($1, $2)', [id, userId]);
    R.ok(res, { supporting: true });
  }
};

// Update campaign post count when a post with the hashtag is created
export const updateCampaignPostCount = async (hashtags: string[]): Promise<void> => {
  for (const tag of hashtags) {
    await db.query(
      `UPDATE campaigns SET post_count = post_count + 1
       WHERE hashtag = $1 AND status = 'active'`,
      [tag.toLowerCase()]
    );
  }
};

// ─── HASHTAG DEEP DIVE ────────────────────────────────────────────────────────

export const getHashtagStats = async (req: Request, res: Response): Promise<void> => {
  const { tag } = req.params;
  const cleanTag = tag.replace(/^#/, '').toLowerCase();

  const { rows: stats } = await db.query(
    `SELECT
       COUNT(DISTINCT ph.post_id) AS total_posts,
       COUNT(DISTINCT p.user_id)  AS unique_authors,
       COALESCE(SUM(p.likes_count), 0) AS total_likes,
       COALESCE(SUM(p.reposts_count), 0) AS total_reposts,
       COALESCE(SUM(p.views_count), 0) AS total_views,
       COUNT(ph.post_id) FILTER (WHERE p.created_at >= NOW() - INTERVAL '1 hour')  AS posts_last_hour,
       COUNT(ph.post_id) FILTER (WHERE p.created_at >= NOW() - INTERVAL '24 hours') AS posts_last_24h,
       MIN(p.created_at) AS first_used,
       MAX(p.created_at) AS last_used
     FROM hashtags h
     JOIN post_hashtags ph ON ph.hashtag_id = h.id
     JOIN posts p ON p.id = ph.post_id
     WHERE h.name = $1 AND p.is_published = TRUE`,
    [cleanTag]
  );

  // Top contributors
  const { rows: topUsers } = await db.query(
    `SELECT u.handle, u.display_name, u.avatar_url, u.verified,
            COUNT(ph.post_id) AS post_count
     FROM hashtags h
     JOIN post_hashtags ph ON ph.hashtag_id = h.id
     JOIN posts p ON p.id = ph.post_id
     JOIN users u ON u.id = p.user_id
     WHERE h.name = $1 AND p.is_published = TRUE
     GROUP BY u.id, u.handle, u.display_name, u.avatar_url, u.verified
     ORDER BY post_count DESC
     LIMIT 5`,
    [cleanTag]
  );

  // Active campaign for this hashtag
  const { rows: campaign } = await db.query(
    `SELECT * FROM campaigns WHERE hashtag = $1 AND status = 'active' LIMIT 1`,
    [cleanTag]
  );

  R.ok(res, {
    hashtag:      cleanTag,
    stats:        stats[0],
    top_users:    topUsers,
    campaign:     campaign[0] || null,
  });
};
