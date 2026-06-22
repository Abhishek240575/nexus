import { Router } from 'express';
import { body }   from 'express-validator';
import { protect } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import * as ctrl  from '../controllers/privacy.controller';

const router = Router();

// Consent
router.get('/consents',               protect, ctrl.getMyConsents);
router.post('/consents',
  protect,
  [body('consent_type').isString().notEmpty(), body('granted').optional().isBoolean()],
  validate, ctrl.recordConsent
);
router.post('/consents/withdraw-all', protect, ctrl.withdrawAllConsent);

// Privacy center
router.get('/center',                 protect, ctrl.getPrivacyCenter);

// Data export
router.post('/export',                protect, ctrl.requestDataExport);

// Account deletion
router.post('/delete-account',
  protect,
  [body('reason').optional().isString()],
  validate, ctrl.requestDeletion
);
router.post('/delete-account/cancel', protect, ctrl.cancelDeletion);
router.post('/delete-account/execute',
  protect,
  [body('confirm').isString()],
  validate, ctrl.executeAccountDeletion
);

// Nominee (DPDP India)
router.get('/nominee',                protect, ctrl.getNominee);
router.post('/nominee',
  protect,
  [
    body('nominee_name').isString().isLength({ min: 2, max: 200 }),
    body('nominee_email').isEmail(),
    body('nominee_phone').optional().isString(),
    body('relationship').optional().isString(),
  ],
  validate, ctrl.setNominee
);

export default router;
