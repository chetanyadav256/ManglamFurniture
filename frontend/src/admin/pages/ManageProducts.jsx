import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, PackageSearch, Search } from 'lucide-react';
import usePageTitle from '../../hooks/usePageTitle';
import { useAdminPreview } from '../context/AdminPreviewContext';
import { normalizeTag } from '../services/adminMockService';
import { AddProductLink, AdminPageHeading, EmptyState } from '../components/AdminUI';
import ProductTable from '../components/ProductTable';
import ConfirmDialog from '../components/ConfirmDialog';

export default function ManageProducts() {
  usePageTitle('Manage products');
  const { products, categories, run, notify } = useAdminPreview();
  const [params] = useSearchParams();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(params.get('category') || '');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const terms = normalizeTag(query).split(' ').filter(Boolean);
  const filtered = products
    .filter(
      (product) =>
        (!category || product.category === category) &&
        terms.every((term) =>
          normalizeTag(
            `${product.name} ${categories.find((item) => item.id === product.category)?.name || ''} ${product.tags.join(' ')}`,
          ).includes(term),
        ),
    )
    .sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name)
        : sort === 'price-asc'
          ? a.price - b.price
          : sort === 'price-desc'
            ? b.price - a.price
            : new Date(b.createdAt) - new Date(a.createdAt),
    );
  const totalPages = Math.max(1, Math.ceil(filtered.length / 8));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * 8, currentPage * 8);
  function reset() {
    setQuery('');
    setCategory('');
    setSort('newest');
    setPage(1);
  }
  async function remove() {
    setBusy(true);
    setError('');
    try {
      await run('deleteProduct', selected.id);
      notify(`“${selected.name}” deleted from the UI preview.`);
      setSelected(null);
    } catch (issue) {
      setError(issue.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <AdminPageHeading
        title="Manage your products."
        description="Keep the details of your collection beautifully in order."
        action={<AddProductLink />}
      />
      <div className="mb-5 grid gap-3 rounded-xl border border-sand bg-white p-4 sm:grid-cols-2 xl:grid-cols-[1fr_190px_180px]">
        <div className="relative sm:col-span-2 xl:col-span-1">
          <label htmlFor="admin-product-search" className="sr-only">
            Search admin products
          </label>
          <Search size={17} className="pointer-events-none absolute left-3.5 top-4 text-bark" />
          <input
            id="admin-product-search"
            type="search"
            className="field rounded-md pl-10"
            placeholder="Search names, categories, or tags…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          aria-label="Filter by category"
          className="field rounded-md"
          value={category}
          onChange={(event) => {
            setCategory(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All categories</option>
          {categories.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Sort admin products"
          className="field rounded-md"
          value={sort}
          onChange={(event) => {
            setSort(event.target.value);
            setPage(1);
          }}
        >
          <option value="newest">Recently added</option>
          <option value="name">Name: A–Z</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
        </select>
      </div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p role="status" className="text-xs text-bark">
          {filtered.length} {filtered.length === 1 ? 'product' : 'products'}
          {query || category ? ' found' : ' in your collection'}
        </p>
        {(query || category) && (
          <button className="min-h-11 text-xs text-walnut underline" onClick={reset}>
            Clear filters
          </button>
        )}
      </div>
      {visible.length ? (
        <ProductTable
          products={visible}
          categories={categories}
          onDelete={(product) => {
            setError('');
            setSelected(product);
          }}
        />
      ) : (
        <EmptyState
          icon={PackageSearch}
          title={products.length ? 'No matching pieces.' : 'A fresh start for your collection.'}
          action={
            products.length ? (
              <button className="btn-outline rounded-md" onClick={reset}>
                Clear filters
              </button>
            ) : (
              <AddProductLink />
            )
          }
        >
          {products.length
            ? 'Try a different name, tag, or category.'
            : 'Add your first product to see it here.'}
        </EmptyState>
      )}
      {filtered.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-bark">
            Showing {(currentPage - 1) * 8 + 1}–{Math.min(currentPage * 8, filtered.length)} of{' '}
            {filtered.length}
          </p>
          <nav aria-label="Product pagination" className="flex items-center gap-2">
            <button
              className="icon-button border border-sand bg-white disabled:opacity-40"
              aria-label="Previous product page"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft size={17} />
            </button>
            <span className="px-2 text-xs">
              {currentPage} / {totalPages}
            </span>
            <button
              className="icon-button border border-sand bg-white disabled:opacity-40"
              aria-label="Next product page"
              disabled={currentPage === totalPages}
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRight size={17} />
            </button>
          </nav>
        </div>
      )}
      <ConfirmDialog
        open={Boolean(selected)}
        title="Delete this product?"
        busy={busy}
        error={error}
        onClose={() => setSelected(null)}
        onConfirm={remove}
      >
        <p>
          <strong className="text-walnut">{selected?.name}</strong> will be removed from the local
          preview. This cannot be undone within this preview; refreshing restores the original
          samples.
        </p>
      </ConfirmDialog>
    </>
  );
}
