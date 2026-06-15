import { Router } from 'express';
import { body }   from 'express-validator';
import * as ctrl  from '../controllers/lists.controller';
import { protect, optionalAuth } from '../middlewares/auth.middleware';
import { validate }              from '../middlewares/validate.middleware';

const router = Router();

// Explore lists
router.get('/',                    optionalAuth, ctrl.getAllLists);

// List CRUD
router.post('/',
  protect,
  [
    body('name').trim().isLength({ min: 1, max: 100 }),
    body('description').optional().trim().isLength({ max: 300 }),
    body('is_private').optional().isBoolean(),
  ],
  validate,
  ctrl.createList
);
router.get('/:id',                 optionalAuth, ctrl.getList);
router.patch('/:id',               protect,      ctrl.updateList);
router.delete('/:id',              protect,      ctrl.deleteList);

// List feed
router.get('/:id/feed',            optionalAuth, ctrl.getListFeed);

// Members
router.get('/:id/members',         optionalAuth, ctrl.getListMembers);
router.post('/:id/members',
  protect,
  [body('user_id').isUUID()],
  validate,
  ctrl.addMember
);
router.delete('/:id/members/:userId', protect, ctrl.removeMember);

// Follow
router.post('/:id/follow',         protect, ctrl.toggleFollowList);

// Post activity
router.get('/activity/:id',        optionalAuth, ctrl.getPostActivity);

// User's lists
router.get('/user/:handle',        optionalAuth, ctrl.getLists);

export default router;
