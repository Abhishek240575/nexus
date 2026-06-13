import { Request, Response } from 'express';
import { db }  from '../config/db';
import * as R  from '../utils/response';
import { AuthenticatedRequest } from '../types';
import { emitNewMessage } from '../services/socket.service';
import { io }             from '../server';

// ─── Get all conversations ────────────────────────────────────────────────────
export const getConversations = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;

  const { rows } = await db.query(
    `SELECT c.id, c.updated_at,
            u.id AS other_user_id, u.handle, u.display_name,
            u.avatar_url, u.verified,
            m.content AS last_message, m.created_at AS last_message_at,
            m.sender_id AS last_sender_id,
            (SELECT COUNT(*) FROM messages msg
             JOIN conversation_participants cp2 ON cp2.conversation_id = msg.conversation_id
             WHERE msg.conversation_id = c.id
               AND msg.sender_id != $1
               AND msg.read_at IS NULL
               AND cp2.user_id = $1) AS unread_count
     FROM conversations c
     JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = $1
     JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id != $1
     JOIN users u ON u.id = cp2.user_id
     LEFT JOIN LATERAL (
       SELECT content, created_at, sender_id FROM messages
       WHERE conversation_id = c.id
       ORDER BY created_at DESC LIMIT 1
     ) m ON TRUE
     ORDER BY COALESCE(m.created_at, c.updated_at) DESC`,
    [userId]
  );

  R.ok(res, rows);
};

// ─── Get or create conversation with a user ───────────────────────────────────
export const getOrCreateConversation = async (req: Request, res: Response): Promise<void> => {
  const { id: userId }    = (req as AuthenticatedRequest).user;
  const { userId: otherId } = req.params;

  if (userId === otherId) { R.badRequest(res, 'Cannot message yourself'); return; }

  const { rows: target } = await db.query('SELECT id FROM users WHERE id = $1', [otherId]);
  if (!target[0]) { R.notFound(res, 'User not found'); return; }

  // Check if conversation already exists
  const { rows: existing } = await db.query(
    `SELECT c.id FROM conversations c
     JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = $1
     JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = $2`,
    [userId, otherId]
  );

  if (existing[0]) { R.ok(res, existing[0]); return; }

  // Create new conversation
  const { rows: conv } = await db.query(
    'INSERT INTO conversations DEFAULT VALUES RETURNING id'
  );
  const convId = conv[0].id;

  await db.query(
    'INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)',
    [convId, userId, otherId]
  );

  R.created(res, { id: convId });
};

// ─── Get messages in a conversation ──────────────────────────────────────────
export const getMessages = async (req: Request, res: Response): Promise<void> => {
  const { id: userId }       = (req as AuthenticatedRequest).user;
  const { conversationId }   = req.params;
  const limit  = Math.min(Number(req.query.limit) || 30, 100);
  const cursor = req.query.cursor as string | undefined;

  // Verify user is in this conversation
  const { rows: member } = await db.query(
    'SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
    [conversationId, userId]
  );
  if (!member[0]) { R.forbidden(res, 'Not a participant'); return; }

  const { rows } = await db.query(
    `SELECT m.*, u.handle AS sender_handle, u.display_name AS sender_name,
            u.avatar_url AS sender_avatar
     FROM messages m JOIN users u ON u.id = m.sender_id
     WHERE m.conversation_id = $1
       AND ($3::timestamptz IS NULL OR m.created_at < $3::timestamptz)
     ORDER BY m.created_at DESC
     LIMIT $2`,
    [conversationId, limit, cursor || null]
  );

  // Mark messages as read
  await db.query(
    `UPDATE messages SET read_at = NOW()
     WHERE conversation_id = $1 AND sender_id != $2 AND read_at IS NULL`,
    [conversationId, userId]
  );

  R.ok(res, {
    data:        rows.reverse(),
    next_cursor: rows.length === limit ? rows[0]?.created_at : null,
    has_more:    rows.length === limit,
  });
};

// ─── Send a message ───────────────────────────────────────────────────────────
export const sendMessage = async (req: Request, res: Response): Promise<void> => {
  const { id: userId }     = (req as AuthenticatedRequest).user;
  const { conversationId } = req.params;
  const { content, media_url } = req.body;

  if (!content && !media_url) { R.badRequest(res, 'Message cannot be empty'); return; }

  // Verify participant
  const { rows: member } = await db.query(
    'SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
    [conversationId, userId]
  );
  if (!member[0]) { R.forbidden(res, 'Not a participant'); return; }

  const { rows } = await db.query(
    `INSERT INTO messages (conversation_id, sender_id, content, media_url)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [conversationId, userId, content || null, media_url || null]
  );

  const message = rows[0];

  // Update conversation updated_at
  await db.query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [conversationId]);

  // Emit via Socket.io
  emitNewMessage(io, conversationId, message);

  R.created(res, message);
};
