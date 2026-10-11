import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Search, SearchX, SlidersHorizontal, X } from 'lucide-react';
import Breadcrumbs from '../components/Breadcrumbs';
import CategoryCard from '../components/CategoryCard';
import FilterControls from '../components/FilterControls';
import Modal from '../components/Modal';
import ProductCard from '../components/ProductCard';
import VisitBanner from '../components/VisitBanner';
import { materials, priceOptions, sortOptions } from '../data/catalog';
import usePageTitle from '../hooks/usePageTitle';
import useShopCatalog from '../hooks/useShopCatalog';

export default function CollectionPage({ searchMode = false }) {
  const [params, setParams] = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => {
    const closeDesktopDrawer = () => {
      if (window.innerWidth >= 1024) setDrawerOpen(false);
    };
    window.addEventListener('resize', closeDesktopDrawer);
    return () => window.removeEventListener('resize', closeDesktopDrawer);
  }, []);
  const query = params.get('q') || '';
  const filters = {
    query,
    category: params.get('category') || '',
    material: materials.includes(params.get('material')) ? params.get('material') : '',
    price: priceOptions.some((option) => option.value === params.get('price'))
      ? params.get('price')
      : '',
    sort: sortOptions.some((option) => option.value === params.get('sort'))
      ? params.get('sort')
      : 'featured',
  };
  const shop = useShopCatalog(filters, true);
  const categories = shop.categories;
  const selectedCategory = categories.find((category) => category.id === filters.category);
  const loading = shop.loading;
  const error = shop.error;
  const results = loading || error ? [] : shop.results;
  const filterCount = [filters.category, filters.material, filters.price].filter(Boolean).length;
  usePageTitle(searchMode ? (query ? `Search: ${query}` : 'Search furniture') : 'Our collection');

  function update(key, value, replace = false) {
    // BrowserRouter updates the address before its React transition commits.
    // Reading that address lets rapid filter changes compose without losing one.
    const next = new URLSearchParams(window.location.search);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace, preventScrollReset: true });
  }

  function clearFilters() {
    const next = new URLSearchParams(window.location.search);
    ['category', 'material', 'price'].forEach((key) => next.delete(key));
    setParams(next, { preventScrollReset: true });
  }

  return (
    <>
      <section className="bg-cream">
        <div className="container-shell">
          <Breadcrumbs items={[{ label: searchMode ? 'Search' : 'Our collection' }]} />
          <div className="pb-10 pt-2 text-center sm:pb-14">
            <p className="eyebrow mb-4 text-bark">
              {searchMode ? 'Something beautiful is waiting' : 'Thoughtfully chosen for your home'}
            </p>
            <h1 className="page-title">
              {searchMode ? 'Find your kind of beautiful.' : 'A piece for every story.'}
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-bark">
              {searchMode
                ? 'Search product names, descriptions, or tags, then narrow results by category.'
                : 'From the first coffee to the last conversation. Discover furniture for the moments in between.'}
            </p>
          </div>
        </div>
      </section>

      {!searchMode && (
        <section
          className="container-shell pb-2 pt-10 sm:pt-12"
          aria-label="Browse furniture categories"
        >
          <div className="grid grid-cols-4 gap-x-4 gap-y-5 sm:grid-cols-7 sm:gap-6 lg:gap-8">
            {categories.map((category) => (
              <CategoryCard key={category.id} category={category} compact />
            ))}
          </div>
        </section>
      )}

      <section className="container-shell pb-16 pt-10 sm:pb-20" aria-label="Furniture collection">
        <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 lg:flex-1">
            <p className="eyebrow mb-3 text-bark">
              {searchMode ? 'Search the collection' : 'Explore the collection'}
            </p>
            <h2 className="font-display text-4xl wrap-anywhere text-walnut">
              {searchMode && query.trim()
                ? `Results for “${query.trim()}”`
                : selectedCategory?.name || 'All furniture'}
            </h2>
          </div>
          <form
            role="search"
            className="relative w-full lg:w-80 lg:shrink-0"
            onSubmit={(event) => event.preventDefault()}
          >
            <label htmlFor="collection-search" className="sr-only">
              Search product names, descriptions, or tags
            </label>
            <Search
              size={17}
              className="pointer-events-none absolute left-4 top-4 text-bark"
              aria-hidden="true"
            />
            <input
              id="collection-search"
              type="search"
              className="field pl-11 pr-11"
              placeholder="Search names, descriptions, tags…"
              value={query}
              onChange={(event) => update('q', event.target.value, true)}
            />
            {query && (
              <button
                type="button"
                className="absolute right-1 top-0.5 flex size-11 items-center justify-center"
                aria-label="Clear search"
                onClick={() => update('q', '')}
              >
                <X size={16} />
              </button>
            )}
          </form>
        </div>

        <div className="mb-7 flex flex-wrap gap-2" aria-label="Quick category filters">
          <button
            className={`chip ${!filters.category ? 'chip-active' : ''}`}
            aria-pressed={!filters.category}
            onClick={() => update('category', '')}
          >
            All furniture
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              className={`chip ${filters.category === category.id ? 'chip-active' : ''}`}
              aria-pressed={filters.category === category.id}
              onClick={() => update('category', category.id)}
            >
              {category.name}
            </button>
          ))}
        </div>

        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-y border-sand py-4">
          <p role="status" className="text-xs text-bark">
            {error
              ? 'Unable to load the collection.'
              : loading
                ? 'Loading furniture…'
                : `${results.length} ${results.length === 1 ? 'piece' : 'pieces'} to explore`}
          </p>
          <div className="flex max-w-full items-center gap-3">
            <button
              className="flex min-h-11 items-center gap-2 rounded-sm border border-sand px-3 text-xs lg:hidden"
              aria-haspopup="dialog"
              onClick={() => setDrawerOpen(true)}
            >
              <SlidersHorizontal size={15} />
              Filters
              {filterCount > 0 && (
                <span className="flex size-5 items-center justify-center rounded-full bg-walnut text-[10px] text-white">
                  {filterCount}
                </span>
              )}
            </button>
            <label htmlFor="collection-sort" className="hidden text-xs text-bark sm:block">
              Sort by
            </label>
            <select
              id="collection-sort"
              aria-label="Sort products"
              className="min-h-11 min-w-0 max-w-[180px] rounded-sm border border-sand bg-white py-2 pl-3 pr-2 text-xs"
              value={filters.sort}
              onChange={(event) => update('sort', event.target.value)}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-9 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10">
          <aside className="hidden lg:block" aria-label="Filter products">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm">
                <SlidersHorizontal size={16} />
                Filters
              </h3>
              {filterCount > 0 && (
                <button className="min-h-11 text-xs text-bark underline" onClick={clearFilters}>
                  Reset
                </button>
              )}
            </div>
            <FilterControls
              filters={filters}
              onChange={update}
              categories={categories}
              isSample={!searchMode}
            />
          </aside>
          <div className="min-w-0">
            {(filterCount > 0 || query) && (
              <div className="mb-6 flex flex-wrap items-center gap-2">
                {[
                  ['q', query],
                  ['category', selectedCategory?.name || filters.category],
                  ['material', filters.material],
                  [
                    'price',
                    priceOptions.find((option) => option.value === filters.price)?.value
                      ? priceOptions.find((option) => option.value === filters.price).label
                      : '',
                  ],
                ]
                  .filter(([, value]) => value)
                  .map(([key, value]) => (
                    <button
                      key={key}
                      className="flex min-h-11 max-w-full items-center gap-2 rounded-sm bg-cream px-3 py-2 text-[11px]"
                      onClick={() => update(key, '')}
                      aria-label={`Remove ${key === 'q' ? 'search' : key}: ${value}`}
                    >
                      <span className="max-lg:min-w-0 max-lg:whitespace-normal max-lg:wrap-anywhere lg:truncate">
                        {value}
                      </span>
                      <X size={13} className="shrink-0" />
                    </button>
                  ))}
                <button
                  className="min-h-11 px-2 text-[11px] text-bark underline"
                  onClick={() => setParams({})}
                >
                  Clear all
                </button>
              </div>
            )}
            {error ? (
              <div
                role="alert"
                className="rounded-sm border border-sand bg-cream/50 px-6 py-16 text-center"
              >
                <h3 className="font-display text-3xl text-walnut">
                  Unable to load the collection.
                </h3>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-bark">{error}</p>
                <button className="btn-primary mt-6" onClick={shop.retry}>
                  Try again
                </button>
              </div>
            ) : loading ? (
              <div
                role="status"
                className="rounded-sm border border-sand bg-cream/50 px-6 py-16 text-center"
              >
                <p className="text-sm leading-7 text-bark">Loading furniture…</p>
              </div>
            ) : results.length ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-9 xl:grid-cols-3">
                {results.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="rounded-sm border border-sand bg-cream/50 px-6 py-16 text-center">
                <SearchX size={34} strokeWidth={1.2} className="mx-auto mb-5 text-bark" />
                <h3 className="font-display text-3xl text-walnut">A little room to try again.</h3>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-bark">
                  No pieces match this combination. Try another word or remove a filter to discover
                  more.
                </p>
                <button className="btn-primary mt-6" onClick={() => setParams({})}>
                  Explore all furniture
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
            <p className="mt-8 border-t border-sand pt-5 text-[10px] leading-6 text-bark">
              {searchMode
                ? 'Search results include active furniture matching names, descriptions, or tags. Contact the showroom to confirm specifications, prices, and availability.'
                : 'Explore our furniture collection. Contact the showroom to confirm specifications, prices, and availability.'}{' '}
              <Link to="/contact" className="underline underline-offset-4">
                View contact details
              </Link>{' '}
              for product enquiries.
            </p>
          </div>
        </div>
      </section>

      <Modal
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        labelledBy="filter-drawer-title"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-sand p-5">
            <h2 id="filter-drawer-title" className="font-display text-3xl text-walnut">
              Find your perfect piece.
            </h2>
            <button
              className="icon-button"
              aria-label="Close filters"
              onClick={() => setDrawerOpen(false)}
            >
              <X size={22} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <FilterControls
              prefix="mobile-filter"
              filters={filters}
              onChange={update}
              categories={categories}
              isSample={!searchMode}
            />
          </div>
          <div className="flex gap-3 border-t border-sand bg-white p-5">
            <button className="btn-outline px-4" onClick={clearFilters}>
              Reset
            </button>
            <button className="btn-primary flex-1" onClick={() => setDrawerOpen(false)}>
              {loading
                ? 'Loading…'
                : `Show ${results.length} ${results.length === 1 ? 'piece' : 'pieces'}`}
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </Modal>
      <VisitBanner />
    </>
  );
}
