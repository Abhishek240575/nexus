import Anthropic from '@anthropic-ai/sdk';
import { db }    from '../config/db';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY?.trim() });

export interface UserProfile {
  interests:       string[];
  preferred_langs: string[];
  following_count: number;
  top_hashtags:    string[];
}

// ─── Score a batch of posts for a user using Claude ───────────────────────────
export const scorePostsForUser = async (
  posts:   any[],
  profile: UserProfile
): Promise<Map<string, number>> => {
  if (!posts.length) return new Map();

  const postSummaries = posts.map(p => ({
    id:       p.id,
    content:  (p.content || '').slice(0, 200),
    lang:     p.language || 'en',
    likes:    p.likes_count || 0,
    reposts:  p.reposts_count || 0,
    hashtags: (p.content || '').match(/#\w+/g) || [],
    is_journalist: p.author_is_journalist || false,
  }));

  try {
    const response = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 1000,
      messages:   [{
        role:    'user',
        content: `You are a feed ranking algorithm for Deemona, an Indian civic discourse platform.

User profile:
- Interests: ${profile.interests.join(', ') || 'general'}
- Preferred languages: ${profile.preferred_langs.join(', ')}
- Top hashtags they engage with: ${profile.top_hashtags.join(', ') || 'none'}

Score each post from 0-100 based on:
- Relevance to user interests (40 points)
- Language match (20 points)
- Content quality and engagement signals (20 points)
- Diversity/novelty (20 points)

Posts to score:
${JSON.stringify(postSummaries, null, 2)}

Respond ONLY with a JSON object mapping post ID to score, like:
{"post_id_1": 85, "post_id_2": 42}`,
      }],
    });

    const text  = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    const scores = JSON.parse(clean);
    return new Map(Object.entries(scores).map(([k, v]) => [k, Number(v)]));
  } catch {
    // Fallback: return neutral scores
    return new Map(posts.map(p => [p.id, 50]));
  }
};

// ─── Get user profile for personalization ─────────────────────────────────────
export const getUserFeedProfile = async (userId: string): Promise<UserProfile> => {
  const { rows: user } = await db.query(
    `SELECT interests, preferred_langs FROM users WHERE id = $1`, [userId]
  );

  // Get top hashtags from recent likes/reposts
  const { rows: hashtags } = await db.query(
    `SELECT unnest(regexp_matches(p.content, '#[a-zA-Z0-9_]+', 'g')) AS tag, COUNT(*) AS cnt
     FROM likes l JOIN posts p ON p.id = l.post_id
     WHERE l.user_id = $1 AND l.created_at > NOW() - INTERVAL '30 days'
     GROUP BY tag ORDER BY cnt DESC LIMIT 10`,
    [userId]
  ).catch(() => ({ rows: [] }));

  const { rows: followCount } = await db.query(
    `SELECT COUNT(*) AS cnt FROM follows WHERE follower_id = $1`, [userId]
  );

  return {
    interests:       user[0]?.interests || [],
    preferred_langs: user[0]?.preferred_langs || ['en'],
    following_count: Number(followCount[0]?.cnt || 0),
    top_hashtags:    hashtags.map((h: any) => h.tag),
  };
};

// ─── Personalized For You feed (mixes following + discovery) ──────────────────
export const getPersonalizedFeed = async (
  userId: string,
  limit:  number,
  cursor: string | null
): Promise<any[]> => {
  // Get candidate posts: following + trending + interest-matched
  const { rows: candidates } = await db.query(
    `SELECT p.*,
            u.handle AS author_handle, u.display_name AS author_name,
            u.avatar_url AS author_avatar, u.verified AS author_verified,
            u.premium_tier AS author_tier,
            u.is_journalist AS author_is_journalist,
            p.is_exclusive,
            EXISTS(SELECT 1 FROM likes     WHERE user_id = $1::uuid AND post_id = p.id) AS is_liked,
            EXISTS(SELECT 1 FROM reposts   WHERE user_id = $1::uuid AND post_id = p.id) AS is_reposted,
            EXISTS(SELECT 1 FROM bookmarks WHERE user_id = $1::uuid AND post_id = p.id) AS is_bookmarked,
            -- Source scoring: following posts get base boost
            CASE WHEN p.user_id IN (SELECT following_id FROM follows WHERE follower_id = $1)
                 THEN 30 ELSE 0 END AS follow_boost,
            -- Engagement score
            (p.priority_boost + p.likes_count + p.reposts_count * 2 + p.replies_count) AS engagement_score
     FROM posts p JOIN users u ON u.id = p.user_id
     WHERE p.is_published = TRUE AND p.reply_to_id IS NULL AND u.suspended = FALSE
       AND p.created_at > NOW() - INTERVAL '48 hours'
       AND ($2::timestamptz IS NULL OR p.created_at < $2::timestamptz)
       AND p.user_id != $1
     ORDER BY (
       CASE WHEN p.user_id IN (SELECT following_id FROM follows WHERE follower_id = $1) THEN 30 ELSE 0 END +
       p.priority_boost + p.likes_count + p.reposts_count * 2
     ) DESC
     LIMIT $3`,
    [userId, cursor, limit * 3] // fetch 3x for AI reranking
  );

  if (!candidates.length) return [];

  // Get user profile
  const profile = await getUserFeedProfile(userId);

  // AI score the candidates
  const scores  = await scorePostsForUser(candidates, profile);

  // Combine AI score + engagement + follow boost
  const ranked = candidates.map(p => ({
    ...p,
    _final_score: (scores.get(p.id) || 50) +
                  (p.follow_boost || 0) +
                  Math.min(p.engagement_score || 0, 30), // cap engagement contribution
  })).sort((a, b) => b._final_score - a._final_score);

  return ranked.slice(0, limit);
};
