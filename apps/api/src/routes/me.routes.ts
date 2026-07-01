import { Router }  from 'express';
import { protect } from '../middlewares/auth.middleware';
import { db }      from '../config/db';
import * as R      from '../utils/response';

const router = Router();

router.get('/', protect, async (req: any, res: any) => {
  const { id } = req.user;
  const { rows } = await db.query(
    `SELECT id, handle, email, display_name, avatar_url, verified, premium_tier,
            is_onboarded, bio, location, website, followers_count, following_count,
            posts_count, is_journalist, created_at
     FROM users WHERE id = $1`, [id]
  );
  if (!rows[0]) { R.notFound(res, 'User not found'); return; }
  R.ok(res, rows[0]);
});

export default router;
