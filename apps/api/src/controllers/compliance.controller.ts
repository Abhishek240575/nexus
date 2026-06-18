import { Request, Response } from 'express';
import { db }  from '../config/db';
import * as R  from '../utils/response';
import { AuthenticatedRequest } from '../types';

// ─── Verify the requesting user has Enterprise-level compliance access ──────
async function requiresComplianceAccess(userId: string): Promise<boolean> {
  const { rows } = await db.query(
    `SELECT t.features FROM users u LEFT JOIN subscription_tiers t ON t.id = u.premium_tier WHERE u.id = $1`,
    [userId]
  );
  return !!rows[0]?.features?.compliance_dashboard;
}

// ─── Audit log for the current account ───────────────────────────────────────
export const getMyAuditLogs = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;

  if (!(await requiresComplianceAccess(userId))) {
    R.forbidden(res, 'The compliance dashboard requires an Enterprise subscription. Upgrade at /premium.');
    return;
  }

  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const { rows } = await db.query(
    `SELECT al.*, actor.handle AS actor_handle
     FROM audit_logs al
     LEFT JOIN users actor ON actor.id = al.actor_id
     WHERE al.user_id = $1
     ORDER BY al.created_at DESC LIMIT $2`,
    [userId, limit]
  );
  R.ok(res, rows);
};

// ─── Moderation summary: how many of the account's posts were flagged/blocked ─
export const getModerationSummary = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;

  if (!(await requiresComplianceAccess(userId))) {
    R.forbidden(res, 'The compliance dashboard requires an Enterprise subscription. Upgrade at /premium.');
    return;
  }

  const { rows: postsStats } = await db.query(
    `SELECT COUNT(*) AS total_posts FROM posts WHERE user_id = $1`,
    [userId]
  );

  const { rows: flaggedStats } = await db.query(
    `SELECT mq.ai_decision, COUNT(*) AS count
     FROM moderation_queue mq JOIN posts p ON p.id = mq.post_id
     WHERE p.user_id = $1
     GROUP BY mq.ai_decision`,
    [userId]
  );

  // NOTE: the Grievance Redressal form on /grievance is currently a UI-only mock
  // (no backend endpoint persists submissions yet) — this count will read 0 until
  // a grievance-submission endpoint exists that logs the 'grievance.filed' audit action.
  const { rows: grievanceStats } = await db.query(
    `SELECT COUNT(*) AS total_grievances FROM audit_logs WHERE user_id = $1 AND action = 'grievance.filed'`
  ).catch(() => ({ rows: [{ total_grievances: 0 }] } as any));

  R.ok(res, {
    total_posts:        Number(postsStats[0].total_posts),
    moderation_breakdown: flaggedStats.reduce((acc: any, r: any) => {
      acc[r.ai_decision] = Number(r.count);
      return acc;
    }, {}),
    total_grievances: Number(grievanceStats[0]?.total_grievances || 0),
  });
};

// ─── Journalist legal-protection metadata: set / get ─────────────────────────
export const updateLegalProtection = async (req: Request, res: Response): Promise<void> => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const { is_journalist, press_credential_url, legal_protection_note } = req.body;

  if (!(await requiresComplianceAccess(userId))) {
    R.forbidden(res, 'Journalist legal-protection metadata requires an Enterprise subscription. Upgrade at /premium.');
    return;
  }

  const { rows } = await db.query(
    `UPDATE users SET
       is_journalist          = COALESCE($1, is_journalist),
       press_credential_url   = COALESCE($2, press_credential_url),
       legal_protection_note  = COALESCE($3, legal_protection_note)
     WHERE id = $4
     RETURNING is_journalist, press_credential_url, legal_protection_note`,
    [is_journalist, press_credential_url || null, legal_protection_note || null, userId]
  );

  R.ok(res, rows[0]);
};
