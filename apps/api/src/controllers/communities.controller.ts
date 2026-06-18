import { Request, Response } from 'express';
import { db }  from '../config/db';
import * as R  from '../utils/response';
import { AuthenticatedRequest } from '../types';

// ─── Get all communities (discovery) ─────────────────────────────────────────
export const getCommunities = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user?.id || null;
  const limit  = Math.min(Number(req.query.limit) || 20, 50);
  const q      = (req.query.q as string) || null;

  const { rows } = await db.query(
    `SELECT c.*,
            u.handle AS owner_handle, u.display_name AS owner_name,
            EXISTS(SELECT 1 FROM community_members WHERE community_id = c.id AND user_id = $1::uuid) AS is_member
     FROM communities c
     JOIN users u ON u.id = c.owner_id
     WHERE ($2::text IS NULL OR c.name ILIKE '%' || $2 || '%' OR c.description ILIKE '%' || $2 || '%')
     ORDER BY c.members_count DESC
     LIMIT $3`,
    [userId, q, limit]
  );
  R.ok(res, rows);
};

// ─── Get single community ─────────────────────────────────────────────────────
export const getCommunity = async (req: Request, res: Response): Promise<void> => {
  const { slug } = req.params;
  const userId   = (req as any).user?.id || null;

  const { rows } = await db.query(
    `SELECT c.*,
            u.handle AS owner_handle, u.display_name AS owner_name, u.avatar_url AS owner_avatar,
            EXISTS(SELECT 1 FROM community_members WHERE community_id = c.id AND user_id = $2::uuid) AS is_member,
            (SELECT role FROM community_members WHERE community_id = c.id AND user_id = $2::uuid) AS my_role
     FROM communities c JOIN users u ON u.id = c.owner_id
     WHERE c.slug = $1`,
    [slug, userId]
  );
  if (!rows[0]) { R.notFound(res, 'Community not found'); return; }
  R.ok(res, rows[0]);
};

// ─── Create community ─────────────────────────────────────────────────────────
export const createCommunity = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const { name, slug, description, is_private = false } = req.body;

  const existing = await db.query('SELECT id FROM communities WHERE slug = $1', [slug]);
  if (existing.rows[0]) { R.conflict(res, 'Slug already taken'); return; }

  const { rows } = await db.query(
    `INSERT INTO communities (owner_id, name, slug, description, is_private)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [userId, name, slug.toLowerCase(), description || null, is_private]
  );

  // Auto-join as owner
  await db.query(
    `INSERT INTO community_members (community_id, user_id, role) VALUES ($1, $2, 'owner')`,
    [rows[0].id, userId]
  );

  R.created(res, rows[0]);
};

// ─── Update community (branding requires Enterprise tier) ───────────────────
export const updateCommunity = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const { slug }        = req.params;
  const { name, description, brand_color, brand_logo_url } = req.body;

  const { rows: communityRows } = await db.query(
    `SELECT c.id, c.owner_id FROM communities c WHERE c.slug = $1`, [slug]
  );
  if (!communityRows[0]) { R.notFound(res, 'Community not found'); return; }
  if (communityRows[0].owner_id !== userId) { R.forbidden(res, 'Only the community owner can edit this'); return; }

  // ─── Branding fields require Enterprise tier on the owner's account ────────
  const wantsBranding = brand_color !== undefined || brand_logo_url !== undefined;
  if (wantsBranding) {
    const { rows: tierRow } = await db.query(
      `SELECT t.features FROM users u LEFT JOIN subscription_tiers t ON t.id = u.premium_tier WHERE u.id = $1`,
      [userId]
    );
    const features = tierRow[0]?.features || {};
    if (!features.custom_branding) {
      R.forbidden(res, 'Custom community branding requires an Enterprise subscription. Upgrade at /premium.');
      return;
    }
  }

  const { rows } = await db.query(
    `UPDATE communities SET
       name             = COALESCE($1, name),
       description      = COALESCE($2, description),
       brand_color      = COALESCE($3, brand_color),
       brand_logo_url   = COALESCE($4, brand_logo_url),
       is_premium_community = (brand_color IS NOT NULL OR $3 IS NOT NULL OR brand_logo_url IS NOT NULL OR $4 IS NOT NULL)
     WHERE id = $5 RETURNING *`,
    [name || null, description || null, brand_color || null, brand_logo_url || null, communityRows[0].id]
  );

  R.ok(res, rows[0]);
};

// ─── Join / leave community ───────────────────────────────────────────────────
export const joinCommunity = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const { slug }       = req.params;

  const { rows: comm } = await db.query('SELECT id FROM communities WHERE slug = $1', [slug]);
  if (!comm[0]) { R.notFound(res, 'Community not found'); return; }
  const communityId = comm[0].id;

  const existing = await db.query(
    'SELECT role FROM community_members WHERE community_id = $1 AND user_id = $2',
    [communityId, userId]
  );

  if (existing.rows[0]) {
    if (existing.rows[0].role === 'owner') { R.badRequest(res, 'Owner cannot leave'); return; }
    await db.query(
      'DELETE FROM community_members WHERE community_id = $1 AND user_id = $2',
      [communityId, userId]
    );
    R.ok(res, { member: false });
  } else {
    await db.query(
      `INSERT INTO community_members (community_id, user_id, role) VALUES ($1, $2, 'member')`,
      [communityId, userId]
    );
    R.ok(res, { member: true });
  }
};

// ─── Get community posts ──────────────────────────────────────────────────────
export const getCommunityPosts = async (req: Request, res: Response): Promise<void> => {
  const { slug } = req.params;
  const userId   = (req as any).user?.id || null;
  const limit    = Math.min(Number(req.query.limit) || 20, 50);
  const cursor   = (req.query.cursor as string) || null;

  const { rows: comm } = await db.query('SELECT id FROM communities WHERE slug = $1', [slug]);
  if (!comm[0]) { R.notFound(res, 'Community not found'); return; }

  const { rows } = await db.query(
    `SELECT p.*,
            u.handle AS author_handle, u.display_name AS author_name,
            u.avatar_url AS author_avatar, u.verified AS author_verified,
            EXISTS(SELECT 1 FROM likes   WHERE user_id = $3::uuid AND post_id = p.id) AS is_liked,
            EXISTS(SELECT 1 FROM reposts WHERE user_id = $3::uuid AND post_id = p.id) AS is_reposted
     FROM posts p JOIN users u ON u.id = p.user_id
     WHERE p.community_id = $1 AND p.is_published = TRUE
       AND ($4::timestamptz IS NULL OR p.created_at < $4::timestamptz)
     ORDER BY p.created_at DESC
     LIMIT $2`,
    [comm[0].id, limit, userId, cursor]
  );

  R.ok(res, {
    data:        rows,
    next_cursor: rows.length === limit ? rows[rows.length - 1].created_at : null,
    has_more:    rows.length === limit,
  });
};

// ─── Get community members ────────────────────────────────────────────────────
export const getCommunityMembers = async (req: Request, res: Response): Promise<void> => {
  const { slug } = req.params;
  const limit    = Math.min(Number(req.query.limit) || 20, 50);

  const { rows: comm } = await db.query('SELECT id FROM communities WHERE slug = $1', [slug]);
  if (!comm[0]) { R.notFound(res, 'Community not found'); return; }

  const { rows } = await db.query(
    `SELECT u.id, u.handle, u.display_name, u.avatar_url, u.verified,
            cm.role, cm.joined_at
     FROM community_members cm JOIN users u ON u.id = cm.user_id
     WHERE cm.community_id = $1
     ORDER BY CASE cm.role WHEN 'owner' THEN 1 WHEN 'moderator' THEN 2 ELSE 3 END, cm.joined_at
     LIMIT $2`,
    [comm[0].id, limit]
  );
  R.ok(res, rows);
};
