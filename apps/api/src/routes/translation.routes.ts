import { Router } from 'express';
import { body }   from 'express-validator';
import * as ctrl  from '../controllers/translation.controller';
import { validate } from '../middlewares/validate.middleware';

const router = Router();

router.get('/languages',           ctrl.getLanguages);
router.get('/post/:postId',        ctrl.translatePost);
router.post('/detect',
  [body('text').isString().isLength({ min: 1, max: 1000 })],
  validate,
  ctrl.detect
);

export default router;
