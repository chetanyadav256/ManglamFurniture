import Category from '../models/Category.js';
import Product from '../models/Product.js';
import { verifyCategoryUniqueIndexes } from '../config/categoryIndexes.js';
import { withCategoryReferenceTransaction } from '../services/categoryReferenceTransaction.js';

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeCategoryName(name) {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ');
}

function createSlug(name) {
  return name.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function validateCategoryBody(body, partial = false) {
  const allowedFields = new Set(['name', 'description']);
  if (!isRecord(body) || Object.keys(body).some((key) => !allowedFields.has(key))) {
    return { error: 'Request body must be a JSON object containing only name and description.' };
  }
  if (Object.keys(body).length === 0) return { error: 'Provide category fields to save.' };
  if (!partial && !Object.hasOwn(body, 'name')) return { error: 'Name is required.' };

  const values = {};
  if (Object.hasOwn(body, 'name')) {
    if (typeof body.name !== 'string') return { error: 'Name must be a string.' };
    values.name = normalizeCategoryName(body.name);
    if (!values.name || values.name.length > 60) return { error: 'Name must contain 1-60 characters.' };
    values.slug = createSlug(values.name);
    if (!values.slug) return { error: 'Name must contain characters that can form a URL slug.' };
  }
  if (Object.hasOwn(body, 'description')) {
    if (typeof body.description !== 'string' || body.description.length > 4000) {
      return { error: 'Description must be a string of at most 4000 characters.' };
    }
    values.description = body.description.normalize('NFKC').trim();
  }
  return { values };
}

function serializeCategory(category) {
  return {
    id: String(category._id),
    name: category.name,
    slug: category.slug,
    ...(category.description != null ? { description: category.description } : {}),
    ...(category.createdAt != null ? { createdAt: category.createdAt } : {}),
    ...(category.updatedAt != null ? { updatedAt: category.updatedAt } : {}),
  };
}

function isDuplicateKey(error) {
  return error?.code === 11000;
}

async function requireCategoryIndexes(res) {
  if (!(await verifyCategoryUniqueIndexes())) {
    res.status(503).json({ message: 'Category unique indexes are not configured. Run the controlled category-index setup script.' });
    return false;
  }
  return true;
}

export async function createAdminCategory(req, res) {
  const { values, error } = validateCategoryBody(req.body);
  if (error) return res.status(400).json({ message: error });
  if (!(await requireCategoryIndexes(res))) return undefined;

  try {
    const duplicateName = await Category.findOne({ name: values.name })
      .collation({ locale: 'en', strength: 2 }).lean();
    if (duplicateName) return res.status(409).json({ message: 'A category with that name already exists.' });
    const duplicateSlug = await Category.findOne({ slug: values.slug }).lean();
    if (duplicateSlug) return res.status(409).json({ message: 'A category with that slug already exists.' });
    const category = await Category.create(values);
    return res.status(201).json({ category: serializeCategory(category) });
  } catch (createError) {
    if (isDuplicateKey(createError)) return res.status(409).json({ message: 'A category with that name or slug already exists.' });
    throw createError;
  }
}

export async function updateAdminCategory(req, res) {
  if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ message: 'Invalid category ID.' });
  const { values, error } = validateCategoryBody(req.body, true);
  if (error) return res.status(400).json({ message: error });
  if (!(await requireCategoryIndexes(res))) return undefined;
  const existing = await Category.findById(req.params.id).lean();
  if (!existing) return res.status(404).json({ message: 'Category not found.' });

  try {
    if (Object.hasOwn(values, 'name')) {
      const duplicateName = await Category.findOne({
        _id: { $ne: req.params.id },
        name: values.name,
      }).collation({ locale: 'en', strength: 2 }).lean();
      if (duplicateName) return res.status(409).json({ message: 'A category with that name already exists.' });

      const duplicateSlug = await Category.findOne({
        _id: { $ne: req.params.id },
        slug: values.slug,
      }).lean();
      if (duplicateSlug) return res.status(409).json({ message: 'A category with that slug already exists.' });
    }
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { $set: values },
      { new: true, runValidators: true },
    ).lean();
    if (!category) return res.status(404).json({ message: 'Category not found.' });
    return res.json({ category: serializeCategory(category) });
  } catch (updateError) {
    if (isDuplicateKey(updateError)) return res.status(409).json({ message: 'A category with that name or slug already exists.' });
    throw updateError;
  }
}

export async function deleteAdminCategory(req, res) {
  if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ message: 'Invalid category ID.' });
  const result = await withCategoryReferenceTransaction(async (session) => {
    const category = await Category.findById(req.params.id)
      .select('_id').session(session).lean();
    if (!category) return { status: 404, body: { message: 'Category not found.' } };
    const productReference = await Product.exists({ category: category._id }).session(session);
    if (productReference) {
      return {
        status: 409,
        body: { message: 'Category cannot be deleted while products reference it.' },
      };
    }
    const deletion = await Category.deleteOne({ _id: category._id }, { session });
    if (deletion.deletedCount !== 1) {
      return { status: 404, body: { message: 'Category not found.' } };
    }
    return {
      status: 200,
      body: { message: 'Category deleted.', categoryId: String(category._id) },
    };
  });
  return res.status(result.status).json(result.body);
}
