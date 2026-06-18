import { Router } from 'express';
import { body }   from 'express-validator';
import * as ctrl  from '../controllers/compliance.controller';
import { protect } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';

const router = Router();

router.get('/audit-logs',        protect, ctrl.getMyAuditLogs);
router.get('/moderation-summary', protect, ctrl.getModerationSummary);

router.patch('/legal-protection',
  protect,
  [
    body('is_journalist').optional().isBoolean(),
    body('press_credential_url').optional().isURL(),
    body('legal_protection_note').optional().isString().isLength({ max: 1000 }),
  ],
  validate,
  ctrl.updateLegalProtection
);

export default router;
