import { getPersonalizedFeed } from '../services/feed.service';
import { Request, Response } from 'express';
import { db }    from '../config/db';
import { redis } from '../config/redis';
import * as R    from '../utils/response';
import { AuthenticatedRequest } from '../types';
import { moderateContent, detectLanguage } from '../services/moderation.service';
import { preFilterContent }               from '../services/profanity.filter';

const extractHashtags = (content: string): string[] => {
  const matches = content.match(/#([a-zA-Z0-9_]+)/g) || [];
  return [...new Set(matches.map(t => t.slice(1).toLowerCase()))];
};

const linkHashtags = async (postId: string, tags: string[]): Promise<void> => {
  for (const tag of tags) {
    const { rows } = await db.query(
      `INSERT INTO hashtags (name) VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [tag]
    );
    await db.query(
      `INSERT INTO post_hashtags (post_id, hashtag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [postId, rows[0].id]
    );
  }
};

const createNotification = async (data: {
  user_id: string; type: string; actor_id: string; post_id?: string;
}): Promise<void> => {
  if (data.user_id === data.actor_id) return;
  await db.query(
    `INSERT INTO notifications (user_id, type, actor_id, post_id) VALUES ($1, $2, $3, $4)`,
    [data.user_id, data.type, data.actor_id, data.post_id || null]
  );
};

export const createPost = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const { content, media_urls = [], reply_to_id, quote_of_id, community_id, scheduled_at, language, is_exclusive } = req.body;

  if (!content && (!media_urls || media_urls.length === 0)) {
    R.badRequest(res, 'Post must have content or media'); return;
  }

  // â”€â”€â”€ Tier-based character limit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const { rows: tierRow } = await db.query(
    `SELECT u.premium_tier, t.max_post_length, t.features
     FROM users u LEFT JOIN subscription_tiers t ON t.id = u.premium_tier
     WHERE u.id = $1`,
    [userId]
  );
  const maxLength     = tierRow[0]?.max_post_length || 280;
  const tierFeatures  = tierRow[0]?.features || {};
  const priorityBoost = tierFeatures.priority_visibility ? 50 : 0;

  if (content && content.length > maxLength) {
    R.badRequest(res, `Post exceeds ${maxLength} character limit for your plan. Upgrade to Plus for longer posts.`); return;
  }

  if (reply_to_id) {
    const { rows } = await db.query('SELECT id, user_id FROM posts WHERE id = $1', [reply_to_id]);
    if (!rows[0]) { R.notFound(res, 'Post you are replying to not found'); return; }
  }

  if (quote_of_id) {
    const { rows } = await db.query('SELECT id FROM posts WHERE id = $1', [quote_of_id]);
    if (!rows[0]) { R.notFound(res, 'Post you are quoting not found'); return; }
  }

  // â”€â”€â”€ Fast profanity pre-filter (runs before DB write) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (content) {
    const preFilter = preFilterContent(content);
    if (preFilter.blocked) {
      R.badRequest(res, preFilter.reason || 'Post violates community guidelines.');
      return;
    }
  }

  const { rows } = await db.query(
    `INSERT INTO posts (user_id, content, media_urls, reply_to_id, quote_of_id, community_id, scheduled_at, is_published, priority_boost, language, is_exclusive)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [userId, content || null, media_urls, reply_to_id || null, quote_of_id || null, community_id || null, scheduled_at || null, !scheduled_at, priorityBoost, language || null, is_exclusive || false]
  );

  const post = rows[0];

  // â”€â”€â”€ AI Content Moderation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (content && process.env.ANTHROPIC_API_KEY) {
    try {
      const language   = await detectLanguage(content);
      const modResult  = await moderateContent(content, language);

      if (modResult.decision === 'BLOCK') {
        // Delete the post immediately
        await db.query('DELETE FROM posts WHERE id = $1', [post.id]);
        R.badRequest(res, `Post blocked: ${modResult.reason}. ${modResult.suggestion || ''}`);
        return;
      }

      if (modResult.decision === 'FLAG') {
        // Hold for human review â€” unpublish
        await db.query('UPDATE posts SET is_published = FALSE WHERE id = $1', [post.id]);
        // Add to moderation queue
        await db.query(
          `INSERT INTO moderation_queue (post_id, ai_decision, ai_reason, ai_categories, ai_confidence)
           VALUES ($1, $2, $3, $4, $5)`,
          [post.id, modResult.decision, modResult.reason, modResult.categories, modResult.confidence]
        );
        R.created(res, { ...post, moderation_status: 'under_review', message: 'Your post is under review and will be published once approved.' });
        return;
      }

      if (modResult.decision === 'WARN') {
        // Publish with content warning
        await db.query('UPDATE posts SET has_warning = TRUE, warning_reason = $1 WHERE id = $2', [modResult.reason, post.id]);
        post.has_warning     = true;
        post.warning_reason  = modResult.reason;
      }

      // Store language
      await db.query('UPDATE posts SET language = $1 WHERE id = $2', [language, post.id]);
      post.language = language;

    } catch (err) {
      console.error('[Moderation] Failed:', err);
      // Continue publishing if moderation fails
    }
  }
  await db.query('UPDATE users SET posts_count = posts_count + 1 WHERE id = $1', [userId]);

  if (content) {
    const tags = extractHashtags(content);
    if (tags.length > 0) await linkHashtags(post.id, tags);
  }

  // Notify post owner of reply
  if (reply_to_id) {
    const { rows: parent } = await db.query('SELECT user_id FROM posts WHERE id = $1', [reply_to_id]);
    if (parent[0]) await createNotification({ user_id: parent[0].user_id, type: 'reply', actor_id: userId, post_id: reply_to_id });
  }

  await redis.del(`feed:${userId}`);

  const { rows: enriched } = await db.query(
    `SELECT p.*, u.handle AS author_handle, u.display_name AS author_name,
            u.avatar_url AS author_avatar, u.verified AS author_verified,
            u.premium_tier AS author_tier,
            u.is_journalist AS author_is_journalist,
            p.is_exclusive
     FROM posts p JOIN users u ON u.id = p.user_id WHERE p.id = $1`,
    [post.id]
  );

  R.created(res, enriched[0]);
};

export const getPost = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const userId = (req as any).user?.id || null;

  const { rows } = await db.query(
    `SELECT p.*,
            u.handle AS author_handle, u.display_name AS author_name,
            u.avatar_url AS author_avatar, u.verified AS author_verified,
            u.premium_tier AS author_tier,
            u.is_journalist AS author_is_journalist,
            p.is_exclusive,
            EXISTS(SELECT 1 FROM likes     WHERE user_id = $2::uuid AND post_id = p.id) AS is_liked,
            EXISTS(SELECT 1 FROM reposts   WHERE user_id = $2::uuid AND post_id = p.id) AS is_reposted,
            EXISTS(SELECT 1 FROM bookmarks WHERE user_id = $2::uuid AND post_id = p.id) AS is_bookmarked
     FROM posts p JOIN users u ON u.id = p.user_id
     WHERE p.id = $1 AND p.is_published = TRUE`,
    [id, userId]
  );

  if (!rows[0]) { R.notFound(res, 'Post not found'); return; }
  await db.query('UPDATE posts SET views_count = views_count + 1 WHERE id = $1', [id]);
  R.ok(res, rows[0]);
};

export const deletePost = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const { id } = req.params;

  const { rows } = await db.query('SELECT user_id FROM posts WHERE id = $1', [id]);
  if (!rows[0]) { R.notFound(res, 'Post not found'); return; }
  if (rows[0].user_id !== userId) { R.forbidden(res, 'Not your post'); return; }

  await db.query('DELETE FROM posts WHERE id = $1', [id]);
  await db.query('UPDATE users SET posts_count = GREATEST(posts_count - 1, 0) WHERE id = $1', [userId]);
  R.noContent(res);
};

export const getReplies = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const userId = (req as any).user?.id || null;
  const limit  = Math.min(Number(req.query.limit) || 20, 50);
  const cursor = (req.query.cursor as string) || null;

  const { rows } = await db.query(
    `SELECT p.*,
            u.handle AS author_handle, u.display_name AS author_name,
            u.avatar_url AS author_avatar, u.verified AS author_verified,
            u.premium_tier AS author_tier,
            u.is_journalist AS author_is_journalist,
            p.is_exclusive,
            EXISTS(SELECT 1 FROM likes   WHERE user_id = $4::uuid AND post_id = p.id) AS is_liked,
            EXISTS(SELECT 1 FROM reposts WHERE user_id = $4::uuid AND post_id = p.id) AS is_reposted
     FROM posts p JOIN users u ON u.id = p.user_id
     WHERE p.reply_to_id = $1
       AND p.is_published = TRUE
       AND ($3::timestamptz IS NULL OR p.created_at < $3::timestamptz)
     ORDER BY p.created_at ASC
     LIMIT $2`,
    [id, limit, cursor, userId]
  );

  R.ok(res, {
    data:        rows,
    next_cursor: rows.length === limit ? rows[rows.length - 1].created_at : null,
    has_more:    rows.length === limit,
  });
};

export const getHomeFeed = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const limit  = Math.min(Number(req.query.limit) || 20, 50);
  const cursor = (req.query.cursor as string) || null;

  const { rows } = await db.query(
    `SELECT p.*,
            u.handle AS author_handle, u.display_name AS author_name,
            u.avatar_url AS author_avatar, u.verified AS author_verified,
            u.premium_tier AS author_tier,
            u.is_journalist AS author_is_journalist,
            p.is_exclusive,
            EXISTS(SELECT 1 FROM likes     WHERE user_id = $1::uuid AND post_id = p.id) AS is_liked,
            EXISTS(SELECT 1 FROM reposts   WHERE user_id = $1::uuid AND post_id = p.id) AS is_reposted,
            EXISTS(SELECT 1 FROM bookmarks WHERE user_id = $1::uuid AND post_id = p.id) AS is_bookmarked
     FROM posts p JOIN users u ON u.id = p.user_id
     WHERE (p.user_id = $1 OR p.user_id IN (SELECT following_id FROM follows WHERE follower_id = $1))
       AND p.is_published = TRUE AND p.reply_to_id IS NULL AND u.suspended = FALSE
       AND ($3::timestamptz IS NULL OR p.created_at < $3::timestamptz)
     ORDER BY p.created_at DESC
     LIMIT $2`,
    [userId, limit, cursor]
  );

  R.ok(res, {
    data:        rows,
    next_cursor: rows.length === limit ? rows[rows.length - 1].created_at : null,
    has_more:    rows.length === limit,
  });
};

export const getExploreFeed = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user?.id || null;
  const limit  = Math.min(Number(req.query.limit) || 20, 50);
  const cursor = (req.query.cursor as string) || null;

  const { rows } = await db.query(
    `SELECT p.*,
            u.handle AS author_handle, u.display_name AS author_name,
            u.avatar_url AS author_avatar, u.verified AS author_verified,
            u.premium_tier AS author_tier,
            u.is_journalist AS author_is_journalist,
            p.is_exclusive,
            EXISTS(SELECT 1 FROM likes   WHERE user_id = $1::uuid AND post_id = p.id) AS is_liked,
            EXISTS(SELECT 1 FROM reposts WHERE user_id = $1::uuid AND post_id = p.id) AS is_reposted
     FROM posts p JOIN users u ON u.id = p.user_id
     WHERE p.is_published = TRUE AND p.reply_to_id IS NULL AND u.suspended = FALSE
       AND p.created_at > NOW() - INTERVAL '7 days'
       AND ($2::timestamptz IS NULL OR p.created_at < $2::timestamptz)
     ORDER BY p.created_at DESC, (p.priority_boost + p.likes_count + p.reposts_count * 2 + p.replies_count) DESC
     LIMIT $3`,
    [userId, cursor, limit]
  );

  R.ok(res, {
    data:        rows,
    next_cursor: rows.length === limit ? rows[rows.length - 1].created_at : null,
    has_more:    rows.length === limit,
  });
};

export const likePost = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const { id: postId } = req.params;

  const existing = await db.query(
    'SELECT id FROM likes WHERE user_id = $1 AND post_id = $2',
    [userId, postId]
  );

  if (existing.rows[0]) {
    await db.query('DELETE FROM likes WHERE user_id = $1 AND post_id = $2', [userId, postId]);
    const { rows } = await db.query('SELECT likes_count FROM posts WHERE id = $1', [postId]);
    R.ok(res, { liked: false, likes_count: rows[0]?.likes_count ?? 0 });
  } else {
    await db.query(
      'INSERT INTO likes (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, postId]
    );
    const { rows } = await db.query('SELECT likes_count, user_id FROM posts WHERE id = $1', [postId]);
    if (rows[0]) {
      await createNotification({ user_id: rows[0].user_id, type: 'like', actor_id: userId, post_id: postId });
    }
    R.ok(res, { liked: true, likes_count: rows[0]?.likes_count ?? 0 });
  }
};

export const repostPost = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const { id: postId } = req.params;

  const existing = await db.query(
    'SELECT id FROM reposts WHERE user_id = $1 AND post_id = $2',
    [userId, postId]
  );

  if (existing.rows[0]) {
    await db.query('DELETE FROM reposts WHERE user_id = $1 AND post_id = $2', [userId, postId]);
    const { rows } = await db.query('SELECT reposts_count FROM posts WHERE id = $1', [postId]);
    R.ok(res, { reposted: false, reposts_count: rows[0]?.reposts_count ?? 0 });
  } else {
    await db.query(
      'INSERT INTO reposts (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, postId]
    );
    const { rows } = await db.query('SELECT reposts_count, user_id FROM posts WHERE id = $1', [postId]);
    if (rows[0]) {
      await createNotification({ user_id: rows[0].user_id, type: 'repost', actor_id: userId, post_id: postId });
    }
    R.ok(res, { reposted: true, reposts_count: rows[0]?.reposts_count ?? 0 });
  }
};

export const bookmarkPost = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const { id: postId } = req.params;

  const existing = await db.query(
    'SELECT id FROM bookmarks WHERE user_id = $1 AND post_id = $2',
    [userId, postId]
  );

  if (existing.rows[0]) {
    await db.query('DELETE FROM bookmarks WHERE user_id = $1 AND post_id = $2', [userId, postId]);
    R.ok(res, { bookmarked: false });
  } else {
    await db.query(
      'INSERT INTO bookmarks (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, postId]
    );
    R.ok(res, { bookmarked: true });
  }
};

export const getBookmarks = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const limit  = Math.min(Number(req.query.limit) || 20, 50);
  const cursor = (req.query.cursor as string) || null;

  const { rows } = await db.query(
    `SELECT p.*, b.created_at AS bookmarked_at,
            u.handle AS author_handle, u.display_name AS author_name,
            u.avatar_url AS author_avatar, u.verified AS author_verified,
            u.premium_tier AS author_tier,
            u.is_journalist AS author_is_journalist,
            p.is_exclusive,
            TRUE AS is_bookmarked,
            EXISTS(SELECT 1 FROM likes   WHERE user_id = $1::uuid AND post_id = p.id) AS is_liked,
            EXISTS(SELECT 1 FROM reposts WHERE user_id = $1::uuid AND post_id = p.id) AS is_reposted
     FROM bookmarks b
     JOIN posts p ON p.id = b.post_id
     JOIN users u ON u.id = p.user_id
     WHERE b.user_id = $1
       AND ($3::timestamptz IS NULL OR b.created_at < $3::timestamptz)
     ORDER BY b.created_at DESC
     LIMIT $2`,
    [userId, limit, cursor]
  );

  R.ok(res, {
    data:        rows,
    next_cursor: rows.length === limit ? rows[rows.length - 1].bookmarked_at : null,
    has_more:    rows.length === limit,
  });
};

export const getTrending = async (_req: Request, res: Response): Promise<void> => {
  const cached = await redis.get('trending:hashtags');
  if (cached) { R.ok(res, JSON.parse(cached)); return; }

  const { rows } = await db.query(
    `SELECT h.id, h.name, COUNT(ph.post_id) AS recent_posts
     FROM hashtags h
     JOIN post_hashtags ph ON ph.hashtag_id = h.id
     JOIN posts p ON p.id = ph.post_id
     WHERE p.created_at >= NOW() - INTERVAL '24 hours' AND p.is_published = TRUE
     GROUP BY h.id, h.name
     ORDER BY recent_posts DESC
     LIMIT 10`
  );

  await redis.setex('trending:hashtags', 180, JSON.stringify(rows));
  R.ok(res, rows);
};

export const getPostsByHashtag = async (req: Request, res: Response): Promise<void> => {
  const { tag }  = req.params;
  const userId   = (req as any).user?.id || null;
  const limit    = Math.min(Number(req.query.limit) || 20, 50);
  const cursor   = (req.query.cursor as string) || null;

  const { rows } = await db.query(
    `SELECT p.*,
            u.handle AS author_handle, u.display_name AS author_name,
            u.avatar_url AS author_avatar, u.verified AS author_verified,
            u.premium_tier AS author_tier,
            u.is_journalist AS author_is_journalist,
            p.is_exclusive,
            EXISTS(SELECT 1 FROM likes   WHERE user_id = $4::uuid AND post_id = p.id) AS is_liked,
            EXISTS(SELECT 1 FROM reposts WHERE user_id = $4::uuid AND post_id = p.id) AS is_reposted
     FROM posts p
     JOIN users u ON u.id = p.user_id
     JOIN post_hashtags ph ON ph.post_id = p.id
     JOIN hashtags h ON h.id = ph.hashtag_id
     WHERE h.name = $1 AND p.is_published = TRUE AND u.suspended = FALSE
       AND ($3::timestamptz IS NULL OR p.created_at < $3::timestamptz)
     ORDER BY p.created_at DESC
     LIMIT $2`,
    [tag, limit, cursor, userId]
  );

  R.ok(res, {
    data:        rows,
    next_cursor: rows.length === limit ? rows[rows.length - 1].created_at : null,
    has_more:    rows.length === limit,
  });
};
