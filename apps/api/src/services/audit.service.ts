import { db } from '../config/db';

interface AuditEntry {
  userId:  string | null;
  actorId: string | null;
  action:  string;
  details?: Record<string, any>;
  ipAddress?: string;
}

export const logAudit = async (entry: AuditEntry): Promise<void> => {
  try {
    await db.query(
      `INSERT INTO audit_logs (user_id, actor_id, action, details, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [entry.userId, entry.actorId, entry.action, JSON.stringify(entry.details || {}), entry.ipAddress || null]
    );
  } catch (err) {
    // Audit logging should never break the calling flow
    console.error('[Audit] Failed to write audit log:', err);
  }
};

export const getAuditLogs = async (userId: string, limit = 50) => {
  const { rows } = await db.query(
    `SELECT * FROM audit_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
  return rows;
};
