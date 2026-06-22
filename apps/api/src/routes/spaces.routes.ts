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
    body('is_ticketed').optional().isBoolean(),
    body('ticket_price_inr').optional().isFloat({ min: 0 }),
    body('is_recorded').optional().isBoolean(),
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

router.post('/:id/ticket/order',   protect, ctrl.createTicketOrder);
router.post('/:id/ticket/confirm',
  protect,
  [body('order_id').notEmpty(), body('payment_id').notEmpty(), body('signature').notEmpty()],
  validate,
  ctrl.purchaseTicket
);

// Recording
router.post('/:id/recording/start', protect, ctrl.startRecording);
router.post('/:id/recording/stop',  protect, ctrl.stopRecording);
router.get('/recordings',           optionalAuth, ctrl.getRecordings);

export default router;
