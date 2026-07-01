import { db } from '../config/db';
import { createHmac } from 'crypto';

export const WEBHOOK_EVENTS = [
  'post.created', 'post.liked', 'post.reposted', 'post.deleted',
  'user.followed', 'user.unfollowed',
  'message.received',
  'comment.created',
  'mention.created',
];

export const deliverWebhook = async (
  userId:  string,
  event:   string,
  payload: Record<string, any>
): Promise<void> => {
  const { rows: webhooks } = await db.query(
    `SELECT * FROM webhooks WHERE user_id = $1 AND is_active = TRUE AND $2 = ANY(events)`,
    [userId, event]
  );

  for (const webhook of webhooks) {
    const body      = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });
    const signature = createHmac('sha256', webhook.secret).update(body).digest('hex');

    try {
      const res = await fetch(webhook.url, {
        method:  'POST',
        headers: {
          'Content-Type':       'application/json',
          'X-Deemona-Event':    event,
          'X-Deemona-Signature': `sha256=${signature}`,
          'User-Agent':          'Deemona-Webhooks/1.0',
        },
        body,
        signal: AbortSignal.timeout(10000),
      });

      await db.query(
        `INSERT INTO webhook_deliveries (webhook_id, event, payload, status_code, success)
         VALUES ($1,$2,$3,$4,$5)`,
        [webhook.id, event, payload, res.status, res.ok]
      );

      if (!res.ok) {
        await db.query(
          `UPDATE webhooks SET fail_count = fail_count + 1,
             is_active = CASE WHEN fail_count >= 10 THEN FALSE ELSE is_active END
           WHERE id = $1`,
          [webhook.id]
        );
      } else {
        await db.query(
          `UPDATE webhooks SET fail_count = 0, last_ping_at = NOW() WHERE id = $1`,
          [webhook.id]
        );
      }
    } catch {
      await db.query(
        `UPDATE webhooks SET fail_count = fail_count + 1 WHERE id = $1`, [webhook.id]
      );
    }
  }
};

export const createWebhook = async (
  userId: string, url: string, events: string[], secret?: string
) => {
  const webhookSecret = secret || require('crypto').randomBytes(32).toString('hex');
  const { rows } = await db.query(
    `INSERT INTO webhooks (user_id, url, secret, events) VALUES ($1,$2,$3,$4) RETURNING *`,
    [userId, url, webhookSecret, events]
  );
  return rows[0];
};
