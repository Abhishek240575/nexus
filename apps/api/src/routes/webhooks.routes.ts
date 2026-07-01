import { Router } from 'express';
import { body } from 'express-validator';
import { protect } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { db } from '../config/db';
import { createWebhook, WEBHOOK_EVENTS } from '../services/webhook.service';
import * as R from '../utils/response';
const router = Router();

router.get('/events', (_, res) => R.ok(res, WEBHOOK_EVENTS));

router.get('/', protect, async (req: any, res) => {
  const { rows } = await db.query('SELECT id,url,events,is_active,last_ping_at,fail_count,created_at FROM webhooks WHERE user_id=$1', [req.user.id]);
  R.ok(res, rows);
});

router.post('/', protect,
  [body('url').isURL(), body('events').isArray({ min: 1 })],
  validate,
  async (req: any, res: any) => {
    const wh = await createWebhook(req.user.id, req.body.url, req.body.events, req.body.secret);
    R.created(res, { ...wh, secret: wh.secret }); // return secret once
  }
);

router.delete('/:id', protect, async (req: any, res: any) => {
  await db.query('DELETE FROM webhooks WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  R.ok(res, { deleted: true });
});

router.post('/:id/ping', protect, async (req: any, res: any) => {
  const { rows } = await db.query('SELECT * FROM webhooks WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  if (!rows[0]) { R.notFound(res, 'Webhook not found'); return; }
  const { deliverWebhook } = await import('../services/webhook.service');
  await deliverWebhook(req.user.id, 'ping', { message: 'Webhook test from Deemona' });
  R.ok(res, { pinged: true });
});

export default router;
