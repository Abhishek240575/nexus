import { Request, Response } from 'express';
import { db }  from '../config/db';
import * as R  from '../utils/response';
import { translateText, detectLanguage, autoTranslate, SUPPORTED_LANGUAGES } from '../services/translation.service';

// ─── Get all supported languages (grouped) ───────────────────────────────────
export const getLanguages = async (_req: Request, res: Response): Promise<void> => {
  const indian = SUPPORTED_LANGUAGES.filter(l => l.group === 'indian');
  const global = SUPPORTED_LANGUAGES.filter(l => l.group === 'global');
  R.ok(res, { all: SUPPORTED_LANGUAGES, indian, global });
};

// ─── Translate a post ─────────────────────────────────────────────────────────
export const translatePost = async (req: Request, res: Response): Promise<void> => {
  const { postId } = req.params;
  const { target } = req.query as { target: string };

  if (!target) { R.badRequest(res, 'target language code required (e.g. ?target=hi)'); return; }

  const supported = SUPPORTED_LANGUAGES.find(l => l.code === target);
  if (!supported) { R.badRequest(res, `Unsupported language: ${target}. Call /api/translate/languages for the full list.`); return; }

  const { rows } = await db.query(
    'SELECT id, content, language FROM posts WHERE id = $1 AND is_published = TRUE',
    [postId]
  );
  if (!rows[0]) { R.notFound(res, 'Post not found'); return; }
  const post = rows[0];
  if (!post.content) { R.badRequest(res, 'Post has no text content to translate'); return; }

  const cacheKey = `translation:${postId}:${target}`;

  // Check Redis cache
  try {
    const { redis } = await import('../config/redis');
    const cached = await redis.get(cacheKey);
    if (cached) {
      R.ok(res, { translated: cached, target, target_name: supported.name, source: post.language || 'unknown', cached: true });
      return;
    }
  } catch { /* skip if Redis unavailable */ }

  // Detect source if not stored
  const sourceLang = post.language || (await detectLanguage(post.content)).code;

  if (sourceLang === target) {
    R.ok(res, { translated: post.content, target, target_name: supported.name, source: sourceLang, cached: false, note: 'Already in target language' });
    return;
  }

  const translated = await translateText(post.content, target, sourceLang, 'civic');

  // Cache 24 hours
  try {
    const { redis } = await import('../config/redis');
    await redis.setex(cacheKey, 86400, translated);
  } catch { /* skip */ }

  // Store detected language on post
  if (!post.language) {
    await db.query('UPDATE posts SET language = $1 WHERE id = $2', [sourceLang, postId]).catch(() => {});
  }

  R.ok(res, { translated, target, target_name: supported.name, source: sourceLang, cached: false });
};

// ─── Auto-detect language of a post and store it ─────────────────────────────
export const detectPostLanguage = async (req: Request, res: Response): Promise<void> => {
  const { postId } = req.params;
  const { rows } = await db.query('SELECT id, content, language FROM posts WHERE id = $1', [postId]);
  if (!rows[0]) { R.notFound(res, 'Post not found'); return; }

  if (rows[0].language) {
    R.ok(res, { code: rows[0].language, cached: true });
    return;
  }

  if (!rows[0].content) { R.ok(res, { code: 'en', cached: false }); return; }

  const detected = await detectLanguage(rows[0].content);
  await db.query('UPDATE posts SET language = $1 WHERE id = $2', [detected.code, postId]).catch(() => {});
  R.ok(res, { ...detected, cached: false });
};

// ─── Translate arbitrary text (for composer live preview) ─────────────────────
export const translateText_ = async (req: Request, res: Response): Promise<void> => {
  const { text, target, source } = req.body;
  if (!text)   { R.badRequest(res, 'text required'); return; }
  if (!target) { R.badRequest(res, 'target language code required'); return; }

  const supported = SUPPORTED_LANGUAGES.find(l => l.code === target);
  if (!supported) { R.badRequest(res, `Unsupported language: ${target}`); return; }

  const translated = await translateText(text, target, source, 'civic');
  R.ok(res, { translated, target, target_name: supported.name, source: source || 'auto' });
};

// ─── Detect language of arbitrary text ───────────────────────────────────────
export const detect = async (req: Request, res: Response): Promise<void> => {
  const { text } = req.body;
  if (!text) { R.badRequest(res, 'text required'); return; }
  const result = await detectLanguage(text);
  R.ok(res, result);
};
