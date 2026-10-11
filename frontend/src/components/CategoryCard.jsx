import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function CategoryCard({ category, compact = false }) {
  return (
    <Link
      to={`/shop?category=${category.id}`}
      className="group min-w-0"
      aria-label={`Explore ${category.name}`}
    >
      <div
        className={`overflow-hidden bg-sand ${compact ? 'aspect-square rounded-full' : 'aspect-[4/4.6] rounded-sm'}`}
      >
        <img
          src={category.image}
          alt={category.name}
          width="400"
          height="460"
          loading="lazy"
          className="image-hover h-full w-full object-cover"
        />
      </div>
      <div
        className={`mt-3 flex min-h-8 items-center gap-2 ${compact ? 'justify-center text-center' : 'justify-between'}`}
      >
        <h3
          className={`leading-tight text-walnut max-lg:min-w-0 max-lg:wrap-anywhere ${compact ? 'text-[10px] sm:text-xs' : 'font-display text-xl sm:text-2xl'}`}
        >
          {category.name}
        </h3>
        {!compact && <ArrowUpRight size={16} className="shrink-0" aria-hidden="true" />}
      </div>
    </Link>
  );
}
