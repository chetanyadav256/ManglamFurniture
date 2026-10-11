import { Router } from 'express';
import { getCurrentAdmin, loginAdmin, updateCurrentAdmin } from '../controllers/adminController.js';
import { requireAdminRole } from '../middleware/adminAuth.js';
import { loginRateLimit } from '../middleware/loginRateLimit.js';
import { passwordRateLimit } from '../middleware/passwordRateLimit.js';
import { changeAdminPassword } from '../controllers/adminPasswordController.js';
import adminProductRoutes from './adminProductRoutes.js';
import adminCategoryRoutes from './adminCategoryRoutes.js';

const router = Router();

router.post('/login', loginRateLimit, loginAdmin);
router.get('/me', requireAdminRole('admin'), getCurrentAdmin);
router.patch('/me', requireAdminRole('admin'), updateCurrentAdmin);
router.patch('/me/password', requireAdminRole('admin'), passwordRateLimit, changeAdminPassword);
router.use('/products', adminProductRoutes);
router.use('/categories', adminCategoryRoutes);

export default router;
