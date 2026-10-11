import { adminApiRequest, ApiError } from '../../services/api.js';

export const ADMIN_MAX_PRODUCT_IMAGES = 5;
export const ADMIN_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ADMIN_IMAGE_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);

const productIdPattern = /^[a-f\d]{24}$/i;
const imageIdPattern = /^[a-f\d]{64}$/;

function requireToken(token) {
  if (typeof token !== 'string' || !token.trim()) {
    throw new ApiError('Admin authentication is required. Please sign in again.', {
      status: 401,
      code: 'AUTH_REQUIRED',
    });
  }
  return token.trim();
}

function requireProductId(productId) {
  if (typeof productId !== 'string' || !productIdPattern.test(productId)) {
    throw new ApiError('Invalid product ID.', { status: 400, code: 'INVALID_PRODUCT_ID' });
  }
  return productId;
}

function adminOptions(token) {
  requireToken(token);
  return { headers: { Authorization: `Bearer ${requireToken(token)}` } };
}

export function validateAdminProductImages(files) {
  const selectedFiles = Array.isArray(files)
    ? files
    : files && typeof files[Symbol.iterator] === 'function'
      ? Array.from(files)
      : null;
  if (!selectedFiles || selectedFiles.length < 1) {
    throw new ApiError('Select at least one image to upload.', {
      status: 400,
      code: 'INVALID_IMAGES',
    });
  }
  if (selectedFiles.length > ADMIN_MAX_PRODUCT_IMAGES) {
    throw new ApiError('Select no more than five images at a time.', {
      status: 400,
      code: 'IMAGE_LIMIT',
    });
  }
  selectedFiles.forEach((file, index) => {
    if (!file || !ADMIN_IMAGE_TYPES.includes(file.type)) {
      throw new ApiError(`Image ${index + 1} must be a JPEG, PNG, or WebP file.`, {
        status: 400,
        code: 'INVALID_IMAGE_TYPE',
      });
    }
    if (!Number.isFinite(file.size) || file.size <= 0 || file.size > ADMIN_MAX_IMAGE_BYTES) {
      throw new ApiError(
        `Image ${index + 1} must be greater than 0 bytes and no larger than 5 MB.`,
        {
          status: 400,
          code: 'INVALID_IMAGE_SIZE',
        },
      );
    }
  });
  return selectedFiles;
}

export async function createAdminProduct(product, token) {
  return adminApiRequest.post('/admin/products', product, adminOptions(token));
}

export async function updateAdminProduct(productId, changes, token) {
  requireProductId(productId);
  return adminApiRequest.patch(`/admin/products/${productId}`, changes, adminOptions(token));
}

export async function deactivateAdminProduct(productId, token) {
  requireProductId(productId);
  return adminApiRequest.delete(`/admin/products/${productId}`, adminOptions(token));
}

export async function getAdminProductImages(productId, token) {
  requireProductId(productId);
  return adminApiRequest.get(`/admin/products/${productId}/images`, adminOptions(token));
}

export async function uploadAdminProductImages(productId, files, token, onUploadProgress) {
  requireProductId(productId);
  const options = adminOptions(token);
  const selectedFiles = validateAdminProductImages(files);

  const imageResponse = await adminApiRequest.get(`/admin/products/${productId}/images`, options);
  const currentImages = imageResponse?.product?.images;
  if (!Array.isArray(currentImages)) {
    throw new ApiError('The server returned invalid product image data.', {
      code: 'INVALID_IMAGE_RESPONSE',
    });
  }
  if (currentImages.length + selectedFiles.length > ADMIN_MAX_PRODUCT_IMAGES) {
    throw new ApiError('A product can have no more than five images in total.', {
      status: 409,
      code: 'IMAGE_LIMIT',
    });
  }

  const formData = new FormData();
  selectedFiles.forEach((file) => formData.append('images', file, file.name || 'product-image'));
  return adminApiRequest.post(`/admin/products/${productId}/images`, formData, {
    ...options,
    onUploadProgress: onUploadProgress
      ? ({ loaded, total }) => {
          if (Number.isFinite(total) && total > 0) {
            onUploadProgress(Math.min(100, Math.round((loaded / total) * 100)));
          }
        }
      : undefined,
  });
}

export async function deleteAdminProductImage(productId, imageId, token) {
  requireProductId(productId);
  if (typeof imageId !== 'string' || !imageIdPattern.test(imageId)) {
    throw new ApiError('Invalid product image ID.', { status: 400, code: 'INVALID_IMAGE_ID' });
  }
  return adminApiRequest.delete(
    `/admin/products/${productId}/images/${imageId}`,
    adminOptions(token),
  );
}

export async function setAdminProductMainImage(productId, imageId, token) {
  requireProductId(productId);
  if (typeof imageId !== 'string' || !imageIdPattern.test(imageId)) {
    throw new ApiError('Invalid product image ID.', { status: 400, code: 'INVALID_IMAGE_ID' });
  }
  return adminApiRequest.patch(
    `/admin/products/${productId}/images/${imageId}/main`,
    {},
    adminOptions(token),
  );
}
