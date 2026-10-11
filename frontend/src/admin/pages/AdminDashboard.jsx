import { ArrowUpRight, Clock3, Package, Shapes, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import usePageTitle from '../../hooks/usePageTitle';
import { useAdminPreview } from '../context/AdminPreviewContext';
import StatsCard from '../components/StatsCard';
import ProductTable from '../components/ProductTable';
import { AddProductLink, AdminPageHeading, EmptyState, panelClass } from '../components/AdminUI';

export default function AdminDashboard() {
  usePageTitle('Admin overview');
  const { products, categories } = useAdminPreview();
  const recent = [...products].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const recentCount = products.filter(
    (product) => new Date(product.createdAt).getTime() >= Date.now() - 30 * 86400000,
  ).length;
  return (
    <>
      <AdminPageHeading
        title="Your collection, at a glance."
        description="A little organisation behind every beautiful room."
        action={<AddProductLink />}
      />
      <div className="mb-7 grid gap-4 sm:grid-cols-3">
        <StatsCard
          icon={Package}
          label="Total products"
          value={products.length}
          description="Pieces in your preview catalog"
        />
        <StatsCard
          icon={Shapes}
          label="Total categories"
          value={categories.length}
          description="Ways to explore the collection"
        />
        <StatsCard
          icon={Clock3}
          label="Recently added products"
          value={recentCount}
          description="Added in the last 30 days · mock dates"
        />
      </div>
      <div className="mb-8 grid items-stretch gap-5 xl:grid-cols-[1.35fr_1fr]">
        <section className={panelClass}>
          <div className="mb-6 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl text-walnut">A place for every piece.</h2>
              <p className="mt-1 text-xs leading-6 text-bark">Category-wise product distribution</p>
            </div>
            <Shapes size={20} className="text-warm" />
          </div>
          <div className="space-y-4">
            {categories.map((category) => {
              const count = products.filter((product) => product.category === category.id).length;
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
                      style={{ width: `${products.length ? (count / products.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {!categories.length && (
              <p className="text-sm text-bark">
                Add a category to begin organising your collection.
              </p>
            )}
          </div>
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
          <p className="mt-1 text-xs text-bark">Your latest additions to the preview collection.</p>
        </div>
        <Link to="/admin/products" className="text-link">
          View all products
          <ArrowUpRight size={16} />
        </Link>
      </div>
      {recent.length ? (
        <ProductTable products={recent.slice(0, 5)} categories={categories} />
      ) : (
        <EmptyState icon={Package} title="Your collection starts here." action={<AddProductLink />}>
          Add your first preview product.
        </EmptyState>
      )}
    </>
  );
}
