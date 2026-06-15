import { Request, Response } from 'express';
import { db }  from '../config/db';
import * as R  from '../utils/response';
import { AuthenticatedRequest } from '../types';
import { AccessToken } from 'livekit-server-sdk';

// ─── Generate LiveKit token ───────────────────────────────────────────────────
const generateToken = async (
  roomName: string,
  userId:   string,
  handle:   string,
  role:     'host' | 'speaker' | 'listener'
): Promise<string> => {
  const apiKey    = process.env.LIVEKIT_API_KEY!;
  const apiSecret = process.env.LIVEKIT_API_SECRET!;

  const token = new AccessToken(apiKey, apiSecret, {
    identity: userId,
    name:     handle,
    ttl:      '4h',
  });

  token.addGrant({
    roomJoin:         true,
    room:             roomName,
    canPublish:       role === 'host' || role === 'speaker',
    canPublishData:   true,
    canSubscribe:     true,
    canUpdateOwnMetadata: true,
    roomAdmin:        role === 'host',
  });

  return await token.toJwt();
};

// ─── Get all spaces ───────────────────────────────────────────────────────────
export const getSpaces = async (req: Request, res: Response): Promise<void> => {
  const status = (req.query.status as string) || 'live';
  const limit  = Math.min(Number(req.query.limit) || 20, 50);

  const { rows } = await db.query(
    `SELECT s.*,
            u.handle AS host_handle, u.display_name AS host_name,
            u.avatar_url AS host_avatar, u.verified AS host_verified
     FROM spaces s JOIN users u ON u.id = s.host_id
     WHERE s.status = $1
     ORDER BY s.listener_count DESC, s.created_at DESC
     LIMIT $2`,
    [status, limit]
  );

  R.ok(res, rows);
};

// ─── Get single space ─────────────────────────────────────────────────────────
export const getSpace = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const { rows } = await db.query(
    `SELECT s.*,
            u.handle AS host_handle, u.display_name AS host_name,
            u.avatar_url AS host_avatar, u.verified AS host_verified
     FROM spaces s JOIN users u ON u.id = s.host_id
     WHERE s.id = $1`,
    [id]
  );

  if (!rows[0]) { R.notFound(res, 'Space not found'); return; }
  R.ok(res, rows[0]);
};

// ─── Create space ─────────────────────────────────────────────────────────────
export const createSpace = async (req: Request, res: Response): Promise<void> => {
  const { id: userId, handle } = (req as AuthenticatedRequest).user;
  const { title, description, category = 'general', scheduled_at } = req.body;

  const roomName = `nexus-space-${userId}-${Date.now()}`;

  const { rows } = await db.query(
    `INSERT INTO spaces (host_id, title, description, category, room_name, status, scheduled_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [userId, title, description || null, category, roomName,
     scheduled_at ? 'scheduled' : 'live',
     scheduled_at || null]
  );

  const space = rows[0];

  if (!scheduled_at) {
    // Start immediately — add host as participant
    await db.query(
      `INSERT INTO space_participants (space_id, user_id, role)
       VALUES ($1, $2, 'host') ON CONFLICT DO NOTHING`,
      [space.id, userId]
    );
    await db.query('UPDATE spaces SET started_at = NOW(), speaker_count = 1 WHERE id = $1', [space.id]);
  }

  // Generate token for host
  const token = await generateToken(roomName, userId, handle, 'host');

  R.created(res, { ...space, token, livekit_url: process.env.LIVEKIT_URL });
};

// ─── Join space (get token) ───────────────────────────────────────────────────
export const joinSpace = async (req: Request, res: Response): Promise<void> => {
  const { id: userId, handle } = (req as AuthenticatedRequest).user;
  const { id }                 = req.params;

  const { rows: spaceRows } = await db.query(
    'SELECT * FROM spaces WHERE id = $1',
    [id]
  );
  if (!spaceRows[0]) { R.notFound(res, 'Space not found'); return; }
  const space = spaceRows[0];

  if (space.status === 'ended') { R.badRequest(res, 'Space has ended'); return; }

  // Check existing participation
  const { rows: existing } = await db.query(
    'SELECT role FROM space_participants WHERE space_id = $1 AND user_id = $2',
    [id, userId]
  );

  const role = existing[0]?.role ||
    (space.host_id === userId ? 'host' : 'listener');

  // Upsert participant
  await db.query(
    `INSERT INTO space_participants (space_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (space_id, user_id) DO UPDATE SET left_at = NULL, role = EXCLUDED.role`,
    [id, userId, role]
  );

  // Update counts
  await db.query(
    `UPDATE spaces SET
       listener_count = (SELECT COUNT(*) FROM space_participants WHERE space_id = $1 AND role = 'listener' AND left_at IS NULL),
       speaker_count  = (SELECT COUNT(*) FROM space_participants WHERE space_id = $1 AND role IN ('host','speaker') AND left_at IS NULL)
     WHERE id = $1`,
    [id]
  );

  const token = await generateToken(space.room_name, userId, handle, role);

  R.ok(res, { token, livekit_url: process.env.LIVEKIT_URL, role, space });
};

// ─── Leave space ──────────────────────────────────────────────────────────────
export const leaveSpace = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const { id }         = req.params;

  await db.query(
    'UPDATE space_participants SET left_at = NOW() WHERE space_id = $1 AND user_id = $2',
    [id, userId]
  );

  // Update counts
  await db.query(
    `UPDATE spaces SET
       listener_count = (SELECT COUNT(*) FROM space_participants WHERE space_id = $1 AND role = 'listener' AND left_at IS NULL),
       speaker_count  = (SELECT COUNT(*) FROM space_participants WHERE space_id = $1 AND role IN ('host','speaker') AND left_at IS NULL)
     WHERE id = $1`,
    [id]
  );

  // Check if host left — end the space
  const { rows: space } = await db.query('SELECT host_id FROM spaces WHERE id = $1', [id]);
  if (space[0]?.host_id === userId) {
    await db.query('UPDATE spaces SET status = $1, ended_at = NOW() WHERE id = $2', ['ended', id]);
  }

  R.ok(res, null, 'Left space');
};

// ─── Get participants ─────────────────────────────────────────────────────────
export const getParticipants = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const { rows } = await db.query(
    `SELECT sp.*, u.handle, u.display_name, u.avatar_url, u.verified
     FROM space_participants sp JOIN users u ON u.id = sp.user_id
     WHERE sp.space_id = $1 AND sp.left_at IS NULL
     ORDER BY CASE sp.role WHEN 'host' THEN 1 WHEN 'speaker' THEN 2 ELSE 3 END, sp.joined_at`,
    [id]
  );

  R.ok(res, rows);
};

// ─── Raise / lower hand ───────────────────────────────────────────────────────
export const raiseHand = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const { id }         = req.params;
  const { raised }     = req.body;

  await db.query(
    'UPDATE space_participants SET hand_raised = $1 WHERE space_id = $2 AND user_id = $3',
    [raised, id, userId]
  );

  R.ok(res, { raised });
};

// ─── Promote to speaker (host only) ──────────────────────────────────────────
export const promoteToSpeaker = async (req: Request, res: Response): Promise<void> => {
  const { id: hostId } = (req as AuthenticatedRequest).user;
  const { id, userId } = req.params;

  const { rows: space } = await db.query('SELECT host_id FROM spaces WHERE id = $1', [id]);
  if (!space[0] || space[0].host_id !== hostId) {
    R.forbidden(res, 'Only the host can promote speakers'); return;
  }

  await db.query(
    'UPDATE space_participants SET role = $1, hand_raised = FALSE WHERE space_id = $2 AND user_id = $3',
    ['speaker', id, userId]
  );

  R.ok(res, null, 'Promoted to speaker');
};

// ─── End space (host only) ────────────────────────────────────────────────────
export const endSpace = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const { id }         = req.params;

  const { rows } = await db.query('SELECT host_id FROM spaces WHERE id = $1', [id]);
  if (!rows[0] || rows[0].host_id !== userId) {
    R.forbidden(res, 'Only the host can end this space'); return;
  }

  await db.query('UPDATE spaces SET status = $1, ended_at = NOW() WHERE id = $2', ['ended', id]);
  R.ok(res, null, 'Space ended');
};
