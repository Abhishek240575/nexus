import { Request, Response } from 'express';
import { db }  from '../config/db';
import * as R  from '../utils/response';
import { createHmac, randomBytes } from 'crypto';

interface AuthReq extends Request { user: { id: string; handle: string } }

// ─── Get conversations ────────────────────────────────────────────────────────
export const getConversations = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthReq).user;
  const { rows } = await db.query(
    `SELECT DISTINCT ON (c.id)
       c.id, c.created_at,
       -- Other participant
       u.id AS other_id, u.handle AS other_handle,
       u.display_name AS other_name, u.avatar_url AS other_avatar,
       u.verified AS other_verified,
       -- Last message
       m.content AS last_message,
       m.message_type AS last_message_type,
       m.created_at AS last_message_at,
       m.is_encrypted AS last_encrypted,
       -- Unread count
       (SELECT COUNT(*) FROM messages
        WHERE conversation_id = c.id AND sender_id != $1 AND read_at IS NULL AND is_deleted = FALSE
       ) AS unread_count
     FROM conversations c
     JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = $1
     JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id != $1
     JOIN users u ON u.id = cp2.user_id
     LEFT JOIN messages m ON m.id = (
       SELECT id FROM messages
       WHERE conversation_id = c.id AND is_deleted = FALSE
       ORDER BY created_at DESC LIMIT 1
     )
     ORDER BY c.id, m.created_at DESC NULLS LAST`,
    [userId]
  );
  R.ok(res, rows);
};

// ─── Get messages in conversation ─────────────────────────────────────────────
export const getMessages = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthReq).user;
  const { conversationId } = req.params;
  const limit  = Math.min(Number(req.query.limit) || 30, 100);
  const cursor = req.query.cursor as string || null;

  // Verify participant
  const { rows: member } = await db.query(
    `SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, userId]
  );
  if (!member[0]) { R.forbidden(res, 'Not a member of this conversation'); return; }

  const { rows } = await db.query(
    `SELECT m.*,
            u.handle AS sender_handle, u.display_name AS sender_name, u.avatar_url AS sender_avatar,
            rm.content AS reply_content, ru.handle AS reply_handle
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     LEFT JOIN messages rm ON rm.id = m.reply_to_id
     LEFT JOIN users ru ON ru.id = rm.sender_id
     WHERE m.conversation_id = $1
       AND m.is_deleted = FALSE
       AND (m.disappears_at IS NULL OR m.disappears_at > NOW())
       AND ($3::timestamptz IS NULL OR m.created_at < $3::timestamptz)
     ORDER BY m.created_at DESC
     LIMIT $2`,
    [conversationId, limit, cursor]
  );

  // Mark as read
  await db.query(
    `UPDATE messages SET read_at = NOW()
     WHERE conversation_id = $1 AND sender_id != $2 AND read_at IS NULL`,
    [conversationId, userId]
  );

  R.ok(res, {
    messages:    rows.reverse(),
    next_cursor: rows.length === limit ? rows[0]?.created_at : null,
    has_more:    rows.length === limit,
  });
};

// ─── Send message (text, encrypted, voice, file) ──────────────────────────────
export const sendMessage = async (req: Request, res: Response): Promise<void> => {
  const { id: senderId } = (req as AuthReq).user;
  const { conversationId } = req.params;
  const {
    content, message_type = 'text',
    is_encrypted = false, encrypted_data, iv,
    voice_url, voice_duration,
    file_url, file_name,
    reply_to_id,
    disappear_after_seconds,
  } = req.body;

  // Verify participant
  const { rows: member } = await db.query(
    `SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, senderId]
  );
  if (!member[0]) { R.forbidden(res, 'Not a member of this conversation'); return; }

  const disappears_at = disappear_after_seconds
    ? new Date(Date.now() + disappear_after_seconds * 1000)
    : null;

  const { rows } = await db.query(
    `INSERT INTO messages (
       conversation_id, sender_id, content, message_type,
       is_encrypted, encrypted_data, iv,
       voice_url, voice_duration,
       file_url, file_name,
       reply_to_id, disappears_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
    [
      conversationId, senderId,
      is_encrypted ? null : (content || null),
      message_type,
      is_encrypted, encrypted_data || null, iv || null,
      voice_url || null, voice_duration || null,
      file_url || null, file_name || null,
      reply_to_id || null, disappears_at,
    ]
  );

  // Update conversation timestamp
  await db.query(
    `UPDATE conversations SET updated_at = NOW() WHERE id = $1`, [conversationId]
  );

  R.created(res, rows[0]);
};

// ─── Start conversation ────────────────────────────────────────────────────────
export const startConversation = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthReq).user;
  const { handle } = req.body;

  const { rows: other } = await db.query('SELECT id FROM users WHERE handle = $1', [handle]);
  if (!other[0]) { R.notFound(res, 'User not found'); return; }
  if (other[0].id === userId) { R.badRequest(res, 'Cannot message yourself'); return; }

  // Check existing conversation
  const { rows: existing } = await db.query(
    `SELECT c.id FROM conversations c
     JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = $1
     JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = $2
     LIMIT 1`,
    [userId, other[0].id]
  );
  if (existing[0]) { R.ok(res, { conversation_id: existing[0].id }); return; }

  // Create new
  const { rows: conv } = await db.query(
    `INSERT INTO conversations DEFAULT VALUES RETURNING id`
  );
  await db.query(
    `INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1,$2),($1,$3)`,
    [conv[0].id, userId, other[0].id]
  );

  R.created(res, { conversation_id: conv[0].id });
};

// ─── Delete message ────────────────────────────────────────────────────────────
export const deleteMessage = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthReq).user;
  const { messageId } = req.params;

  const { rows } = await db.query(
    `UPDATE messages SET is_deleted = TRUE, deleted_at = NOW(), content = NULL, encrypted_data = NULL
     WHERE id = $1 AND sender_id = $2 RETURNING id`,
    [messageId, userId]
  );
  if (!rows[0]) { R.forbidden(res, 'Cannot delete this message'); return; }
  R.ok(res, { deleted: true });
};

// ─── Add reaction to message ──────────────────────────────────────────────────
export const addReaction = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthReq).user;
  const { messageId } = req.params;
  const { emoji } = req.body;

  await db.query(
    `UPDATE messages
     SET reactions = jsonb_set(
       COALESCE(reactions, '{}'),
       ARRAY[$1],
       (COALESCE(reactions->$1, '[]')::jsonb || $2::jsonb)
     )
     WHERE id = $3`,
    [emoji, JSON.stringify(userId), messageId]
  );
  R.ok(res, { reacted: true });
};

// ─── Register/get public key for E2E encryption ───────────────────────────────
export const registerPublicKey = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthReq).user;
  const { public_key } = req.body;

  await db.query(
    `INSERT INTO user_key_pairs (user_id, public_key)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET public_key = $2, rotated_at = NOW()`,
    [userId, public_key]
  );
  R.ok(res, { registered: true });
};

export const getPublicKey = async (req: Request, res: Response): Promise<void> => {
  const { handle } = req.params;
  const { rows } = await db.query(
    `SELECT kp.public_key, u.handle FROM user_key_pairs kp
     JOIN users u ON u.id = kp.user_id WHERE u.handle = $1`,
    [handle]
  );
  if (!rows[0]) { R.notFound(res, 'No public key found for this user'); return; }
  R.ok(res, rows[0]);
};

// ─── Get presigned URL for voice note upload ──────────────────────────────────
export const getVoiceUploadUrl = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthReq).user;
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
  const { v4: uuidv4 } = await import('uuid');

  const s3 = new S3Client({
    region: 'auto', endpoint: process.env.R2_ENDPOINT!,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY!, secretAccessKey: process.env.R2_SECRET_KEY! },
    forcePathStyle: true,
  });

  const key = `voice/${userId}/${uuidv4()}.webm`;
  const url = await getSignedUrl(s3, new PutObjectCommand({
    Bucket: process.env.R2_BUCKET!, Key: key, ContentType: 'audio/webm',
  }), { expiresIn: 300 });

  R.ok(res, { upload_url: url, public_url: `${process.env.R2_PUBLIC_URL}/${key}`, key });
};
