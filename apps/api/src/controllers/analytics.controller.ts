import { Request, Response } from 'express';
import { db }  from '../config/db';
import * as R  from '../utils/response';
import { AuthenticatedRequest } from '../types';

// ─── Helper: get tier features for current user ───────────────────────────────
async function getTierFeatures(userId: string) {
  const { rows } = await db.query(
    `SELECT u.premium_tier, t.features, t.max_post_length
     FROM users u LEFT JOIN subscription_tiers t ON t.id = u.premium_tier
     WHERE u.id = $1`,
    [userId]
  );
  return {
    tier:     rows[0]?.premium_tier || 'free',
    features: rows[0]?.features    || {},
  };
}

// ─── Post analytics overview ──────────────────────────────────────────────────
// Free:  totals only, 28-day window
// Plus+: totals + daily breakdown + top posts, 90-day window
// Pro+:  everything above + demographic estimates + extended history
export const getPostAnalytics = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const { tier, features } = await getTierFeatures(userId);

  const isAdvanced = features.analytics === 'advanced'; // Plus, Pro, Enterprise
  const isPro      = ['pro', 'enterprise'].includes(tier);

  // Pro+ can request up to 365 days; Plus up to 90; Free locked to 28
  const requestedDays = Number(req.query.days) || 28;
  const maxDays = isPro ? 365 : isAdvanced ? 90 : 28;
  const days    = Math.min(requestedDays, maxDays);

  // Always return totals
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

  const total = totals[0];
  const engagementRate = total.total_impressions > 0
    ? ((Number(total.total_likes) + Number(total.total_reposts) + Number(total.total_replies)) / Number(total.total_impressions) * 100).toFixed(2)
    : '0.00';

  // Free tier: return basic summary only
  if (!isAdvanced) {
    return R.ok(res, {
      tier,
      period_days:     days,
      max_days:        maxDays,
      upgrade_message: 'Upgrade to Plus to unlock daily breakdown, top posts, and 90-day history.',
      totals:          { ...total, engagement_rate: engagementRate },
      daily_breakdown: null,
      top_posts:       null,
      demographic_note: null,
    });
  }

  // Plus+: daily breakdown + top posts
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

  const { rows: topPosts } = await db.query(
    `SELECT p.id, p.content, p.views_count, p.likes_count,
            p.reposts_count, p.replies_count, p.created_at
     FROM posts p
     WHERE p.user_id = $1 AND p.is_published = TRUE
     ORDER BY p.views_count DESC
     LIMIT 5`,
    [userId]
  );

  // Pro+: best-performing hashtags and reach estimate
  let hashtagPerformance = null;
  let reachEstimate      = null;
  if (isPro) {
    const { rows: hashtagPerf } = await db.query(
      `SELECT h.name, COUNT(ph.post_id) AS usage_count,
              SUM(p.views_count) AS total_impressions,
              SUM(p.likes_count) AS total_likes,
              ROUND(SUM(p.likes_count)::numeric / NULLIF(SUM(p.views_count), 0) * 100, 2) AS like_rate
       FROM post_hashtags ph
       JOIN hashtags h ON h.id = ph.hashtag_id
       JOIN posts p ON p.id = ph.post_id
       WHERE p.user_id = $1 AND p.is_published = TRUE
         AND p.created_at >= NOW() - ($2 || ' days')::INTERVAL
       GROUP BY h.name
       ORDER BY total_impressions DESC
       LIMIT 10`,
      [userId, days]
    );
    hashtagPerformance = hashtagPerf;

    // Estimate unique reach based on follower count + repost amplification
    const { rows: reachRow } = await db.query(
      `SELECT
         u.followers_count,
         COALESCE(SUM(p.reposts_count), 0) AS total_reposts,
         COALESCE(SUM(p.views_count), 0)    AS total_views
       FROM users u
       LEFT JOIN posts p ON p.user_id = u.id AND p.is_published = TRUE
         AND p.created_at >= NOW() - ($2 || ' days')::INTERVAL
       WHERE u.id = $1
       GROUP BY u.followers_count`,
      [userId, days]
    );
    if (reachRow[0]) {
      const r = reachRow[0];
      reachEstimate = {
        followers:         Number(r.followers_count),
        estimated_reach:   Math.round(Number(r.total_views) * 1.15), // views + repost amplification
        repost_amplification: Number(r.total_reposts),
      };
    }
  }

  R.ok(res, {
    tier,
    period_days:         days,
    max_days:            maxDays,
    totals:              { ...total, engagement_rate: engagementRate },
    daily_breakdown:     daily,
    top_posts:           topPosts,
    hashtag_performance: hashtagPerformance,
    reach_estimate:      reachEstimate,
  });
};

// ─── Profile / follower analytics ────────────────────────────────────────────
export const getProfileAnalytics = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const { features } = await getTierFeatures(userId);
  const isAdvanced = features.analytics === 'advanced';

  const { rows: user } = await db.query(
    `SELECT handle, display_name, followers_count, following_count,
            posts_count, verified, premium_tier, created_at
     FROM users WHERE id = $1`,
    [userId]
  );

  const { rows: followerGrowth } = await db.query(
    `SELECT DATE(created_at) AS date, COUNT(*) AS new_followers
     FROM follows
     WHERE following_id = $1
       AND created_at >= NOW() - INTERVAL '30 days'
     GROUP BY DATE(created_at)
     ORDER BY date ASC`,
    [userId]
  );

  const { rows: recentFollowers } = await db.query(
    `SELECT u.id, u.handle, u.display_name, u.avatar_url, u.verified, f.created_at
     FROM follows f JOIN users u ON u.id = f.follower_id
     WHERE f.following_id = $1
     ORDER BY f.created_at DESC
     LIMIT 10`,
    [userId]
  );

  const { rows: visits } = await db.query(
    `SELECT COALESCE(SUM(views_count), 0) AS total_profile_views
     FROM posts WHERE user_id = $1 AND is_published = TRUE`,
    [userId]
  );

  R.ok(res, {
    profile:             user[0],
    follower_growth:     followerGrowth,
    recent_followers:    recentFollowers,
    total_profile_views: visits[0]?.total_profile_views || 0,
    ...(!isAdvanced && { upgrade_message: 'Upgrade to Plus for detailed follower demographics and growth trends.' }),
  });
};

// ─── Top hashtags used by creator ────────────────────────────────────────────
export const getHashtagAnalytics = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const { features }   = await getTierFeatures(userId);
  const isAdvanced     = features.analytics === 'advanced';
  const window         = isAdvanced ? 90 : 30;

  const { rows } = await db.query(
    `SELECT h.name, COUNT(ph.post_id) AS usage_count,
            SUM(p.views_count) AS total_impressions,
            SUM(p.likes_count) AS total_likes
     FROM post_hashtags ph
     JOIN hashtags h ON h.id = ph.hashtag_id
     JOIN posts p ON p.id = ph.post_id
     WHERE p.user_id = $1 AND p.is_published = TRUE
       AND p.created_at >= NOW() - ($2 || ' days')::INTERVAL
     GROUP BY h.name
     ORDER BY total_impressions DESC
     LIMIT 10`,
    [userId, window]
  );

  R.ok(res, { window_days: window, hashtags: rows });
};

// ─── Hashtag velocity history (Pro+ only — beyond 7 days) ────────────────────
export const getHashtagVelocityHistory = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const { tier, features } = await getTierFeatures(userId);
  const isPro = ['pro', 'enterprise'].includes(tier);

  if (!isPro) {
    return R.forbidden(res, 'Hashtag velocity history beyond 7 days requires a Pro or Enterprise subscription. Upgrade at /premium.');
  }

  const { hashtag } = req.params;
  const days = Math.min(Number(req.query.days) || 30, 365);

  const { rows } = await db.query(
    `SELECT region, post_count, recorded_at
     FROM hashtag_velocity_history
     WHERE hashtag = $1
       AND recorded_at >= NOW() - ($2 || ' days')::INTERVAL
     ORDER BY recorded_at ASC`,
    [hashtag, days]
  );

  // Also get current 7-day live stats for comparison
  const { rows: live } = await db.query(
    `SELECT
       COUNT(*) AS total_posts,
       COUNT(DISTINCT p.user_id) AS unique_authors,
       SUM(p.likes_count) AS total_likes
     FROM post_hashtags ph
     JOIN hashtags h ON h.id = ph.hashtag_id
     JOIN posts p ON p.id = ph.post_id
     WHERE h.name = $1
       AND p.created_at >= NOW() - INTERVAL '7 days'
       AND p.is_published = TRUE`,
    [hashtag]
  );

  R.ok(res, {
    hashtag,
    days_requested:  days,
    history:         rows,
    current_7d_live: live[0],
    note:            rows.length === 0 ? 'No historical snapshots recorded yet. History builds as the cron job runs hourly.' : null,
  });
};

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
