import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Package, Shapes, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import usePageTitle from '../../hooks/usePageTitle';
import { ApiError, getCategories, getProducts } from '../../services/api';
import { useAdminAuth } from '../context/AdminAuthContext';
import StatsCard from '../components/StatsCard';
import ProductTable from '../components/ProductTable';
import {
  AddProductLink,
  AdminPageHeading,
  EmptyState,
  FormAlert,
  panelClass,
} from '../components/AdminUI';

const placeholderImage = '/images/living-room.webp';
const isId = (value) => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);

async function loadDashboardData() {
  const [{ categories }, firstPage] = await Promise.all([
    getCategories(),
    getProducts({ page: 1, limit: 5 }),
  ]);
  if (
    !Array.isArray(categories) ||
    categories.some(
      (category) =>
        !category ||
        !isId(category.id) ||
        typeof category.name !== 'string' ||
        typeof category.slug !== 'string',
    )
  ) {
    throw new ApiError('The server returned invalid category data.', {
      code: 'INVALID_CATEGORY_RESPONSE',
    });
  }
  if (
    !Array.isArray(firstPage?.products) ||
    firstPage.pagination?.page !== 1 ||
    firstPage.pagination?.limit !== 5 ||
    !Number.isInteger(firstPage.pagination?.total) ||
    firstPage.pagination.total < 0 ||
    firstPage.products.length > 5
  ) {
    throw new ApiError('The server returned invalid product data.', {
      code: 'INVALID_PRODUCT_RESPONSE',
    });
  }

  const categoryCounts = await Promise.all(
    categories.map(async (category) => {
      const result = await getProducts({ category: category.slug, page: 1, limit: 1 });
      if (
        !Array.isArray(result?.products) ||
        result.pagination?.page !== 1 ||
        result.pagination?.limit !== 1 ||
        !Number.isInteger(result.pagination?.total) ||
        result.pagination.total < 0
      ) {
        throw new ApiError('The server returned invalid category product counts.', {
          code: 'INVALID_PRODUCT_RESPONSE',
        });
      }
      return [category.id, result.pagination.total];
    }),
  );

  return {
    categories,
    products: firstPage.products.map((product) => ({
      ...product,
      category: product.category?.id ?? '',
      image: product.images?.[0]?.url || placeholderImage,
      tags: Array.isArray(product.tags) ? product.tags : [],
    })),
    activeProductCount: firstPage.pagination.total,
    categoryCounts: Object.fromEntries(categoryCounts),
  };
}

export default function AdminDashboard() {
  usePageTitle('Admin overview');
  const { logout } = useAdminAuth();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const result = await loadDashboardData();
      if (requestId.current === currentRequest) {
        setDashboard(result);
        setLoading(false);
      }
    } catch (issue) {
      if (requestId.current === currentRequest) {
        if (issue.status === 401 || issue.status === 403) logout();
        setError(issue.message);
        setLoading(false);
      }
    }
  }, [logout]);

  useEffect(() => {
    refresh();
    return () => {
      requestId.current += 1;
    };
  }, [refresh]);

  const categories = dashboard?.categories ?? [];
  const products = dashboard?.products ?? [];
  const categoryCounts = dashboard?.categoryCounts ?? {};
  const categoriesWithProducts = categories.filter((category) => categoryCounts[category.id] > 0);

  return (
    <>
      <AdminPageHeading
        title="Your collection, at a glance."
        description="A little organisation behind every beautiful room."
        action={<AddProductLink />}
      />
      {error && (
        <div className="mb-6">
          <FormAlert>{error}</FormAlert>
          <button
            type="button"
            className="min-h-11 text-xs text-walnut underline"
            disabled={loading}
            onClick={refresh}
          >
            Retry loading overview
          </button>
        </div>
      )}
      <div className="mb-7 grid gap-4 sm:grid-cols-3">
        <div data-testid="dashboard-stat-active-products">
          <StatsCard
            icon={Package}
            label="Active products"
            value={loading ? '…' : (dashboard?.activeProductCount ?? '—')}
            description="Active catalog pieces · inactive products excluded"
          />
        </div>
        <div data-testid="dashboard-stat-categories">
          <StatsCard
            icon={Shapes}
            label="Total categories"
            value={loading ? '…' : dashboard ? categories.length : '—'}
            description="Categories available in the catalog"
          />
        </div>
        <div data-testid="dashboard-stat-categories-with-products">
          <StatsCard
            icon={Shapes}
            label="Categories with active products"
            value={loading ? '…' : dashboard ? categoriesWithProducts.length : '—'}
            description="Categories containing at least one active product"
          />
        </div>
      </div>
      <div className="mb-8 grid items-stretch gap-5 xl:grid-cols-[1.35fr_1fr]">
        <section className={panelClass}>
          <div className="mb-6 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl text-walnut">A place for every piece.</h2>
              <p className="mt-1 text-xs leading-6 text-bark">Active products by category</p>
            </div>
            <Shapes size={20} className="text-warm" />
          </div>
          {loading ? (
            <p role="status" className="text-sm text-bark">
              Loading category distribution…
            </p>
          ) : !dashboard ? (
            <p className="text-sm text-bark">Category distribution is unavailable right now.</p>
          ) : categories.length ? (
            <div className="space-y-4">
              {categories.map((category) => {
                const count = categoryCounts[category.id] ?? 0;
                return (
                  <div key={category.id}>
                    <div className="mb-2 flex justify-between gap-3 text-xs">
                      <Link
                        to={`/admin/products?category=${category.id}`}
                        className="min-w-0 truncate text-walnut hover:underline"
                      >
                        {category.name}
                      </Link>
                      <span className="shrink-0 text-bark">
                        {count} {count === 1 ? 'piece' : 'pieces'}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-cream" aria-hidden="true">
                      <div
                        className="h-full rounded-full bg-warm"
                        style={{
                          width: `${dashboard.activeProductCount ? (count / dashboard.activeProductCount) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-bark">Add a category to begin organising your collection.</p>
          )}
        </section>
        <section className="relative isolate flex min-h-64 flex-col justify-end overflow-hidden rounded-xl bg-walnut p-7 text-cream">
          <img
            src="/images/living-room.webp"
            alt=""
            className="absolute inset-0 -z-20 h-full w-full object-cover"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-walnut via-walnut/80 to-walnut/20" />
          <Sparkles size={25} strokeWidth={1.2} className="mb-6 text-[#e2bc9c]" />
          <p className="eyebrow mb-3 text-[#e2bc9c]">Thoughtful details matter</p>
          <h2 className="max-w-xs font-display text-4xl leading-tight">
            Make every piece
            <br />
            feel right at home.
          </h2>
          <p className="mt-4 max-w-sm text-xs leading-7 text-cream/85">
            Add clear photographs, useful dimensions, and descriptive tags to help people discover
            their next favourite.
          </p>
          <Link
            to="/admin/products/new"
            className="mt-6 inline-flex min-h-11 items-center gap-3 self-start border-b border-cream/40 text-xs"
          >
            Create a product
            <ArrowUpRight size={16} />
          </Link>
        </section>
      </div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl text-walnut">Recently added</h2>
          <p className="mt-1 text-xs text-bark">Latest active products in the catalog.</p>
        </div>
        <Link to="/admin/products" className="text-link">
          View all products
          <ArrowUpRight size={16} />
        </Link>
      </div>
      {loading ? (
        <p role="status" className="py-10 text-center text-sm text-bark">
          Loading recent products…
        </p>
      ) : !dashboard ? (
        <p role="status" className="py-10 text-center text-sm text-bark">
          Recent products are unavailable right now.
        </p>
      ) : products.length ? (
        <ProductTable products={products} categories={categories} />
      ) : (
        <EmptyState icon={Package} title="Your collection starts here." action={<AddProductLink />}>
          Add your first product to the catalog.
        </EmptyState>
      )}
    </>
  );
}
