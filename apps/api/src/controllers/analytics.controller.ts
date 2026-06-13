import { Request, Response } from 'express';
import { db }  from '../config/db';
import * as R  from '../utils/response';
import { AuthenticatedRequest } from '../types';

// ─── Post analytics overview ──────────────────────────────────────────────────
export const getPostAnalytics = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const days = Math.min(Number(req.query.days) || 28, 90);

  // Total impressions, likes, reposts, replies in period
  const { rows: totals } = await db.query(
    `SELECT
       COALESCE(SUM(p.views_count), 0)   AS total_impressions,
       COALESCE(SUM(p.likes_count), 0)   AS total_likes,
       COALESCE(SUM(p.reposts_count), 0) AS total_reposts,
       COALESCE(SUM(p.replies_count), 0) AS total_replies,
       COUNT(*)                           AS total_posts
     FROM posts p
     WHERE p.user_id = $1
       AND p.is_published = TRUE
       AND p.created_at >= NOW() - ($2 || ' days')::INTERVAL`,
    [userId, days]
  );

  // Daily impressions for chart
  const { rows: daily } = await db.query(
    `SELECT
       DATE(p.created_at) AS date,
       COALESCE(SUM(p.views_count), 0)   AS impressions,
       COALESCE(SUM(p.likes_count), 0)   AS likes,
       COALESCE(SUM(p.reposts_count), 0) AS reposts,
       COUNT(*)                           AS posts
     FROM posts p
     WHERE p.user_id = $1
       AND p.is_published = TRUE
       AND p.created_at >= NOW() - ($2 || ' days')::INTERVAL
     GROUP BY DATE(p.created_at)
     ORDER BY date ASC`,
    [userId, days]
  );

  // Top posts by impressions
  const { rows: topPosts } = await db.query(
    `SELECT p.id, p.content, p.views_count, p.likes_count,
            p.reposts_count, p.replies_count, p.created_at
     FROM posts p
     WHERE p.user_id = $1 AND p.is_published = TRUE
     ORDER BY p.views_count DESC
     LIMIT 5`,
    [userId]
  );

  // Engagement rate
  const total = totals[0];
  const engagementRate = total.total_impressions > 0
    ? ((Number(total.total_likes) + Number(total.total_reposts) + Number(total.total_replies)) / Number(total.total_impressions) * 100).toFixed(2)
    : '0.00';

  R.ok(res, {
    period_days:      days,
    totals:           { ...total, engagement_rate: engagementRate },
    daily_breakdown:  daily,
    top_posts:        topPosts,
  });
};

// ─── Profile / follower analytics ────────────────────────────────────────────
export const getProfileAnalytics = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;

  const { rows: user } = await db.query(
    `SELECT handle, display_name, followers_count, following_count,
            posts_count, verified, premium_tier, created_at
     FROM users WHERE id = $1`,
    [userId]
  );

  // New followers last 30 days (approximation via join date)
  const { rows: followerGrowth } = await db.query(
    `SELECT DATE(created_at) AS date, COUNT(*) AS new_followers
     FROM follows
     WHERE following_id = $1
       AND created_at >= NOW() - INTERVAL '30 days'
     GROUP BY DATE(created_at)
     ORDER BY date ASC`,
    [userId]
  );

  // Who followed recently
  const { rows: recentFollowers } = await db.query(
    `SELECT u.id, u.handle, u.display_name, u.avatar_url, u.verified, f.created_at
     FROM follows f JOIN users u ON u.id = f.follower_id
     WHERE f.following_id = $1
     ORDER BY f.created_at DESC
     LIMIT 10`,
    [userId]
  );

  // Profile visits (from post views as proxy)
  const { rows: visits } = await db.query(
    `SELECT COALESCE(SUM(views_count), 0) AS total_profile_views
     FROM posts WHERE user_id = $1 AND is_published = TRUE`,
    [userId]
  );

  R.ok(res, {
    profile:          user[0],
    follower_growth:  followerGrowth,
    recent_followers: recentFollowers,
    total_profile_views: visits[0]?.total_profile_views || 0,
  });
};

// ─── Top hashtags used by creator ────────────────────────────────────────────
export const getHashtagAnalytics = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;

  const { rows } = await db.query(
    `SELECT h.name, COUNT(ph.post_id) AS usage_count,
            SUM(p.views_count) AS total_impressions,
            SUM(p.likes_count) AS total_likes
     FROM post_hashtags ph
     JOIN hashtags h ON h.id = ph.hashtag_id
     JOIN posts p ON p.id = ph.post_id
     WHERE p.user_id = $1 AND p.is_published = TRUE
       AND p.created_at >= NOW() - INTERVAL '30 days'
     GROUP BY h.name
     ORDER BY total_impressions DESC
     LIMIT 10`,
    [userId]
  );

  R.ok(res, rows);
};
