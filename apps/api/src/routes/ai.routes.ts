import { Router } from 'express';
import { body }   from 'express-validator';
import { protect } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { assistWriting } from '../services/writing-assistant.service';
import * as R from '../utils/response';

const router = Router();

router.post('/assist',
  protect,
  [
    body('text').isString().isLength({ min: 1, max: 2000 }),
    body('action').isIn(['improve','shorten','expand','hashtags','grammar','formal','casual','translate_en']),
    body('lang').optional().isString(),
  ],
  validate,
  async (req: any, res: any) => {
    try {
      const { text, action, lang } = req.body;
      const result = await assistWriting(text, action, lang);
      R.ok(res, { result, action });
    } catch (err: any) {
      R.serverError(res, 'AI assistant failed: ' + err.message);
    }
  }
);

export default router;
