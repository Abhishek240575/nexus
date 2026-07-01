import { Request, Response } from 'express';
import { db } from '../config/db';
import * as R from '../utils/response';

interface AuthReq extends Request { user: { id: string; handle: string } }

export const getStories = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user?.id || null;
  const { rows } = await db.query(
    `SELECT
       u.id AS user_id, u.handle, u.display_name, u.avatar_url, u.verified,
       json_agg(json_build_object(
         'id', s.id, 'media_url', s.media_url, 'media_type', s.media_type,
         'caption', s.caption, 'bg_color', s.bg_color,
         'duration_sec', s.duration_sec, 'view_count', s.view_count,
         'created_at', s.created_at, 'expires_at', s.expires_at,
         'viewed', CASE WHEN sv.viewer_id IS NOT NULL THEN TRUE ELSE FALSE END
       ) ORDER BY s.created_at ASC) AS stories,
       COUNT(s.id) AS story_count,
       -- Has unviewed stories?
       BOOL_OR(sv.viewer_id IS NULL) AS has_unseen
     FROM stories s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN story_views sv ON sv.story_id = s.id AND sv.viewer_id = $1::uuid
     WHERE s.expires_at > NOW() AND u.suspended = FALSE
       AND (u.id = $1 OR u.id IN (SELECT following_id FROM follows WHERE follower_id = $1::uuid))
     GROUP BY u.id, u.handle, u.display_name, u.avatar_url, u.verified
     ORDER BY has_unseen DESC, MAX(s.created_at) DESC`,
    [userId]
  );
  R.ok(res, rows);
};

export const createStory = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthReq).user;
  const { media_url, media_type = 'image', caption, bg_color, duration_sec = 5 } = req.body;

  if (!media_url) { R.badRequest(res, 'media_url required'); return; }

  const { rows } = await db.query(
    `INSERT INTO stories (user_id, media_url, media_type, caption, bg_color, duration_sec)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [userId, media_url, media_type, caption || null, bg_color || '#1d9bf0', Math.min(duration_sec, 15)]
  );
  R.created(res, rows[0]);
};

export const viewStory = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthReq).user;
  const { storyId } = req.params;

  await db.query(
    `INSERT INTO story_views (story_id, viewer_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [storyId, userId]
  );
  await db.query(
    `UPDATE stories SET view_count = view_count + 1 WHERE id = $1 AND user_id != $2`,
    [storyId, userId]
  );
  R.ok(res, { viewed: true });
};

export const getStoryViewers = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthReq).user;
  const { storyId } = req.params;

  const { rows: story } = await db.query('SELECT user_id FROM stories WHERE id = $1', [storyId]);
  if (!story[0] || story[0].user_id !== userId) { R.forbidden(res, 'Not your story'); return; }

  const { rows } = await db.query(
    `SELECT u.handle, u.display_name, u.avatar_url, sv.viewed_at
     FROM story_views sv JOIN users u ON u.id = sv.viewer_id
     WHERE sv.story_id = $1 ORDER BY sv.viewed_at DESC`,
    [storyId]
  );
  R.ok(res, rows);
};

export const deleteStory = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthReq).user;
  const { storyId } = req.params;
  const { rows } = await db.query(
    `DELETE FROM stories WHERE id = $1 AND user_id = $2 RETURNING id`, [storyId, userId]
  );
  if (!rows[0]) { R.forbidden(res, 'Not your story'); return; }
  R.ok(res, { deleted: true });
};
