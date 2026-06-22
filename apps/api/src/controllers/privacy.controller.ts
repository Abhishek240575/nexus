import { Request, Response } from 'express';
import { db }  from '../config/db';
import * as R  from '../utils/response';

interface AuthReq extends Request { user: { id: string; handle: string; email: string } }

// ─── Record consent ────────────────────────────────────────────────────────────
export const recordConsent = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthReq).user;
  const { consent_type, granted = true, version = '1.0' } = req.body;

  await db.query(
    `INSERT INTO user_consents (user_id, consent_type, granted, ip_address, user_agent, version)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, consent_type, granted, req.ip, req.headers['user-agent'] || '', version]
  );

  if (!granted) {
    await db.query(
      `UPDATE user_consents SET withdrawn_at = NOW()
       WHERE user_id = $1 AND consent_type = $2 AND withdrawn_at IS NULL`,
      [userId, consent_type]
    );
  }

  R.ok(res, { recorded: true });
};

// ─── Get all consents ─────────────────────────────────────────────────────────
export const getMyConsents = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthReq).user;
  const { rows } = await db.query(
    `SELECT DISTINCT ON (consent_type) consent_type, granted, version, created_at, withdrawn_at
     FROM user_consents WHERE user_id = $1
     ORDER BY consent_type, created_at DESC`,
    [userId]
  );
  R.ok(res, rows);
};

// ─── Request data export ──────────────────────────────────────────────────────
export const requestDataExport = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthReq).user;

  // Check for recent pending request
  const { rows: existing } = await db.query(
    `SELECT id, status, created_at FROM data_export_requests
     WHERE user_id = $1 AND status IN ('pending','processing','ready')
     AND created_at > NOW() - INTERVAL '7 days'`,
    [userId]
  );

  if (existing[0]) {
    R.ok(res, { message: 'Export already in progress', request: existing[0] });
    return;
  }

  // Gather all user data
  const [
    { rows: user },
    { rows: posts },
    { rows: follows },
    { rows: bookmarks },
    { rows: consents },
    { rows: notifications },
  ] = await Promise.all([
    db.query('SELECT id, handle, email, display_name, bio, location, website, created_at, premium_tier FROM users WHERE id = $1', [userId]),
    db.query('SELECT id, content, media_urls, language, created_at FROM posts WHERE user_id = $1 AND is_published = TRUE ORDER BY created_at DESC', [userId]),
    db.query('SELECT u.handle, f.created_at FROM follows f JOIN users u ON u.id = f.following_id WHERE f.follower_id = $1', [userId]),
    db.query('SELECT p.content, p.created_at FROM bookmarks b JOIN posts p ON p.id = b.post_id WHERE b.user_id = $1', [userId]),
    db.query('SELECT consent_type, granted, version, created_at FROM user_consents WHERE user_id = $1 ORDER BY created_at DESC', [userId]),
    db.query('SELECT type, created_at, read_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 500', [userId]),
  ]);

  const exportData = {
    export_generated_at: new Date().toISOString(),
    platform: 'Deemona',
    data_controller: 'Deemona Internet Pvt. Ltd.',
    profile:       user[0],
    posts:         { count: posts.length, items: posts },
    following:     { count: follows.length, items: follows },
    bookmarks:     { count: bookmarks.length, items: bookmarks },
    consents:      consents,
    notifications: { count: notifications.length, items: notifications },
    data_processors: [
      { name: 'Anthropic', purpose: 'AI content moderation and translation', location: 'USA' },
      { name: 'Razorpay',  purpose: 'Payment processing', location: 'India' },
      { name: 'LiveKit',   purpose: 'Real-time audio Spaces', location: 'USA' },
      { name: 'Cloudflare R2', purpose: 'Media storage', location: 'Global (APAC region)' },
      { name: 'Render',    purpose: 'Cloud hosting', location: 'Singapore' },
    ],
  };

  // Store export request
  const { rows: reqRow } = await db.query(
    `INSERT INTO data_export_requests (user_id, status) VALUES ($1, 'ready') RETURNING id`,
    [userId]
  );

  await db.query(`UPDATE users SET data_export_requested_at = NOW() WHERE id = $1`, [userId]);

  R.ok(res, {
    request_id: reqRow[0].id,
    export:     exportData,
    message:    'Your data export is ready. Download this JSON response.',
  });
};

// ─── Request account deletion ─────────────────────────────────────────────────
export const requestDeletion = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthReq).user;
  const { reason, immediate = false } = req.body;

  // Check not already requested
  const { rows: existing } = await db.query(
    `SELECT id FROM deletion_requests WHERE user_id = $1 AND cancelled_at IS NULL AND completed_at IS NULL`,
    [userId]
  );
  if (existing[0]) { R.badRequest(res, 'Deletion already requested. Check your account settings to cancel.'); return; }

  const scheduledFor = immediate
    ? new Date()
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30-day grace period

  const { rows } = await db.query(
    `INSERT INTO deletion_requests (user_id, reason, scheduled_for) VALUES ($1, $2, $3) RETURNING *`,
    [userId, reason || null, scheduledFor]
  );

  await db.query(`UPDATE users SET deletion_requested_at = NOW() WHERE id = $1`, [userId]);

  R.ok(res, {
    deletion_id:   rows[0].id,
    scheduled_for: scheduledFor,
    grace_days:    immediate ? 0 : 30,
    message:       immediate
      ? 'Your account will be deleted immediately.'
      : 'Your account is scheduled for deletion in 30 days. You can cancel this in Settings.',
  });
};

// ─── Cancel deletion request ──────────────────────────────────────────────────
export const cancelDeletion = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthReq).user;

  const { rows } = await db.query(
    `UPDATE deletion_requests SET cancelled_at = NOW()
     WHERE user_id = $1 AND cancelled_at IS NULL AND completed_at IS NULL
     RETURNING id`,
    [userId]
  );

  if (!rows[0]) { R.notFound(res, 'No active deletion request found'); return; }

  await db.query(`UPDATE users SET deletion_requested_at = NULL WHERE id = $1`, [userId]);
  R.ok(res, { cancelled: true });
};

// ─── Execute account deletion (purge all data) ────────────────────────────────
export const executeAccountDeletion = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthReq).user;
  const { confirm } = req.body;

  if (confirm !== 'DELETE MY ACCOUNT') {
    R.badRequest(res, 'Please type "DELETE MY ACCOUNT" to confirm.'); return;
  }

  // Anonymise instead of hard delete (preserves conversation threads)
  await db.query(`
    UPDATE users SET
      email         = 'deleted_' || id || '@deleted.deemona.in',
      handle        = 'deleted_' || substring(id::text, 1, 8),
      display_name  = 'Deleted User',
      bio           = NULL,
      avatar_url    = NULL,
      location      = NULL,
      website       = NULL,
      is_deleted    = TRUE,
      cookie_consent = FALSE
    WHERE id = $1
  `, [userId]);

  // Hard delete sensitive personal data
  await db.query(`DELETE FROM user_consents WHERE user_id = $1`, [userId]);
  await db.query(`DELETE FROM user_nominees WHERE user_id = $1`, [userId]);
  await db.query(`DELETE FROM notifications WHERE user_id = $1`, [userId]);
  await db.query(`DELETE FROM follows WHERE follower_id = $1 OR following_id = $1`, [userId]);
  await db.query(`DELETE FROM bookmarks WHERE user_id = $1`, [userId]);
  await db.query(`UPDATE posts SET content = '[deleted]', media_urls = '{}' WHERE user_id = $1`, [userId]);
  await db.query(`UPDATE deletion_requests SET completed_at = NOW() WHERE user_id = $1`, [userId]);

  R.ok(res, { deleted: true, message: 'Your account and personal data have been permanently deleted.' });
};

// ─── Get/set nominee (DPDP India) ─────────────────────────────────────────────
export const getNominee = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthReq).user;
  const { rows } = await db.query('SELECT * FROM user_nominees WHERE user_id = $1', [userId]);
  R.ok(res, rows[0] || null);
};

export const setNominee = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthReq).user;
  const { nominee_name, nominee_email, nominee_phone, relationship } = req.body;

  const { rows } = await db.query(
    `INSERT INTO user_nominees (user_id, nominee_name, nominee_email, nominee_phone, relationship)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO UPDATE SET
       nominee_name  = EXCLUDED.nominee_name,
       nominee_email = EXCLUDED.nominee_email,
       nominee_phone = EXCLUDED.nominee_phone,
       relationship  = EXCLUDED.relationship,
       updated_at    = NOW()
     RETURNING *`,
    [userId, nominee_name, nominee_email, nominee_phone || null, relationship || null]
  );

  R.ok(res, rows[0]);
};

// ─── Withdraw all consent ─────────────────────────────────────────────────────
export const withdrawAllConsent = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthReq).user;

  await db.query(
    `UPDATE user_consents SET withdrawn_at = NOW()
     WHERE user_id = $1 AND withdrawn_at IS NULL AND consent_type != 'terms'`,
    [userId]
  );

  await db.query(`UPDATE users SET cookie_consent = FALSE WHERE id = $1`, [userId]);

  R.ok(res, {
    withdrawn: true,
    note: 'All optional consents withdrawn. Core service consent (Terms) retained. Your account remains active.',
  });
};

// ─── Get privacy center summary ───────────────────────────────────────────────
export const getPrivacyCenter = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthReq).user;

  const [
    { rows: user },
    { rows: consents },
    { rows: nominee },
    { rows: deletion },
    { rows: exports },
  ] = await Promise.all([
    db.query('SELECT handle, email, created_at, cookie_consent, deletion_requested_at FROM users WHERE id = $1', [userId]),
    db.query(`SELECT DISTINCT ON (consent_type) consent_type, granted, version, created_at FROM user_consents WHERE user_id = $1 ORDER BY consent_type, created_at DESC`, [userId]),
    db.query('SELECT nominee_name, nominee_email, relationship FROM user_nominees WHERE user_id = $1', [userId]),
    db.query('SELECT id, scheduled_for, created_at FROM deletion_requests WHERE user_id = $1 AND cancelled_at IS NULL AND completed_at IS NULL', [userId]),
    db.query('SELECT id, status, created_at FROM data_export_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 3', [userId]),
  ]);

  R.ok(res, {
    account:          user[0],
    consents,
    nominee:          nominee[0] || null,
    pending_deletion: deletion[0] || null,
    recent_exports:   exports,
    data_processors: [
      { name: 'Anthropic',     purpose: 'AI content moderation and translation', location: 'USA',                    policy_url: 'https://www.anthropic.com/privacy' },
      { name: 'Razorpay',      purpose: 'Payment processing',                    location: 'India',                  policy_url: 'https://razorpay.com/privacy/' },
      { name: 'LiveKit',       purpose: 'Real-time audio Spaces',                location: 'USA',                    policy_url: 'https://livekit.io/privacy' },
      { name: 'Cloudflare R2', purpose: 'Media and recording storage',           location: 'Global (APAC primary)',   policy_url: 'https://www.cloudflare.com/privacypolicy/' },
      { name: 'Render',        purpose: 'Cloud hosting and infrastructure',      location: 'Singapore',               policy_url: 'https://render.com/privacy' },
    ],
    retention_policy: {
      posts:         'Retained until account deletion or manual deletion by user',
      messages:      'Retained for 2 years, then purged',
      notifications: 'Retained for 90 days',
      audit_logs:    'Retained for 3 years (legal compliance)',
      payment_data:  'Retained for 7 years (financial regulations)',
      deleted_accounts: 'Anonymised immediately, backups purged within 30 days',
    },
  });
};
