import { Router } from 'express';
import * as ctrl  from '../controllers/notifications.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

router.get('/',           protect, ctrl.getNotifications);
router.get('/unread',     protect, ctrl.getUnreadCount);
router.patch('/read-all', protect, ctrl.markAllRead);
router.patch('/:id/read', protect, ctrl.markOneRead);

export default router;
