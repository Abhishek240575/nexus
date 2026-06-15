import { Request, Response } from 'express';
import { db }  from '../config/db';
import * as R  from '../utils/response';
import { AuthenticatedRequest } from '../types';

// ─── Helper: check if user is mod/owner of community ─────────────────────────
const isMod = async (communityId: string, userId: string): Promise<boolean> => {
  const { rows } = await db.query(
    `SELECT role FROM community_members
     WHERE community_id = $1 AND user_id = $2 AND role IN ('owner', 'moderator')`,
    [communityId, userId]
  );
  return rows.length > 0;
};

// ─── Get community rules ──────────────────────────────────────────────────────
export const getRules = async (req: Request, res: Response): Promise<void> => {
  const { slug } = req.params;
  const { rows: comm } = await db.query('SELECT id FROM communities WHERE slug = $1', [slug]);
  if (!comm[0]) { R.notFound(res, 'Community not found'); return; }

  const { rows } = await db.query(
    'SELECT * FROM community_rules WHERE community_id = $1 ORDER BY rule_number',
    [comm[0].id]
  );
  R.ok(res, rows);
};

// ─── Add community rule ───────────────────────────────────────────────────────
export const addRule = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const { slug }       = req.params;
  const { title, description } = req.body;

  const { rows: comm } = await db.query('SELECT id FROM communities WHERE slug = $1', [slug]);
  if (!comm[0]) { R.notFound(res, 'Community not found'); return; }
  if (!(await isMod(comm[0].id, userId))) { R.forbidden(res, 'Mod only'); return; }

  const { rows: existing } = await db.query(
    'SELECT COUNT(*) AS count FROM community_rules WHERE community_id = $1',
    [comm[0].id]
  );
  const ruleNumber = Number(existing[0].count) + 1;

  const { rows } = await db.query(
    `INSERT INTO community_rules (community_id, rule_number, title, description)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [comm[0].id, ruleNumber, title, description || null]
  );

  await db.query(
    'UPDATE communities SET rules_count = rules_count + 1 WHERE id = $1',
    [comm[0].id]
  );

  R.created(res, rows[0]);
};

// ─── Delete rule ──────────────────────────────────────────────────────────────
export const deleteRule = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const { slug, ruleId } = req.params;

  const { rows: comm } = await db.query('SELECT id FROM communities WHERE slug = $1', [slug]);
  if (!comm[0]) { R.notFound(res, 'Community not found'); return; }
  if (!(await isMod(comm[0].id, userId))) { R.forbidden(res, 'Mod only'); return; }

  await db.query('DELETE FROM community_rules WHERE id = $1 AND community_id = $2', [ruleId, comm[0].id]);
  await db.query('UPDATE communities SET rules_count = GREATEST(rules_count - 1, 0) WHERE id = $1', [comm[0].id]);
  R.noContent(res);
};

// ─── Toggle requires_approval ─────────────────────────────────────────────────
export const toggleApproval = async (req: Request, res: Response): Promise<void> => {
  const { id: userId }     = (req as AuthenticatedRequest).user;
  const { slug }           = req.params;
  const { requires_approval } = req.body;

  const { rows: comm } = await db.query('SELECT id FROM communities WHERE slug = $1', [slug]);
  if (!comm[0]) { R.notFound(res, 'Community not found'); return; }
  if (!(await isMod(comm[0].id, userId))) { R.forbidden(res, 'Mod only'); return; }

  await db.query(
    'UPDATE communities SET requires_approval = $1 WHERE id = $2',
    [requires_approval, comm[0].id]
  );
  R.ok(res, { requires_approval });
};

// ─── Get mod queue ────────────────────────────────────────────────────────────
export const getModQueue = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const { slug }       = req.params;
  const status         = (req.query.status as string) || 'pending';

  const { rows: comm } = await db.query('SELECT id FROM communities WHERE slug = $1', [slug]);
  if (!comm[0]) { R.notFound(res, 'Community not found'); return; }
  if (!(await isMod(comm[0].id, userId))) { R.forbidden(res, 'Mod only'); return; }

  const { rows } = await db.query(
    `SELECT q.*, p.content, p.media_urls, p.created_at AS post_created_at,
            u.handle AS author_handle, u.display_name AS author_name, u.avatar_url AS author_avatar
     FROM community_post_queue q
     JOIN posts p ON p.id = q.post_id
     JOIN users u ON u.id = q.submitted_by
     WHERE q.community_id = $1 AND q.status = $2
     ORDER BY q.created_at ASC`,
    [comm[0].id, status]
  );
  R.ok(res, rows);
};

// ─── Review queued post ───────────────────────────────────────────────────────
export const reviewQueuedPost = async (req: Request, res: Response): Promise<void> => {
  const { id: userId }  = (req as AuthenticatedRequest).user;
  const { slug, queueId } = req.params;
  const { action, note }  = req.body;

  const { rows: comm } = await db.query('SELECT id FROM communities WHERE slug = $1', [slug]);
  if (!comm[0]) { R.notFound(res, 'Community not found'); return; }
  if (!(await isMod(comm[0].id, userId))) { R.forbidden(res, 'Mod only'); return; }

  const { rows: q } = await db.query('SELECT * FROM community_post_queue WHERE id = $1', [queueId]);
  if (!q[0]) { R.notFound(res, 'Queue item not found'); return; }

  if (action === 'approve') {
    await db.query('UPDATE posts SET is_published = TRUE WHERE id = $1', [q[0].post_id]);
  } else {
    await db.query('DELETE FROM posts WHERE id = $1', [q[0].post_id]);
  }

  await db.query(
    `UPDATE community_post_queue
     SET status = $1, reviewed_by = $2, review_note = $3, reviewed_at = NOW()
     WHERE id = $4`,
    [action === 'approve' ? 'approved' : 'rejected', userId, note || null, queueId]
  );

  R.ok(res, null, `Post ${action}d`);
};

// ─── Ban user from community ──────────────────────────────────────────────────
export const banFromCommunity = async (req: Request, res: Response): Promise<void> => {
  const { id: modId }  = (req as AuthenticatedRequest).user;
  const { slug }       = req.params;
  const { user_id, reason, expires_hours } = req.body;

  const { rows: comm } = await db.query('SELECT id FROM communities WHERE slug = $1', [slug]);
  if (!comm[0]) { R.notFound(res, 'Community not found'); return; }
  if (!(await isMod(comm[0].id, modId))) { R.forbidden(res, 'Mod only'); return; }

  const expires_at = expires_hours
    ? new Date(Date.now() + expires_hours * 3600000)
    : null;

  await db.query(
    `INSERT INTO community_bans (community_id, user_id, banned_by, reason, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (community_id, user_id) DO UPDATE
     SET reason = EXCLUDED.reason, expires_at = EXCLUDED.expires_at, banned_by = EXCLUDED.banned_by`,
    [comm[0].id, user_id, modId, reason || null, expires_at]
  );

  // Remove from community
  await db.query(
    'DELETE FROM community_members WHERE community_id = $1 AND user_id = $2',
    [comm[0].id, user_id]
  );

  R.ok(res, null, 'User banned from community');
};

// ─── Unban user ───────────────────────────────────────────────────────────────
export const unbanFromCommunity = async (req: Request, res: Response): Promise<void> => {
  const { id: modId }  = (req as AuthenticatedRequest).user;
  const { slug, userId } = req.params;

  const { rows: comm } = await db.query('SELECT id FROM communities WHERE slug = $1', [slug]);
  if (!comm[0]) { R.notFound(res, 'Community not found'); return; }
  if (!(await isMod(comm[0].id, modId))) { R.forbidden(res, 'Mod only'); return; }

  await db.query(
    'DELETE FROM community_bans WHERE community_id = $1 AND user_id = $2',
    [comm[0].id, userId]
  );
  R.ok(res, null, 'User unbanned');
};

// ─── Get banned users ─────────────────────────────────────────────────────────
export const getBannedUsers = async (req: Request, res: Response): Promise<void> => {
  const { id: modId } = (req as AuthenticatedRequest).user;
  const { slug }      = req.params;

  const { rows: comm } = await db.query('SELECT id FROM communities WHERE slug = $1', [slug]);
  if (!comm[0]) { R.notFound(res, 'Community not found'); return; }
  if (!(await isMod(comm[0].id, modId))) { R.forbidden(res, 'Mod only'); return; }

  const { rows } = await db.query(
    `SELECT cb.*, u.handle, u.display_name, u.avatar_url
     FROM community_bans cb JOIN users u ON u.id = cb.user_id
     WHERE cb.community_id = $1
     ORDER BY cb.created_at DESC`,
    [comm[0].id]
  );
  R.ok(res, rows);
};

// ─── Promote member to moderator ─────────────────────────────────────────────
export const promoteModerator = async (req: Request, res: Response): Promise<void> => {
  const { id: ownerId } = (req as AuthenticatedRequest).user;
  const { slug }        = req.params;
  const { user_id }     = req.body;

  const { rows: comm } = await db.query(
    'SELECT id, owner_id FROM communities WHERE slug = $1',
    [slug]
  );
  if (!comm[0]) { R.notFound(res, 'Community not found'); return; }
  if (comm[0].owner_id !== ownerId) { R.forbidden(res, 'Owner only'); return; }

  await db.query(
    `UPDATE community_members SET role = 'moderator'
     WHERE community_id = $1 AND user_id = $2`,
    [comm[0].id, user_id]
  );
  R.ok(res, null, 'User promoted to moderator');
};

// ─── Report a post in community ───────────────────────────────────────────────
export const reportPost = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const { slug }       = req.params;
  const { post_id, reason, description } = req.body;

  const { rows: comm } = await db.query('SELECT id FROM communities WHERE slug = $1', [slug]);
  if (!comm[0]) { R.notFound(res, 'Community not found'); return; }

  const { rows } = await db.query(
    `INSERT INTO community_reports (community_id, post_id, reporter_id, reason, description)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [comm[0].id, post_id, userId, reason, description || null]
  );
  R.created(res, rows[0]);
};

// ─── Get community reports ────────────────────────────────────────────────────
export const getCommunityReports = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const { slug }       = req.params;

  const { rows: comm } = await db.query('SELECT id FROM communities WHERE slug = $1', [slug]);
  if (!comm[0]) { R.notFound(res, 'Community not found'); return; }
  if (!(await isMod(comm[0].id, userId))) { R.forbidden(res, 'Mod only'); return; }

  const { rows } = await db.query(
    `SELECT cr.*, p.content AS post_content,
            u.handle AS reporter_handle, u.display_name AS reporter_name
     FROM community_reports cr
     JOIN posts p ON p.id = cr.post_id
     JOIN users u ON u.id = cr.reporter_id
     WHERE cr.community_id = $1 AND cr.status = 'pending'
     ORDER BY cr.created_at DESC`,
    [comm[0].id]
  );
  R.ok(res, rows);
};
