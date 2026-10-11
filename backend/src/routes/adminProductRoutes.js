import { Router } from 'express';
import { deactivateAdminProduct, createAdminProduct, updateAdminProduct } from '../controllers/adminProductController.js';
import { requireAdminRole } from '../middleware/adminAuth.js';
import { uploadProductImages, removeProductImage, selectMainProductImage, getProductImages } from '../controllers/adminImageController.js';

const router = Router();
router.use(requireAdminRole('admin'));
router.get('/:id/images', getProductImages);
router.post('/:id/images', uploadProductImages);
router.delete('/:id/images/:imageId', removeProductImage);
router.patch('/:id/images/:imageId/main', selectMainProductImage);
router.post('/', createAdminProduct);
router.patch('/:id', updateAdminProduct);
router.delete('/:id', deactivateAdminProduct);

export default router;
