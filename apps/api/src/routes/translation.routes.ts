import { Router } from 'express';
import { body }   from 'express-validator';
import * as ctrl  from '../controllers/translation.controller';
import { protect, optionalAuth } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';

const router = Router();

// Public endpoints
router.get('/languages',                    ctrl.getLanguages);
router.get('/post/:postId',  optionalAuth,  ctrl.translatePost);
router.get('/detect/:postId', optionalAuth, ctrl.detectPostLanguage);

// Text translation (composer live preview — auth required to prevent abuse)
router.post('/text',
  protect,
  [
    body('text').isString().isLength({ min: 1, max: 2000 }),
    body('target').isString().isLength({ min: 2, max: 5 }),
    body('source').optional().isString(),
  ],
  validate,
  ctrl.translateText_
);

// Language detection
router.post('/detect',
  [body('text').isString().isLength({ min: 1, max: 1000 })],
  validate,
  ctrl.detect
);

export default router;
