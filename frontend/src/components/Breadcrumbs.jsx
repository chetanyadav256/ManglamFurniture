import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Breadcrumbs({ items }) {
  return (
    <nav aria-label="Breadcrumb" className="py-6">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-bark">
        <li>
          <Link to="/" className="inline-flex min-h-8 items-center hover:text-walnut">
            Home
          </Link>
        </li>
        {items.map((item, index) => (
          <li
            key={`${item.label}-${index}`}
            className="flex items-center gap-2 max-lg:min-w-0 max-lg:max-w-full max-lg:wrap-anywhere"
          >
            <ChevronRight size={12} className="max-lg:shrink-0" aria-hidden="true" />
            {item.to ? (
              <Link to={item.to} className="inline-flex min-h-8 items-center hover:text-walnut">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-walnut">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
