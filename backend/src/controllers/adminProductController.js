import Category from '../models/Category.js';
import Product from '../models/Product.js';
import { acquireCategoryReferenceWrite, withCategoryReferenceTransaction } from '../services/categoryReferenceTransaction.js';

const allowedFields = new Set([
  'name', 'category', 'price', 'description', 'material', 'color',
  'dimensions', 'tags', 'isActive', 'images',
]);
const dimensionFields = new Set(['length', 'width', 'height']);

function invalid(message) {
  return { status: 400, message };
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateProductBody(body, partial = false) {
  if (!isRecord(body)) return { error: invalid('Request body must be a JSON object.') };
  const keys = Object.keys(body);
  if (keys.some((key) => !allowedFields.has(key))) {
    return { error: invalid('Request contains unsupported product fields.') };
  }
  if (!partial && ['name', 'category', 'price', 'description'].some((key) => !Object.hasOwn(body, key))) {
    return { error: invalid('Name, category, price, and description are required.') };
  }
  if (partial && keys.length === 0) return { error: invalid('Provide at least one product field to update.') };

  const values = { ...body };
  if (Object.hasOwn(values, 'name')) {
    if (typeof values.name !== 'string') {
      return { error: invalid('Name must contain 1-120 characters.') };
    }
    values.name = values.name.normalize('NFKC').trim().replace(/\s+/g, ' ');
    if (!values.name || values.name.length > 120) {
      return { error: invalid('Name must contain 1-120 characters.') };
    }
  }
  if (Object.hasOwn(values, 'category')
    && (typeof values.category !== 'string' || !/^[a-f\d]{24}$/i.test(values.category))) {
    return { error: invalid('Category must be a valid category ID.') };
  }
  if (Object.hasOwn(values, 'price')
    && (typeof values.price !== 'number' || !Number.isFinite(values.price) || values.price < 0)) {
    return { error: invalid('Price must be a finite non-negative number.') };
  }
  if (Object.hasOwn(values, 'description')) {
    if (typeof values.description !== 'string') return { error: invalid('Description must contain 1-4000 characters.') };
    values.description = values.description.normalize('NFKC').trim();
    if (!values.description || values.description.length > 4000) {
      return { error: invalid('Description must contain 1-4000 characters.') };
    }
  }
  for (const key of ['material', 'color']) {
    if (Object.hasOwn(values, key)
      && (typeof values[key] !== 'string' || values[key].length > 200)) {
      return { error: invalid(`${key} must be a string of at most 200 characters.`) };
    }
    if (typeof values[key] === 'string') values[key] = values[key].normalize('NFKC').trim();
  }
  if (Object.hasOwn(values, 'dimensions')) {
    if (!isRecord(values.dimensions)
      || Object.keys(values.dimensions).some((key) => !dimensionFields.has(key))
      || Object.values(values.dimensions).some((value) => typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
      return { error: invalid('Dimensions must contain only non-negative numeric length, width, and height values.') };
    }
  }
  if (Object.hasOwn(values, 'tags')) {
    if (!Array.isArray(values.tags)
      || values.tags.some((tag) => typeof tag !== 'string' || tag.trim().length > 40)) {
      return { error: invalid('Tags must be an array of up to 12 strings, each at most 40 characters.') };
    }
    values.tags = [...new Set(values.tags.map((tag) => tag.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ')).filter(Boolean))];
    if (values.tags.length > 12 || values.tags.some((tag) => tag.length > 40)) {
      return { error: invalid('Tags must be an array of up to 12 strings, each at most 40 characters.') };
    }
  }
  if (Object.hasOwn(values, 'isActive') && typeof values.isActive !== 'boolean') {
    return { error: invalid('isActive must be a boolean.') };
  }
  if (Object.hasOwn(values, 'images')) {
    if (partial) return { error: invalid('Use the image upload and management endpoints to change images.') };
    if (!Array.isArray(values.images) || values.images.length > 5 || values.images.some((image) => {
      if (!isRecord(image)
        || Object.keys(image).some((key) => !['url', 'publicId'].includes(key))
        || typeof image.url !== 'string'
        || image.publicId !== undefined && image.publicId !== '') return true;
      if (/^\/(?!\/)[^\s\\]+$/.test(image.url)) return false;
      try {
        const url = new URL(image.url);
        return !['http:', 'https:'].includes(url.protocol) || Boolean(url.username || url.password);
      } catch {
        return true;
      }
    })) {
      return { error: invalid('Images must contain only valid url and optional publicId metadata.') };
    }
    values.images = values.images.map(({ url, publicId = '' }) => ({ url: url.trim(), publicId: publicId.trim() }));
  }
  return { values };
}

export function serializeProduct(product) {
  return {
    id: String(product._id),
    name: product.name,
    category: String(product.category?._id ?? product.category),
    price: product.price,
    description: product.description,
    images: (product.images ?? []).map(({ url, publicId }) => ({ url, publicId: publicId ?? '' })),
    material: product.material ?? '',
    color: product.color ?? '',
    dimensions: product.dimensions ?? {},
    tags: product.tags ?? [],
    isActive: product.isActive,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export async function createAdminProduct(req, res) {
  const { values, error } = validateProductBody(req.body);
  if (error) return res.status(error.status).json({ message: error.message });
  const result = await withCategoryReferenceTransaction(async (session) => {
    if (!(await acquireCategoryReferenceWrite(values.category, session))) {
      return { status: 400, body: { message: 'Category does not exist.' } };
    }
    const [product] = await Product.create([values], { session });
    return { status: 201, body: { product: serializeProduct(product) } };
  });
  return res.status(result.status).json(result.body);
}

export async function updateAdminProduct(req, res) {
  if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ message: 'Invalid product ID.' });
  const { values, error } = validateProductBody(req.body, true);
  if (error) return res.status(error.status).json({ message: error.message });
  if (Object.hasOwn(values, 'category')) {
    const result = await withCategoryReferenceTransaction(async (session) => {
      if (!(await acquireCategoryReferenceWrite(values.category, session))) {
        return { status: 400, body: { message: 'Category does not exist.' } };
      }
      const product = await Product.findByIdAndUpdate(
        req.params.id,
        { $set: values },
        { new: true, runValidators: true, session },
      ).lean();
      if (!product) return { status: 404, body: { message: 'Product not found.' } };
      return { status: 200, body: { product: serializeProduct(product) } };
    });
    return res.status(result.status).json(result.body);
  }
  const product = await Product.findByIdAndUpdate(
    req.params.id,
    { $set: values },
    { new: true, runValidators: true },
  ).lean();
  if (!product) return res.status(404).json({ message: 'Product not found.' });
  return res.json({ product: serializeProduct(product) });
}

export async function deactivateAdminProduct(req, res) {
  if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ message: 'Invalid product ID.' });
  const product = await Product.findByIdAndUpdate(
    req.params.id,
    { $set: { isActive: false } },
    { new: true, runValidators: true },
  ).select('_id').lean();
  if (!product) return res.status(404).json({ message: 'Product not found.' });
  return res.json({ message: 'Product deactivated.', productId: String(product._id) });
}
