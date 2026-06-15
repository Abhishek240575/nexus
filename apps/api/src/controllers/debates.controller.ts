import { Request, Response } from 'express';
import { db }  from '../config/db';
import * as R  from '../utils/response';
import { AuthenticatedRequest } from '../types';

// ─── Get all debates ──────────────────────────────────────────────────────────
export const getDebates = async (req: Request, res: Response): Promise<void> => {
  const userId   = (req as any).user?.id || null;
  const category = (req.query.category as string) || null;
  const status   = (req.query.status as string) || 'open';
  const limit    = Math.min(Number(req.query.limit) || 20, 50);

  const { rows } = await db.query(
    `SELECT d.*,
            u.handle AS creator_handle, u.display_name AS creator_name,
            u.avatar_url AS creator_avatar, u.verified AS creator_verified,
            EXISTS(SELECT 1 FROM debate_votes WHERE debate_id = d.id AND user_id = $1::uuid) AS has_voted,
            (SELECT side FROM debate_votes WHERE debate_id = d.id AND user_id = $1::uuid) AS my_vote
     FROM debates d JOIN users u ON u.id = d.creator_id
     WHERE d.status = $2
       AND ($3::text IS NULL OR d.category = $3)
     ORDER BY d.created_at DESC
     LIMIT $4`,
    [userId, status, category, limit]
  );

  R.ok(res, rows);
};

// ─── Get single debate ────────────────────────────────────────────────────────
export const getDebate = async (req: Request, res: Response): Promise<void> => {
  const { id }  = req.params;
  const userId  = (req as any).user?.id || null;

  const { rows } = await db.query(
    `SELECT d.*,
            u.handle AS creator_handle, u.display_name AS creator_name,
            u.avatar_url AS creator_avatar, u.verified AS creator_verified,
            EXISTS(SELECT 1 FROM debate_votes WHERE debate_id = d.id AND user_id = $2::uuid) AS has_voted,
            (SELECT side FROM debate_votes WHERE debate_id = d.id AND user_id = $2::uuid) AS my_vote
     FROM debates d JOIN users u ON u.id = d.creator_id
     WHERE d.id = $1`,
    [id, userId]
  );

  if (!rows[0]) { R.notFound(res, 'Debate not found'); return; }
  R.ok(res, rows[0]);
};

// ─── Create debate ────────────────────────────────────────────────────────────
export const createDebate = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const { title, description, category = 'general', for_label = 'For', against_label = 'Against', closes_hours } = req.body;

  const closes_at = closes_hours
    ? new Date(Date.now() + closes_hours * 3600000)
    : null;

  const { rows } = await db.query(
    `INSERT INTO debates (creator_id, title, description, category, for_label, against_label, closes_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [userId, title, description || null, category, for_label, against_label, closes_at]
  );

  R.created(res, rows[0]);
};

// ─── Vote on debate ───────────────────────────────────────────────────────────
export const voteDebate = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const { id }         = req.params;
  const { side }       = req.body;

  const { rows: debate } = await db.query(
    'SELECT id, status FROM debates WHERE id = $1',
    [id]
  );
  if (!debate[0]) { R.notFound(res, 'Debate not found'); return; }
  if (debate[0].status !== 'open') { R.badRequest(res, 'Debate is closed'); return; }

  const existing = await db.query(
    'SELECT side FROM debate_votes WHERE debate_id = $1 AND user_id = $2',
    [id, userId]
  );

  if (existing.rows[0]) {
    if (existing.rows[0].side === side) {
      // Remove vote
      await db.query('DELETE FROM debate_votes WHERE debate_id = $1 AND user_id = $2', [id, userId]);
      R.ok(res, { voted: false, side: null });
    } else {
      // Switch side
      await db.query('DELETE FROM debate_votes WHERE debate_id = $1 AND user_id = $2', [id, userId]);
      await db.query('INSERT INTO debate_votes (debate_id, user_id, side) VALUES ($1, $2, $3)', [id, userId, side]);
      R.ok(res, { voted: true, side });
    }
  } else {
    await db.query('INSERT INTO debate_votes (debate_id, user_id, side) VALUES ($1, $2, $3)', [id, userId, side]);
    R.ok(res, { voted: true, side });
  }
};

// ─── Get arguments for a debate ───────────────────────────────────────────────
export const getArguments = async (req: Request, res: Response): Promise<void> => {
  const { id }   = req.params;
  const userId   = (req as any).user?.id || null;
  const side     = (req.query.side as string) || null;

  const { rows } = await db.query(
    `SELECT da.*,
            u.handle AS author_handle, u.display_name AS author_name,
            u.avatar_url AS author_avatar, u.verified AS author_verified,
            EXISTS(SELECT 1 FROM debate_argument_likes WHERE argument_id = da.id AND user_id = $3::uuid) AS is_liked
     FROM debate_arguments da JOIN users u ON u.id = da.user_id
     WHERE da.debate_id = $1
       AND ($2::text IS NULL OR da.side = $2)
     ORDER BY da.likes_count DESC, da.created_at ASC`,
    [id, side, userId]
  );

  R.ok(res, rows);
};

// ─── Add argument ─────────────────────────────────────────────────────────────
export const addArgument = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const { id }         = req.params;
  const { content, side } = req.body;

  const { rows: debate } = await db.query(
    'SELECT id, status FROM debates WHERE id = $1',
    [id]
  );
  if (!debate[0]) { R.notFound(res, 'Debate not found'); return; }
  if (debate[0].status !== 'open') { R.badRequest(res, 'Debate is closed'); return; }

  const { rows } = await db.query(
    `INSERT INTO debate_arguments (debate_id, user_id, side, content)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [id, userId, side, content]
  );

  // Fetch with author info
  const { rows: enriched } = await db.query(
    `SELECT da.*, u.handle AS author_handle, u.display_name AS author_name,
            u.avatar_url AS author_avatar, u.verified AS author_verified
     FROM debate_arguments da JOIN users u ON u.id = da.user_id
     WHERE da.id = $1`,
    [rows[0].id]
  );

  R.created(res, enriched[0]);
};

// ─── Like an argument ─────────────────────────────────────────────────────────
export const likeArgument = async (req: Request, res: Response): Promise<void> => {
  const { id: userId }  = (req as AuthenticatedRequest).user;
  const { argumentId }  = req.params;

  const existing = await db.query(
    'SELECT 1 FROM debate_argument_likes WHERE argument_id = $1 AND user_id = $2',
    [argumentId, userId]
  );

  if (existing.rows[0]) {
    await db.query('DELETE FROM debate_argument_likes WHERE argument_id = $1 AND user_id = $2', [argumentId, userId]);
    R.ok(res, { liked: false });
  } else {
    await db.query('INSERT INTO debate_argument_likes (argument_id, user_id) VALUES ($1, $2)', [argumentId, userId]);
    R.ok(res, { liked: true });
  }
};

// ─── Close debate (creator only) ─────────────────────────────────────────────
export const closeDebate = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const { id }         = req.params;

  const { rows } = await db.query(
    'SELECT creator_id FROM debates WHERE id = $1',
    [id]
  );
  if (!rows[0]) { R.notFound(res, 'Debate not found'); return; }
  if (rows[0].creator_id !== userId) { R.forbidden(res, 'Not your debate'); return; }

  await db.query('UPDATE debates SET status = $1 WHERE id = $2', ['closed', id]);
  R.ok(res, null, 'Debate closed');
};
