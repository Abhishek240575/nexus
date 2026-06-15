import { Router } from 'express';
import { body }   from 'express-validator';
import * as ctrl  from '../controllers/spaces.controller';
import { protect, optionalAuth } from '../middlewares/auth.middleware';
import { validate }              from '../middlewares/validate.middleware';

const router = Router();

router.get('/',            optionalAuth, ctrl.getSpaces);
router.get('/:id',         optionalAuth, ctrl.getSpace);
router.get('/:id/participants', optionalAuth, ctrl.getParticipants);

router.post('/',
  protect,
  [
    body('title').trim().isLength({ min: 5, max: 280 }),
    body('description').optional().trim().isLength({ max: 500 }),
    body('category').optional().isString(),
  ],
  validate,
  ctrl.createSpace
);

router.post('/:id/join',           protect, ctrl.joinSpace);
router.post('/:id/leave',          protect, ctrl.leaveSpace);
router.post('/:id/end',            protect, ctrl.endSpace);
router.post('/:id/raise-hand',
  protect,
  [body('raised').isBoolean()],
  validate,
  ctrl.raiseHand
);
router.post('/:id/promote/:userId', protect, ctrl.promoteToSpeaker);

export default router;
