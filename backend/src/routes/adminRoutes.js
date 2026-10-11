import { Router } from 'express';
import { getCurrentAdmin, loginAdmin } from '../controllers/adminController.js';
import { requireAdminRole } from '../middleware/adminAuth.js';
import { loginRateLimit } from '../middleware/loginRateLimit.js';

const router = Router();

router.post('/login', loginRateLimit, loginAdmin);
router.get('/me', requireAdminRole('admin'), getCurrentAdmin);

export default router;
