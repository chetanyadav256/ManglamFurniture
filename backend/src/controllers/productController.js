import Product from '../models/Product.js';
import Category from '../models/Category.js';
import { serializeCategory } from './categoryController.js';

const fields = 'name category price description images material color dimensions tags createdAt updatedAt';
const categoryPopulation = { path: 'category', select: 'name slug description', options: { maxTimeMS: 5000 } };
const sorts = {
  price_asc: { price: 1, _id: 1 },
  price_desc: { price: -1, _id: -1 },
  newest: { createdAt: -1, _id: -1 },
  oldest: { createdAt: 1, _id: 1 },
};
const allowed = new Set(['search', 'category', 'minPrice', 'maxPrice', 'sort', 'page', 'limit']);

function badQuery(message) {
  const error = new Error(message);
  error.status = 400;
  throw error;
}

function parseQuery(query) {
  for (const [key, value] of Object.entries(query)) {
    if (!allowed.has(key) || typeof value !== 'string') badQuery('Unsupported or repeated query parameter.');
  }
  const integer = (key, fallback, max) => {
    if (query[key] === undefined) return fallback;
    if (!/^[1-9]\d*$/.test(query[key])) badQuery(`${key} must be a positive integer.`);
    const value = Number(query[key]);
    if (!Number.isSafeInteger(value) || value > max) badQuery(`${key} exceeds the supported maximum.`);
    return value;
  };
  const price = (key) => {
    if (query[key] === undefined) return undefined;
    if (!/^\d+(?:\.\d+)?$/.test(query[key])) badQuery(`${key} must be a non-negative decimal number.`);
    const value = Number(query[key]);
    if (!Number.isFinite(value) || value > Number.MAX_SAFE_INTEGER) badQuery(`${key} exceeds the supported maximum.`);
    return value;
  };
  const page = integer('page', 1, Number.MAX_SAFE_INTEGER);
  const limit = integer('limit', 12, 100);
  if (!Number.isSafeInteger((page - 1) * limit)) badQuery('Pagination offset is too large.');
  const minPrice = price('minPrice');
  const maxPrice = price('maxPrice');
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) badQuery('minPrice must not exceed maxPrice.');
  const sort = query.sort ?? 'newest';
  if (!Object.hasOwn(sorts, sort)) badQuery('Unsupported sort value.');
  if (query.search !== undefined && (!query.search.trim() || query.search.length > 100)) badQuery('Search must contain 1–100 characters.');
  const search = query.search?.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (search?.length > 100) badQuery('Search must contain 1–100 characters.');
  const category = query.category?.trim().toLowerCase();
  if (category !== undefined && (category.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category))) badQuery('Category must be a valid slug.');
  return { page, limit, minPrice, maxPrice, sort, search, category };
}

function serializeProduct(product) {
  return {
    id: String(product._id),
    name: product.name,
    category: serializeCategory(product.category),
    price: product.price,
    description: product.description,
    images: (product.images ?? []).map(({ url, publicId }) => ({ url, publicId: publicId ?? '' })),
    material: product.material ?? '',
    color: product.color ?? '',
    dimensions: product.dimensions ? {
      length: product.dimensions.length,
      width: product.dimensions.width,
      height: product.dimensions.height,
    } : {},
    tags: product.tags ?? [],
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export async function getProducts(req, res) {
  let options;
  try {
    options = parseQuery(req.query);
  } catch (error) {
    if (error.status !== 400) throw error;
    return res.status(400).json({ message: error.message });
  }
  const { page, limit, minPrice, maxPrice, sort, search, category } = options;
  const result = (products, total) => ({ products, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  const filter = { isActive: true };
  if (category !== undefined) {
    const match = await Category.findOne({ slug: category }).select('_id').maxTimeMS(5000).lean();
    if (!match) return res.json(result([], 0));
    filter.category = match._id;
  }
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = ['name', 'description', 'tags'].map((field) => ({ [field]: { $regex: escaped, $options: 'i' } }));
  }
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {
      ...(minPrice !== undefined ? { $gte: minPrice } : {}),
      ...(maxPrice !== undefined ? { $lte: maxPrice } : {}),
    };
  }
  const [products, total] = await Promise.all([
    Product.find(filter).select(fields).populate(categoryPopulation)
      .sort(sorts[sort]).skip((page - 1) * limit).limit(limit).maxTimeMS(5000).lean(),
    Product.countDocuments(filter).maxTimeMS(5000),
  ]);
  res.json(result(products.map(serializeProduct), total));
}

export async function getProduct(req, res) {
  if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ message: 'Invalid product ID.' });
  if (Object.keys(req.query).length) return res.status(400).json({ message: 'This endpoint does not accept query parameters.' });
  const product = await Product.findOne({ _id: req.params.id, isActive: true })
    .select(fields).populate(categoryPopulation).maxTimeMS(5000).lean();
  if (!product) return res.status(404).json({ message: 'Product not found.' });
  res.json({ product: serializeProduct(product) });
}
