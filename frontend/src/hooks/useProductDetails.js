import { useEffect, useState } from 'react';
import { getProduct, getProducts } from '../services/api';

const fallback = '/images/living-room.webp';
const card = (product) => ({ ...product, categoryName: product.category?.name || 'Furniture',
  category: product.category?.slug || '', image: product.images?.[0]?.url || fallback, isSample: false });

function adaptProduct(product) {
  const dimensions = product.dimensions || {};
  const hasDimensions = ['width', 'length', 'height'].some((key) => dimensions[key] != null);
  const images = product.images?.length ? product.images : [{ url: fallback }];
  return {
    ...product,
    isSample: false,
    material: product.material || 'Not specified',
    color: product.color || 'Not specified',
    tags: product.tags || [],
    dimensions: hasDimensions ? `${dimensions.width ?? '—'} × ${dimensions.length ?? '—'} × ${dimensions.height ?? '—'} cm` : '',
    images: images.map((image, index) => ({ src: image.url || fallback, label: `Image ${index + 1}`, position: 'center', zoom: 1 })),
  };
}

export default function useProductDetails(id, enabled) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ id: '', loading: true });
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setState({ id, loading: true });
    async function load() {
      let product;
      try {
        ({ product } = await getProduct(id, { signal: controller.signal }));
        if (controller.signal.aborted) return;
        setState({ id, loading: false, product: adaptProduct(product), related: [], relatedLoading: true });
      } catch (error) {
        if (!controller.signal.aborted) setState({ id, loading: false,
          missing: error.status === 404 || error.code === 'INVALID_PRODUCT_ID',
          error: error.message || 'Unable to load this product.' });
        return;
      }
      try {
        const { products } = await getProducts({ category: product.category?.slug, limit: 5, sort: 'newest' }, { signal: controller.signal });
        if (!controller.signal.aborted) setState((current) => ({ ...current,
          relatedLoading: false, related: products.filter((item) => item.id !== id).slice(0, 4).map(card) }));
      } catch {
        if (!controller.signal.aborted) setState((current) => ({ ...current, relatedLoading: false, relatedError: true }));
      }
    }
    load();
    return () => controller.abort();
  }, [id, enabled, attempt]);
  return { ...(state.id === id ? state : { loading: true }), retry: () => setAttempt((value) => value + 1) };
}
