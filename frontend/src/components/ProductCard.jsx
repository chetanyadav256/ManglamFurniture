import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatPrice, getCategory } from '../data/catalog';

export default function ProductCard({ product }) {
  return (
    <article data-testid="product-card" className="group min-w-0">
      <Link
        to={`/products/${product.id}`}
        className="block rounded-lg"
        aria-label={`View ${product.name}`}
      >
        <div className="relative aspect-[4/4.5] overflow-hidden rounded-lg bg-cream sm:aspect-[4/4.2]">
          <img
            src={product.image}
            alt={product.name}
            width="600"
            height="650"
            loading="lazy"
            className="image-hover h-full w-full object-cover"
            style={{ objectPosition: product.position || 'center' }}
          />
          {product.featured && (
            <span className="absolute left-2.5 top-2.5 rounded-sm bg-white/95 px-2.5 py-1.5 text-[8px] tracking-wider uppercase sm:left-4 sm:top-4 sm:text-[9px]">
              Selected edit
            </span>
          )}
          <span className="absolute bottom-3 right-3 flex size-8 items-center justify-center rounded-full bg-white shadow-sm transition-colors group-hover:bg-walnut group-hover:text-white sm:size-10">
            <ArrowUpRight size={17} aria-hidden="true" />
          </span>
        </div>
        <div className="pb-1 pt-4">
          <p className="text-[9px] tracking-[0.12em] text-bark uppercase sm:text-[10px]">
            {product.categoryName ?? getCategory(product.category)?.name ?? 'Furniture'}
          </p>
          <h3 className="mt-1.5 font-display text-xl leading-tight text-walnut sm:text-2xl">
            {product.name}
          </h3>
          <p className="mt-2 text-xs font-medium sm:text-sm" data-testid="product-price">
            {formatPrice(product.price)}
            {product.isSample !== false && <span className="ml-1.5 text-[9px] font-normal text-bark">sample price</span>}
          </p>
        </div>
      </Link>
    </article>
  );
}
