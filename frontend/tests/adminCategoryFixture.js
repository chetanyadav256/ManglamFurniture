import { apiCategories, apiProducts } from './shopApiFixture';

const createdId = '507f1f77bcf86cd799439087';

function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function mockAdminCategoryApi(page, options = {}) {
  const state = {
    categories: apiCategories.map((category) => ({ ...category })),
    products: apiProducts.map((product) => ({
      ...product,
      category: { ...product.category },
      tags: [...product.tags],
      images: [...product.images],
    })),
    ...options,
  };
  await page.route('**/api/categories', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ categories: state.categories }),
    }),
  );
  await page.route('**/api/products*', (route) => {
    const url = new URL(route.request().url());
    const pageNumber = Number(url.searchParams.get('page') || 1);
    const limit = Number(url.searchParams.get('limit') || 12);
    const found = state.products.filter((product) => {
      if (product.isActive === false) return false;
      const category = product.category;
      return (
        !url.searchParams.has('category') ||
        category?.id === url.searchParams.get('category') ||
        category?.slug === url.searchParams.get('category')
      );
    });
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        products: found.slice((pageNumber - 1) * limit, pageNumber * limit),
        pagination: {
          total: found.length,
          page: pageNumber,
          limit,
          totalPages: Math.ceil(found.length / limit),
        },
      }),
    });
  });
  await page.route('**/api/admin/categories**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const id = url.pathname.split('/').at(-1);
    state.actions ??= [];
    state.actions.push({ method: request.method(), path: url.pathname });
    if (state.unauthorized) {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Invalid or expired authentication token.' }),
      });
      return;
    }
    if (request.method() === 'POST' || request.method() === 'PATCH') {
      const payload = request.postDataJSON();
      state.lastPayload = payload;
      const existing = state.categories.find(
        (category) =>
          category.id !== id &&
          (category.name.toLocaleLowerCase() === payload.name.toLocaleLowerCase() ||
            category.slug === slugify(payload.name)),
      );
      if (existing) {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'A category with that name already exists.' }),
        });
        return;
      }
      if (request.method() === 'POST') {
        const category = {
          id: createdId,
          name: payload.name,
          slug: slugify(payload.name),
          ...(payload.description ? { description: payload.description } : {}),
        };
        state.categories.push(category);
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ category }),
        });
        return;
      }
      const category = state.categories.find((item) => item.id === id);
      if (!category) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Category not found.' }),
        });
        return;
      }
      Object.assign(category, payload, payload.name ? { slug: slugify(payload.name) } : {});
      for (const product of state.products) {
        if (product.category?.id === id) {
          product.category.name = category.name;
          product.category.slug = category.slug;
        }
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ category }),
      });
      return;
    }
    if (request.method() === 'DELETE') {
      if (state.products.some((product) => product.category?.id === id)) {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Category cannot be deleted while products reference it.',
          }),
        });
        return;
      }
      state.categories = state.categories.filter((category) => category.id !== id);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Category deleted.', categoryId: id }),
      });
      return;
    }
    await route.fallback();
  });
  return state;
}
