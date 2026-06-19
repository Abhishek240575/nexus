import { Router } from 'express';
import * as analytics from '../controllers/analytics.controller';
import * as admin     from '../controllers/admin.controller';
import { protect }    from '../middlewares/auth.middleware';
import { body }       from 'express-validator';
import { validate }   from '../middlewares/validate.middleware';

const router = Router();

// ─── Analytics (creator) ──────────────────────────────────────────────────────
router.get('/posts',                          protect, analytics.getPostAnalytics);
router.get('/profile',                        protect, analytics.getProfileAnalytics);
router.get('/hashtags',                       protect, analytics.getHashtagAnalytics);
router.get('/hashtag-velocity/:hashtag',      protect, analytics.getHashtagVelocityHistory);

// ─── Admin ────────────────────────────────────────────────────────────────────
router.get('/admin/stats',              protect, admin.getStats);
router.get('/admin/users',              protect, admin.getUsers);
router.patch('/admin/users/:id/verify', protect, admin.verifyUser);
router.patch('/admin/users/:id/suspend',
  protect,
  [body('suspended').isBoolean()],
  validate,
  admin.suspendUser
);
router.get('/admin/reports',            protect, admin.getReports);
router.patch('/admin/reports/:id',
  protect,
  [body('status').isIn(['reviewed', 'actioned', 'dismissed'])],
  validate,
  admin.updateReport
);
router.delete('/admin/posts/:id',       protect, admin.deletePost);

export default router;
