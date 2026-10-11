import { products as sampleProducts, categories as sampleCategories } from '../../data/catalog';

export const normalizeTag = (value) =>
  value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
export const normalizeName = (value) => value.normalize('NFKC').trim().replace(/\s+/g, ' ');
export const IMAGE_LIMIT = 5;
export const IMAGE_SIZE_LIMIT = 5 * 1024 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const formatAdminPrice = (price) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price);
export const formatDate = (value) =>
  new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));

export function validateProduct(values, categories, { requireImages = true } = {}) {
  const errors = {};
  if (!values.name.trim() || values.name.trim().length > 120)
    errors.name = 'Enter a product name of 1–120 characters.';
  if (!categories.some((category) => category.id === values.category))
    errors.category = 'Choose an available category.';
  if (
    values.price === '' ||
    !Number.isFinite(Number(values.price)) ||
    Number(values.price) <= 0 ||
    Number(values.price) > 100000000 ||
    !/^\d+(\.\d{1,2})?$/.test(String(values.price))
  )
    errors.price = 'Enter a positive price, up to ₹10,00,00,000, with no more than two decimals.';
  if (values.description.trim().length < 10 || values.description.length > 4000)
    errors.description = 'Use 10–4,000 characters to describe this piece.';
  for (const key of ['material', 'color'])
    if (!values[key].trim() || values[key].length > 120)
      errors[key] = `Enter ${key} details of 1–120 characters.`;
  for (const key of ['length', 'width', 'height'])
    if (
      !Number.isFinite(Number(values[key])) ||
      Number(values[key]) <= 0 ||
      Number(values[key]) > 10000
    )
      errors[key] = 'Use a dimension greater than 0 and no more than 10,000 cm.';
  if (requireImages && (!values.images.length || values.images.length > IMAGE_LIMIT))
    errors.images = `Add between 1 and ${IMAGE_LIMIT} images.`;
  if (
    values.tags.length > 12 ||
    values.tags.some((tag) => !normalizeTag(tag) || normalizeTag(tag).length > 40)
  )
    errors.tags = 'Use up to 12 tags, each no longer than 40 characters.';
  return errors;
}

// Dashboard counts and category/settings preview actions remain local. Product
// CRUD is handled separately by the authenticated Admin Product API service.
export function createAdminMockService() {
  const now = Date.now();
  let state = {
    categories: sampleCategories.map((category) => ({ ...category })),
    products: sampleProducts.map((product, index) => {
      const [width, length, height] = product.dimensions.match(/[\d.]+/g).map(Number);
      return {
        ...product,
        tags: [...product.tags],
        images: product.images.map((image, imageIndex) => ({
          ...image,
          id: `${product.id}-image-${imageIndex}`,
        })),
        dimensionValues: { length, width, height },
        createdAt: new Date(now - index * 3 * 86400000).toISOString(),
        updatedAt: null,
      };
    }),
    profile: { name: 'Admin preview', email: '' },
  };
  const delay = () => new Promise((resolve) => setTimeout(resolve, 220));
  const snapshot = () => ({
    ...state,
    products: [...state.products],
    categories: [...state.categories],
    profile: { ...state.profile },
  });
  function categoryName(name, excludingId) {
    const clean = normalizeName(name);
    if (!clean || clean.length > 60) throw new Error('Enter a category name of 1–60 characters.');
    if (
      state.categories.some(
        (category) =>
          category.id !== excludingId && normalizeTag(category.name) === normalizeTag(clean),
      )
    )
      throw new Error('A category with this name already exists.');
    return clean;
  }
  return {
    getSnapshot: snapshot,
    async saveCategory(name, id) {
      await delay();
      if (id && !state.categories.some((category) => category.id === id))
        throw new Error('This category no longer exists.');
      const clean = categoryName(name, id);
      const saved = {
        ...(state.categories.find((category) => category.id === id) || {}),
        id: id || crypto.randomUUID(),
        name: clean,
      };
      state = {
        ...state,
        categories: id
          ? state.categories.map((category) => (category.id === id ? saved : category))
          : [...state.categories, saved],
      };
      return saved;
    },
    async deleteCategory(id) {
      await delay();
      if (state.products.some((product) => product.category === id))
        throw new Error('Move or delete the products in this category before removing it.');
      if (!state.categories.some((category) => category.id === id))
        throw new Error('This category no longer exists.');
      state = { ...state, categories: state.categories.filter((category) => category.id !== id) };
    },
    async saveProfile(profile) {
      await delay();
      const name = normalizeName(profile.name);
      if (!name || name.length > 80) throw new Error('Enter a name of 1–80 characters.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim()))
        throw new Error('Enter a valid preview email address.');
      state = { ...state, profile: { name, email: profile.email.trim() } };
    },
  };
}

export async function readPreviewImage(file) {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error(`${file.name}: use JPEG, PNG, or WebP.`);
  if (!file.size || file.size > IMAGE_SIZE_LIMIT)
    throw new Error(`${file.name}: image must be between 1 byte and 5 MB.`);
  const src = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`${file.name}: could not read this file.`));
    reader.readAsDataURL(file);
  });
  const image = new Image();
  image.src = src;
  try {
    await image.decode();
  } catch {
    throw new Error(`${file.name}: this file is not a readable image.`);
  }
  return { id: crypto.randomUUID(), src, label: file.name, file, zoom: 1, position: 'center' };
}
