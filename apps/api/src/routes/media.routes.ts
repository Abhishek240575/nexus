import { Router } from 'express';
import { body }   from 'express-validator';
import { protect } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import * as ctrl  from '../controllers/media.controller';

const router = Router();

router.post('/upload-url',
  protect,
  [
    body('content_type').isString().notEmpty(),
    body('file_size').optional().isInt({ min: 1 }),
    body('media_type').optional().isIn(['image', 'video']),
  ],
  validate,
  ctrl.getUploadUrl
);

router.delete('/delete',
  protect,
  [body('key').isString().notEmpty()],
  validate,
  ctrl.deleteMedia
);

export default router;
