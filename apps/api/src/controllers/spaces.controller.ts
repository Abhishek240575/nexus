import { Request, Response } from 'express';
import { db }  from '../config/db';
import * as R  from '../utils/response';
import { AuthenticatedRequest } from '../types';
import { AccessToken } from 'livekit-server-sdk';
import { createOrder, verifyPaymentSignature } from '../services/razorpay.service';

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
  const { title, description, category = 'general', scheduled_at,
           is_ticketed = false, ticket_price_inr = 0, is_recorded = false } = req.body;

  // ─── Tier gating: ticketing & recording require Pro/Enterprise ──────────────
  const { rows: tierRow } = await db.query(
    `SELECT u.premium_tier, t.features, t.max_space_listeners
     FROM users u LEFT JOIN subscription_tiers t ON t.id = u.premium_tier
     WHERE u.id = $1`,
    [userId]
  );
  const features      = tierRow[0]?.features || {};
  const maxListeners   = tierRow[0]?.max_space_listeners ?? 100;

  if (is_ticketed && !features.ticketed_spaces) {
    R.forbidden(res, 'Ticketed Spaces require a Pro or Enterprise subscription. Upgrade at /premium.'); return;
  }
  if (is_recorded && !features.space_recording) {
    R.forbidden(res, 'Space recording requires a Pro or Enterprise subscription. Upgrade at /premium.'); return;
  }
  if (is_ticketed && (!ticket_price_inr || ticket_price_inr < 10)) {
    R.badRequest(res, 'Ticket price must be at least ₹10'); return;
  }

  const roomName = `nexus-space-${userId}-${Date.now()}`;
  const ticketPricePaise = is_ticketed ? Math.round(ticket_price_inr * 100) : 0;

  const { rows } = await db.query(
    `INSERT INTO spaces (host_id, title, description, category, room_name, status, scheduled_at,
                          is_ticketed, ticket_price_paise, is_recorded, max_listeners)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [userId, title, description || null, category, roomName,
     scheduled_at ? 'scheduled' : 'live',
     scheduled_at || null,
     is_ticketed, ticketPricePaise, is_recorded, maxListeners]
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

  const isHost = space.host_id === userId;
  const role   = existing[0]?.role || (isHost ? 'host' : 'listener');

  // ─── Ticketed entry check (host is always exempt) ─────────────────────────
  if (space.is_ticketed && !isHost && !existing[0]) {
    const { rows: ticket } = await db.query(
      'SELECT 1 FROM space_tickets WHERE space_id = $1 AND user_id = $2',
      [id, userId]
    );
    if (!ticket[0]) {
      R.forbidden(res, `This is a ticketed Space (₹${space.ticket_price_paise / 100}). Purchase a ticket to join.`);
      return;
    }
  }

  // ─── Listener cap check (host/existing participants exempt) ───────────────
  if (!isHost && !existing[0] && space.max_listeners !== -1) {
    const { rows: countRow } = await db.query(
      `SELECT COUNT(*) AS count FROM space_participants WHERE space_id = $1 AND left_at IS NULL`,
      [id]
    );
    if (Number(countRow[0].count) >= space.max_listeners) {
      R.forbidden(res, 'This Space is at full capacity for the host\'s current plan.');
      return;
    }
  }

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

  const { rows } = await db.query('SELECT host_id, is_recorded FROM spaces WHERE id = $1', [id]);
  if (!rows[0] || rows[0].host_id !== userId) {
    R.forbidden(res, 'Only the host can end this space'); return;
  }

  await db.query('UPDATE spaces SET status = $1, ended_at = NOW() WHERE id = $2', ['ended', id]);

  // NOTE: actual recording upload requires LiveKit Egress configured against a
  // storage bucket (S3/GCS). That infra step is not configured in this environment;
  // recording_url remains NULL until Egress is wired up, and the frontend shows
  // "Recording processing" rather than a broken link.
  R.ok(res, null, 'Space ended');
};

// ─── Purchase a ticket for a ticketed Space ───────────────────────────────────
export const purchaseTicket = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const { id }          = req.params;
  const { order_id, payment_id, signature } = req.body;

  const { rows: spaceRows } = await db.query('SELECT * FROM spaces WHERE id = $1', [id]);
  if (!spaceRows[0]) { R.notFound(res, 'Space not found'); return; }
  const space = spaceRows[0];
  if (!space.is_ticketed) { R.badRequest(res, 'This Space does not require a ticket'); return; }

  if (!verifyPaymentSignature(order_id, payment_id, signature)) {
    R.badRequest(res, 'Payment verification failed'); return;
  }

  const { rows } = await db.query(
    `INSERT INTO space_tickets (space_id, user_id, amount_inr_paise, razorpay_payment_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (space_id, user_id) DO NOTHING RETURNING *`,
    [id, userId, space.ticket_price_paise, payment_id]
  );

  await db.query(
    `INSERT INTO payment_transactions (user_id, razorpay_payment_id, razorpay_order_id, amount_inr_paise, status, purpose)
     VALUES ($1, $2, $3, $4, 'captured', 'space_ticket')`,
    [userId, payment_id, order_id, space.ticket_price_paise]
  );

  R.created(res, rows[0] || { message: 'Ticket already purchased' });
};

// ─── Create a Razorpay order to buy a Space ticket ────────────────────────────
export const createTicketOrder = async (req: Request, res: Response): Promise<void> => {
  const { id }  = req.params;

  const { rows: spaceRows } = await db.query('SELECT * FROM spaces WHERE id = $1', [id]);
  if (!spaceRows[0]) { R.notFound(res, 'Space not found'); return; }
  const space = spaceRows[0];
  if (!space.is_ticketed) { R.badRequest(res, 'This Space does not require a ticket'); return; }

  try {
    const order = await createOrder(space.ticket_price_paise, `space_ticket_${id}_${Date.now()}`, { space_id: id });
    R.created(res, { order_id: order.id, amount: space.ticket_price_paise, currency: 'INR', key_id: process.env.RAZORPAY_KEY_ID });
  } catch (err: any) {
    console.error('[Spaces] Ticket order failed:', err.message);
    R.serverError(res, 'Could not create ticket order');
  }
};

// ─── Start recording a space (host only) ──────────────────────────────────────
export const startRecording = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as any).user;
  const { id }         = req.params;

  const { rows } = await db.query('SELECT * FROM spaces WHERE id = $1', [id]);
  if (!rows[0])                        { R.notFound(res, 'Space not found'); return; }
  if (rows[0].host_id !== userId)      { R.forbidden(res, 'Only the host can start recording'); return; }
  if (rows[0].status !== 'live')       { R.badRequest(res, 'Space must be live to record'); return; }
  if (rows[0].egress_id)               { R.badRequest(res, 'Recording already in progress'); return; }

  // Check R2 is configured
  if (!process.env.R2_ACCESS_KEY || !process.env.R2_BUCKET) {
    R.serverError(res, 'Recording storage not configured'); return;
  }

  try {
    const { startRoomRecording } = await import('../services/egress.service');
    const egressId = await startRoomRecording(rows[0].room_name, id);

    await db.query(
      `UPDATE spaces SET egress_id = $1, is_recorded = TRUE WHERE id = $2`,
      [egressId, id]
    );

    R.ok(res, { recording: true, egress_id: egressId });
  } catch (err: any) {
    console.error('[Spaces] Start recording failed:', err.message);
    R.serverError(res, 'Could not start recording: ' + err.message);
  }
};

// ─── Stop recording ────────────────────────────────────────────────────────────
export const stopRecording = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as any).user;
  const { id }         = req.params;

  const { rows } = await db.query('SELECT * FROM spaces WHERE id = $1', [id]);
  if (!rows[0])                   { R.notFound(res, 'Space not found'); return; }
  if (rows[0].host_id !== userId) { R.forbidden(res, 'Only the host can stop recording'); return; }
  if (!rows[0].egress_id)         { R.badRequest(res, 'No active recording'); return; }

  try {
    const { stopRecording: stopEgress } = await import('../services/egress.service');
    await stopEgress(rows[0].egress_id);

    // Build the recording URL — LiveKit names it spaces/{spaceId}/{timestamp}.mp4
    const recordingFilename = `spaces/${id}`;
    const recordingUrl      = `${process.env.R2_PUBLIC_URL}/${recordingFilename}`;

    await db.query(
      `UPDATE spaces SET egress_id = NULL, recording_url = $1, recording_filename = $2 WHERE id = $3`,
      [recordingUrl, recordingFilename, id]
    );

    R.ok(res, { recording: false, recording_url: recordingUrl });
  } catch (err: any) {
    console.error('[Spaces] Stop recording failed:', err.message);
    R.serverError(res, 'Could not stop recording: ' + err.message);
  }
};

// ─── Get all recordings ────────────────────────────────────────────────────────
export const getRecordings = async (req: Request, res: Response): Promise<void> => {
  const { rows } = await db.query(
    `SELECT s.id, s.title, s.category, s.recording_url, s.started_at, s.ended_at,
            s.listener_count, s.recording_duration,
            u.handle AS host_handle, u.display_name AS host_name, u.avatar_url AS host_avatar
     FROM spaces s JOIN users u ON u.id = s.host_id
     WHERE s.is_recorded = TRUE AND s.recording_url IS NOT NULL AND s.status = 'ended'
     ORDER BY s.ended_at DESC
     LIMIT 50`,
    []
  );
  R.ok(res, rows);
};
