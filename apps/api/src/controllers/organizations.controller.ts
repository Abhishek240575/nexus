import { Request, Response } from 'express';
import { db } from '../config/db';
import * as R from '../utils/response';

interface AuthReq extends Request { user: { id: string; handle: string } }

export const createOrg = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthReq).user;
  const { handle, name, description, org_type = 'brand', website } = req.body;

  if (!handle || !name) { R.badRequest(res, 'handle and name required'); return; }

  const { rows: exists } = await db.query('SELECT id FROM organizations WHERE handle = $1', [handle]);
  if (exists[0]) { R.conflict(res, 'Handle already taken'); return; }

  const { rows } = await db.query(
    `INSERT INTO organizations (handle, name, description, org_type, website, owner_id)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [handle.toLowerCase(), name, description || null, org_type, website || null, userId]
  );

  // Add creator as owner member
  await db.query(
    `INSERT INTO org_members (org_id, user_id, role) VALUES ($1,$2,'owner')`,
    [rows[0].id, userId]
  );

  R.created(res, rows[0]);
};

export const getOrg = async (req: Request, res: Response): Promise<void> => {
  const { handle } = req.params;
  const viewerId = (req as any).user?.id || null;

  const { rows } = await db.query(
    `SELECT o.*,
            u.handle AS owner_handle, u.display_name AS owner_name,
            EXISTS(SELECT 1 FROM org_follows WHERE org_id = o.id AND user_id = $2::uuid) AS is_following
     FROM organizations o JOIN users u ON u.id = o.owner_id
     WHERE o.handle = $1`,
    [handle, viewerId]
  );
  if (!rows[0]) { R.notFound(res, 'Organization not found'); return; }
  R.ok(res, rows[0]);
};

export const updateOrg = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthReq).user;
  const { handle } = req.params;
  const { name, description, website, avatar_url, cover_url } = req.body;

  const { rows: org } = await db.query('SELECT * FROM organizations WHERE handle = $1', [handle]);
  if (!org[0]) { R.notFound(res, 'Organization not found'); return; }

  const { rows: member } = await db.query(
    `SELECT role FROM org_members WHERE org_id = $1 AND user_id = $2`, [org[0].id, userId]
  );
  if (!member[0] || !['owner','admin'].includes(member[0].role)) { R.forbidden(res, 'Not authorized'); return; }

  const { rows } = await db.query(
    `UPDATE organizations SET
       name=$1, description=$2, website=$3, avatar_url=$4, cover_url=$5
     WHERE id=$6 RETURNING *`,
    [name||org[0].name, description||org[0].description, website||org[0].website,
     avatar_url||org[0].avatar_url, cover_url||org[0].cover_url, org[0].id]
  );
  R.ok(res, rows[0]);
};

export const followOrg = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthReq).user;
  const { handle } = req.params;

  const { rows: org } = await db.query('SELECT id FROM organizations WHERE handle = $1', [handle]);
  if (!org[0]) { R.notFound(res, 'Organization not found'); return; }

  const { rows: existing } = await db.query(
    'SELECT 1 FROM org_follows WHERE org_id=$1 AND user_id=$2', [org[0].id, userId]
  );

  if (existing[0]) {
    await db.query('DELETE FROM org_follows WHERE org_id=$1 AND user_id=$2', [org[0].id, userId]);
    await db.query('UPDATE organizations SET follower_count = follower_count - 1 WHERE id=$1', [org[0].id]);
    R.ok(res, { following: false });
  } else {
    await db.query('INSERT INTO org_follows (org_id, user_id) VALUES ($1,$2)', [org[0].id, userId]);
    await db.query('UPDATE organizations SET follower_count = follower_count + 1 WHERE id=$1', [org[0].id]);
    R.ok(res, { following: true });
  }
};

export const searchOrgs = async (req: Request, res: Response): Promise<void> => {
  const q = (req.query.q as string || '').trim();
  const { rows } = await db.query(
    `SELECT id, handle, name, description, avatar_url, org_type, verified, follower_count
     FROM organizations
     WHERE handle ILIKE '%'||$1||'%' OR name ILIKE '%'||$1||'%'
     ORDER BY verified DESC, follower_count DESC LIMIT 20`,
    [q]
  );
  R.ok(res, rows);
};

export const getOrgFeed = async (req: Request, res: Response): Promise<void> => {
  const { handle } = req.params;
  const viewerId = (req as any).user?.id || null;
  const limit = Math.min(Number(req.query.limit)||20, 50);

  const { rows: org } = await db.query('SELECT id FROM organizations WHERE handle=$1', [handle]);
  if (!org[0]) { R.notFound(res, 'Organization not found'); return; }

  // Get org members' posts
  const { rows } = await db.query(
    `SELECT p.*, u.handle AS author_handle, u.display_name AS author_name,
            u.avatar_url AS author_avatar, u.verified AS author_verified
     FROM posts p JOIN users u ON u.id = p.user_id
     JOIN org_members om ON om.user_id = p.user_id AND om.org_id = $1
     WHERE p.is_published=TRUE AND p.reply_to_id IS NULL
     ORDER BY p.created_at DESC LIMIT $2`,
    [org[0].id, limit]
  );
  R.ok(res, rows);
};
