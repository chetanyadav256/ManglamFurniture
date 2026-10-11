import { useEffect, useState } from 'react';
import { getCategories, getProducts } from '../services/api';
import { categories as categoryArtwork } from '../data/catalog';

// Existing catalog artwork, not a fabricated product image from sample data.
const placeholder = '/images/living-room.webp';
const priceBounds = {
  'under-20000': { maxPrice: 20000 },
  '20000-50000': { minPrice: 20000, maxPrice: 50000 },
  'over-50000': { minPrice: 50000 },
};

export default function useShopCatalog(filters, enabled) {
  const [attempt, setAttempt] = useState(0);
  const [categoryState, setCategoryState] = useState({ loading: true, data: [], error: '' });
  const [productState, setProductState] = useState({ key: '', data: [], error: '' });
  const requestKey = JSON.stringify({
    search: filters.query,
    category: filters.category,
    sort: { 'price-asc': 'price_asc', 'price-desc': 'price_desc' }[filters.sort] || 'newest',
    ...priceBounds[filters.price],
  });

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setCategoryState({ loading: true, data: [], error: '' });
    getCategories({ signal: controller.signal }).then(({ categories }) => {
      if (controller.signal.aborted) return;
      setCategoryState({ loading: false, error: '', data: categories.map((category) => ({
        ...category,
        databaseId: category.id,
        id: category.slug,
        image: categoryArtwork.find((art) => art.id === category.slug)?.image || placeholder,
      })) });
    }).catch((error) => {
      if (!controller.signal.aborted) setCategoryState({ loading: false, data: [], error: error.message || 'Unable to load categories.' });
    });
    return () => controller.abort();
  }, [enabled, attempt]);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setProductState({ key: '', data: [], error: '' });
    // Keep the existing all-results grid: consume backend pagination rather than
    // filtering one page locally or adding new pagination controls to the design.
    const timer = setTimeout(async () => {
      try {
        const products = [];
        let page = 1;
        let totalPages;
        do {
          const response = await getProducts({ ...JSON.parse(requestKey), page, limit: 100 }, { signal: controller.signal });
          if (controller.signal.aborted) return;
          products.push(...response.products);
          totalPages = response.pagination.totalPages;
          page++;
        } while (page <= totalPages);
        const unique = [...new Map(products.map((product) => [product.id, product])).values()];
        setProductState({ key: requestKey, error: '', data: unique.map((product) => ({
          ...product,
          category: product.category?.slug || '',
          categoryName: product.category?.name || 'Furniture',
          image: product.images?.[0]?.url || placeholder,
          isSample: false,
        })) });
      } catch (error) {
        if (!controller.signal.aborted) setProductState({ key: requestKey, data: [], error: error.message || 'Unable to load furniture.' });
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [enabled, requestKey, attempt]);

  const results = productState.data.filter((product) =>
    (!filters.material || product.material === filters.material)
    && (filters.price !== 'under-20000' || product.price < 20000)
    && (filters.price !== 'over-50000' || product.price > 50000));
  if (filters.sort === 'name') results.sort((a, b) => a.name.localeCompare(b.name));

  return {
    categories: categoryState.data,
    results,
    loading: categoryState.loading || productState.key !== requestKey,
    error: categoryState.error || (productState.key === requestKey ? productState.error : ''),
    retry: () => setAttempt((value) => value + 1),
  };
}
