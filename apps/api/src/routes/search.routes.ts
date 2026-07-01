import { Router } from 'express';
import { optionalAuth } from '../middlewares/auth.middleware';
import { search } from '../controllers/search.controller';
const router = Router();
router.get('/', optionalAuth, search);
export default router;
