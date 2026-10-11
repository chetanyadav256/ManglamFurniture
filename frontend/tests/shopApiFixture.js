import { expect } from '@playwright/test';
import { categories, filterProducts } from '../src/data/catalog.js';

export const apiCategories = categories.map((category, index) => ({
  id: (index + 100).toString(16).padStart(24, '0'),
  slug: category.id,
  name: category.name,
  description: category.description,
}));
export const apiProducts = filterProducts({}).map((product, index) => ({
  ...product,
  id: (index + 1).toString(16).padStart(24, '0'),
  category: apiCategories.find((category) => category.slug === product.category),
  images: [{ url: product.image, publicId: '' }],
  createdAt: new Date(Date.UTC(2026, 0, 31 - index)).toISOString(),
  featured: undefined,
}));

export async function mockShopApi(page, options = {}) {
  const state = {
    products: apiProducts,
    categories: apiCategories,
    requests: [],
    failProducts: false,
    failCategories: false,
    pageSize: 100,
    ...options,
  };
  await page.route(/\/api\/(products|categories)(\?|$)/, async (route) => {
    const url = new URL(route.request().url());
    state.requests.push(url);
    expect(route.request().headers().authorization).toBeUndefined();
    const headers = { 'access-control-allow-origin': '*' };
    if (url.pathname.endsWith('/categories')) {
      return route.fulfill({
        status: state.failCategories ? 500 : 200,
        headers,
        json: state.failCategories ? { message: 'Error' } : { categories: state.categories },
      });
    }
    const params = Object.fromEntries(url.searchParams);
    expect(
      Object.keys(params).every((key) =>
        ['search', 'category', 'minPrice', 'maxPrice', 'sort', 'page', 'limit'].includes(key),
      ),
    ).toBe(true);
    if (state.failProducts)
      return route.fulfill({ status: 500, headers, json: { message: 'Error' } });
    if (params.search && params.search.trim().length > 100) {
      return route.fulfill({
        status: 400,
        headers,
        json: { message: 'Search must contain 1–100 characters.' },
      });
    }
    const search = params.search?.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
    let found = state.products.filter(
      (product) =>
        (!params.category || product.category?.slug === params.category) &&
        (!search ||
          `${product.name} ${product.description} ${product.tags.join(' ')}`
            .toLowerCase()
            .includes(search)) &&
        (params.minPrice === undefined || product.price >= Number(params.minPrice)) &&
        (params.maxPrice === undefined || product.price <= Number(params.maxPrice)),
    );
    found = [...found].sort((a, b) =>
      params.sort === 'price_asc'
        ? a.price - b.price
        : params.sort === 'price_desc'
          ? b.price - a.price
          : b.createdAt.localeCompare(a.createdAt),
    );
    const pageNumber = Number(params.page || 1);
    const limit = Math.min(Number(params.limit || 12), state.pageSize);
    return route.fulfill({
      headers,
      json: {
        products: found.slice((pageNumber - 1) * limit, pageNumber * limit),
        pagination: {
          total: found.length,
          page: pageNumber,
          limit,
          totalPages: Math.ceil(found.length / limit),
        },
      },
    });
  });
  return state;
}
