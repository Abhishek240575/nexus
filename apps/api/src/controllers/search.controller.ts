import { Request, Response } from 'express';
import { db } from '../config/db';
import * as R from '../utils/response';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY?.trim() });

export const search = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user?.id || null;
  const query  = (req.query.q as string || '').trim();
  const type   = (req.query.type as string) || 'all'; // all, posts, users, hashtags
  const limit  = Math.min(Number(req.query.limit) || 20, 50);

  if (!query || query.length < 2) { R.badRequest(res, 'Search query too short'); return; }

  // Expand query with AI for semantic search
  let expandedTerms = [query];
  try {
    const aiRes = await client.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 100,
      messages: [{
        role: 'user',
        content: `For the search query "${query}", provide 3-5 related search terms or synonyms that would help find relevant content on an Indian civic discourse platform. Return ONLY a JSON array of strings, no explanation. Example: ["term1","term2","term3"]`,
      }],
    });
    const text = aiRes.content[0].type === 'text' ? aiRes.content[0].text : '[]';
    const terms = JSON.parse(text.replace(/```json|```/g, '').trim());
    if (Array.isArray(terms)) expandedTerms = [query, ...terms.slice(0, 3)];
  } catch { /* use original query */ }

  const tsQuery = expandedTerms.map(t => t.split(' ').join(' & ')).join(' | ');

  const [postsResult, usersResult, hashtagsResult] = await Promise.all([
    type === 'users' || type === 'hashtags' ? { rows: [] } :
    db.query(
      `SELECT p.*, u.handle AS author_handle, u.display_name AS author_name,
              u.avatar_url AS author_avatar, u.verified AS author_verified,
              ts_rank(p.search_vector, to_tsquery('english', $2)) AS rank
       FROM posts p JOIN users u ON u.id = p.user_id
       WHERE p.is_published = TRUE AND u.suspended = FALSE
         AND p.reply_to_id IS NULL
         AND (p.search_vector @@ to_tsquery('english', $2)
              OR p.content ILIKE '%' || $1 || '%')
       ORDER BY rank DESC, p.created_at DESC
       LIMIT $3`,
      [query, tsQuery, limit]
    ),

    type === 'posts' || type === 'hashtags' ? { rows: [] } :
    db.query(
      `SELECT id, handle, display_name, avatar_url, verified, premium_tier,
              bio, followers_count, is_journalist,
              similarity(handle, $1) + similarity(COALESCE(display_name,''), $1) AS rank
       FROM users
       WHERE suspended = FALSE AND is_deleted = FALSE
         AND (handle ILIKE '%' || $1 || '%' OR display_name ILIKE '%' || $1 || '%')
       ORDER BY rank DESC, followers_count DESC
       LIMIT $2`,
      [query, Math.min(limit, 10)]
    ),

    type === 'posts' || type === 'users' ? { rows: [] } :
    db.query(
      `SELECT '#' || tag AS hashtag, COUNT(*) AS post_count
       FROM (
         SELECT unnest(regexp_matches(content, '#([a-zA-Z0-9_]+)', 'g')) AS tag
         FROM posts WHERE is_published = TRUE AND created_at > NOW() - INTERVAL '7 days'
       ) t
       WHERE tag ILIKE '%' || $1 || '%'
       GROUP BY tag ORDER BY post_count DESC LIMIT 10`,
      [query]
    ),
  ]);

  R.ok(res, {
    query,
    expanded_terms: expandedTerms,
    posts:     postsResult.rows,
    users:     usersResult.rows,
    hashtags:  hashtagsResult.rows,
  });
};
