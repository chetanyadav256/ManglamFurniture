import Category from '../models/Category.js';

export function serializeCategory(category) {
  if (!category) return null;
  return {
    id: String(category._id),
    name: category.name,
    slug: category.slug,
    ...(category.description != null ? { description: category.description } : {}),
  };
}

export async function getCategories(req, res) {
  if (Object.keys(req.query).length) return res.status(400).json({ message: 'This endpoint does not accept query parameters.' });
  const categories = await Category.find({})
    .select('name slug description')
    .collation({ locale: 'en', strength: 2 })
    .sort({ name: 1, _id: 1 })
    .maxTimeMS(5000)
    .lean();
  res.json({ categories: categories.map(serializeCategory) });
}
