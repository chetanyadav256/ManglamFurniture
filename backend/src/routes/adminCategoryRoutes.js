import { Router } from 'express';
import { createAdminCategory, deleteAdminCategory, updateAdminCategory } from '../controllers/adminCategoryController.js';
import { requireAdminRole } from '../middleware/adminAuth.js';

const router = Router();
router.use(requireAdminRole('admin'));
router.post('/', createAdminCategory);
router.patch('/:id', updateAdminCategory);
router.delete('/:id', deleteAdminCategory);

export default router;
