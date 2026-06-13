import { Router } from 'express';
import { body }   from 'express-validator';
import * as ctrl  from '../controllers/messages.controller';
import { protect } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';

const router = Router();

router.get('/',                                    protect, ctrl.getConversations);
router.post('/with/:userId',                       protect, ctrl.getOrCreateConversation);
router.get('/:conversationId',                     protect, ctrl.getMessages);
router.post('/:conversationId',
  protect,
  [body('content').optional().isString().isLength({ max: 10000 })],
  validate,
  ctrl.sendMessage
);

export default router;
