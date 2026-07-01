import { db } from '../config/db';

export interface BotCheckResult {
  score:     number; // 0-100, higher = more likely bot
  is_bot:    boolean;
  signals:   string[];
  action:    'pass' | 'captcha' | 'shadow_ban' | 'ban';
}

export const checkBotSignals = async (userId: string, action: string, metadata?: any): Promise<BotCheckResult> => {
  const signals: string[] = [];
  let score = 0;

  const [{ rows: user }, { rows: recentPosts }, { rows: recentFollows }, { rows: recentLikes }] = await Promise.all([
    db.query(`SELECT created_at, posts_count, following_count, bot_score FROM users WHERE id = $1`, [userId]),
    db.query(`SELECT COUNT(*) AS cnt FROM posts WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`, [userId]),
    db.query(`SELECT COUNT(*) AS cnt FROM follows WHERE follower_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`, [userId]),
    db.query(`SELECT COUNT(*) AS cnt FROM likes WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`, [userId]),
  ]);

  if (!user[0]) return { score: 0, is_bot: false, signals: [], action: 'pass' };

  const accountAgeDays = (Date.now() - new Date(user[0].created_at).getTime()) / 86400000;
  const postsPerHour   = Number(recentPosts[0]?.cnt || 0);
  const followsPerHour = Number(recentFollows[0]?.cnt || 0);
  const likesPerHour   = Number(recentLikes[0]?.cnt || 0);

  // Signal 1: New account posting at high rate
  if (accountAgeDays < 1 && postsPerHour > 10) { score += 30; signals.push('new_account_high_post_rate'); }
  // Signal 2: Mass following
  if (followsPerHour > 30) { score += 25; signals.push('mass_following'); }
  // Signal 3: Mass liking
  if (likesPerHour > 100) { score += 20; signals.push('mass_liking'); }
  // Signal 4: Very new account
  if (accountAgeDays < 0.1) { score += 15; signals.push('very_new_account'); }
  // Signal 5: No avatar, no bio (common bot pattern)
  const { rows: profile } = await db.query('SELECT avatar_url, bio FROM users WHERE id = $1', [userId]);
  if (!profile[0]?.avatar_url && !profile[0]?.bio && accountAgeDays < 7) { score += 10; signals.push('incomplete_profile'); }
  // Signal 6: Previous bot signals
  score += Math.min(user[0].bot_score || 0, 20);

  // Store signal
  if (signals.length > 0) {
    await db.query(
      `INSERT INTO bot_signals (user_id, signal_type, score, details) VALUES ($1, $2, $3, $4)`,
      [userId, signals.join(','), score, JSON.stringify({ action, ...metadata })]
    );
    await db.query(`UPDATE users SET bot_score = LEAST(bot_score + $1, 100) WHERE id = $2`, [Math.floor(score / 5), userId]);
  }

  const is_bot = score >= 70;
  if (is_bot) {
    await db.query(`UPDATE users SET is_bot = TRUE, bot_flagged_at = NOW() WHERE id = $1 AND is_bot = FALSE`, [userId]);
  }

  let botAction: BotCheckResult['action'] = 'pass';
  if (score >= 70)      botAction = 'ban';
  else if (score >= 50) botAction = 'shadow_ban';
  else if (score >= 30) botAction = 'captcha';

  return { score, is_bot, signals, action: botAction };
};
