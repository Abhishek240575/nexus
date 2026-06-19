import { db } from '../config/db';

// ─── Record hourly hashtag velocity snapshots ─────────────────────────────────
// Called from server.ts on a 1-hour interval.
// Captures top 50 trending hashtags per region so Pro+ users can query
// velocity history beyond the 7-day live window.
export const recordHashtagVelocitySnapshot = async (): Promise<void> => {
  const regions = ['national', 'north', 'south', 'east', 'west', 'northeast'];

  for (const region of regions) {
    try {
      const regionFilter = region === 'national' ? '' : `AND p.region = '${region}'`;

      const { rows } = await db.query(
        `SELECT h.name, COUNT(ph.post_id) AS post_count
         FROM post_hashtags ph
         JOIN hashtags h ON h.id = ph.hashtag_id
         JOIN posts p ON p.id = ph.post_id
         WHERE p.created_at >= NOW() - INTERVAL '1 hour'
           AND p.is_published = TRUE
           ${regionFilter}
         GROUP BY h.name
         ORDER BY post_count DESC
         LIMIT 50`
      );

      if (rows.length === 0) continue;

      // Bulk insert all snapshots for this region
      const values = rows
        .map((_: any, i: number) => `($${i*3+1}, $${i*3+2}, $${i*3+3}, NOW())`)
        .join(', ');
      const params = rows.flatMap((r: any) => [r.name, region, Number(r.post_count)]);

      await db.query(
        `INSERT INTO hashtag_velocity_history (hashtag, region, post_count, recorded_at) VALUES ${values}`,
        params
      );

      console.log(`[VelocityCron] Recorded ${rows.length} hashtags for region: ${region}`);
    } catch (err: any) {
      console.error(`[VelocityCron] Failed for region ${region}:`, err.message);
    }
  }

  // Prune records older than 365 days to keep the table lean
  await db.query(
    `DELETE FROM hashtag_velocity_history WHERE recorded_at < NOW() - INTERVAL '365 days'`
  ).catch((err: any) => console.error('[VelocityCron] Prune failed:', err.message));
};
