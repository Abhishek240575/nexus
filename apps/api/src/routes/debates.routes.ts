import { Router } from 'express';
import { body }   from 'express-validator';
import * as ctrl  from '../controllers/debates.controller';
import { protect, optionalAuth } from '../middlewares/auth.middleware';
import { validate }              from '../middlewares/validate.middleware';

const router = Router();

router.get('/',          optionalAuth, ctrl.getDebates);
router.get('/:id',       optionalAuth, ctrl.getDebate);
router.get('/:id/arguments', optionalAuth, ctrl.getArguments);

router.post('/',
  protect,
  [
    body('title').trim().isLength({ min: 10, max: 280 }),
    body('description').optional().trim().isLength({ max: 1000 }),
    body('category').optional().isIn(['politics', 'social', 'economy', 'environment', 'technology', 'culture', 'religion', 'sports', 'general']),
    body('for_label').optional().trim().isLength({ max: 100 }),
    body('against_label').optional().trim().isLength({ max: 100 }),
    body('closes_hours').optional().isInt({ min: 1, max: 168 }),
  ],
  validate,
  ctrl.createDebate
);

router.post('/:id/vote',
  protect,
  [body('side').isIn(['for', 'against'])],
  validate,
  ctrl.voteDebate
);

router.post('/:id/arguments',
  protect,
  [
    body('content').trim().isLength({ min: 1, max: 500 }),
    body('side').isIn(['for', 'against']),
  ],
  validate,
  ctrl.addArgument
);

router.post('/arguments/:argumentId/like', protect, ctrl.likeArgument);
router.patch('/:id/close', protect, ctrl.closeDebate);

export default router;
