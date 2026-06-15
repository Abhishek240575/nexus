import { Request, Response } from 'express';
import { db }  from '../config/db';
import * as R  from '../utils/response';
import { translateText, detectLanguage, SUPPORTED_LANGUAGES } from '../services/translation.service';

// ─── Get supported languages ──────────────────────────────────────────────────
export const getLanguages = async (_req: Request, res: Response): Promise<void> => {
  R.ok(res, SUPPORTED_LANGUAGES);
};

// ─── Translate a post ─────────────────────────────────────────────────────────
export const translatePost = async (req: Request, res: Response): Promise<void> => {
  const { postId }    = req.params;
  const { target }    = req.query as { target: string };

  if (!target) { R.badRequest(res, 'target language required'); return; }

  // Get post content
  const { rows } = await db.query(
    'SELECT id, content, language FROM posts WHERE id = $1 AND is_published = TRUE',
    [postId]
  );

  if (!rows[0]) { R.notFound(res, 'Post not found'); return; }
  const post = rows[0];

  if (!post.content) { R.badRequest(res, 'Post has no text content'); return; }

  // Check cache in Redis (handled at API level for simplicity)
  const cacheKey = `translation:${postId}:${target}`;

  try {
    const { redis } = await import('../config/redis');
    const cached = await redis.get(cacheKey);
    if (cached) {
      R.ok(res, { translated: cached, target, source: post.language || 'unknown', cached: true });
      return;
    }
  } catch { /* skip cache if Redis fails */ }

  // Detect source language if not stored
  const sourceLang = post.language || (await detectLanguage(post.content)).code;

  // Translate
  const translated = await translateText(post.content, target, sourceLang);

  // Cache for 24 hours
  try {
    const { redis } = await import('../config/redis');
    await redis.setex(cacheKey, 86400, translated);
  } catch { /* skip */ }

  // Update post language if not set
  if (!post.language) {
    await db.query('UPDATE posts SET language = $1 WHERE id = $2', [sourceLang, postId]);
  }

  R.ok(res, {
    translated,
    target,
    source:  sourceLang,
    cached:  false,
  });
};

// ─── Detect language of arbitrary text ───────────────────────────────────────
export const detect = async (req: Request, res: Response): Promise<void> => {
  const { text } = req.body;
  if (!text) { R.badRequest(res, 'text required'); return; }

  const result = await detectLanguage(text);
  R.ok(res, result);
};
