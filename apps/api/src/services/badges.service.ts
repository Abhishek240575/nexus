import { db } from '../config/db';
import { logAudit } from './audit.service';

export const awardBadge = async (
  userId: string, badgeId: 'early_supporter' | 'campaign_leader' | 'debate_champion',
  context: Record<string, any> = {}
): Promise<boolean> => {
  // Avoid duplicate spam-awards for the same context (e.g. same campaign)
  const { rows: already } = await db.query(
    `SELECT 1 FROM user_badges WHERE user_id = $1 AND badge_id = $2 AND context = $3::jsonb`,
    [userId, badgeId, JSON.stringify(context)]
  );
  if (already[0]) return false;

  await db.query(
    `INSERT INTO user_badges (user_id, badge_id, context) VALUES ($1, $2, $3::jsonb)`,
    [userId, badgeId, JSON.stringify(context)]
  );

  await logAudit({ userId, actorId: null, action: 'badge.awarded', details: { badge_id: badgeId, ...context } });
  return true;
};

// ─── Campaign Leader: awarded to the creator when a campaign hits its goal ──
export const checkCampaignLeaderBadge = async (campaignId: string): Promise<void> => {
  const { rows } = await db.query(
    `SELECT creator_id, supporter_count, goal, hashtag FROM campaigns WHERE id = $1`,
    [campaignId]
  );
  const campaign = rows[0];
  if (!campaign || !campaign.goal) return;

  if (Number(campaign.supporter_count) >= Number(campaign.goal)) {
    await awardBadge(campaign.creator_id, 'campaign_leader', { campaign_id: campaignId, hashtag: campaign.hashtag });
  }
};

// ─── Debate Champion: awarded to the author of the most-liked argument ──────
// when a debate closes (status moves to 'closed').
export const checkDebateChampionBadge = async (debateId: string): Promise<void> => {
  const { rows } = await db.query(
    `SELECT da.user_id, da.id, da.likes_count
     FROM debate_arguments da
     WHERE da.debate_id = $1
     ORDER BY da.likes_count DESC, da.created_at ASC
     LIMIT 1`,
    [debateId]
  );
  const topArgument = rows[0];
  if (!topArgument || Number(topArgument.likes_count) === 0) return;

  await awardBadge(topArgument.user_id, 'debate_champion', { debate_id: debateId, argument_id: topArgument.id });
};
