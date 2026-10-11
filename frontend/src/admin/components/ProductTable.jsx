import { Pencil, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatAdminPrice as formatPrice, formatDate } from '../services/adminMockService';

function Actions({ product, onDelete }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Link
        to={`/admin/products/${product.id}/edit`}
        className="icon-button size-11 text-walnut"
        aria-label={`Edit ${product.name}`}
      >
        <Pencil size={16} />
      </Link>
      {onDelete && (
        <button
          className="icon-button size-11 text-red-800"
          aria-label={`Delete ${product.name}`}
          onClick={() => onDelete(product)}
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}
function Tags({ tags }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {tags.slice(0, 2).map((tag) => (
        <span
          key={tag}
          className="max-w-full truncate rounded bg-cream px-1.5 py-1 text-[9px] text-bark"
          title={tag}
        >
          {tag}
        </span>
      ))}
      {tags.length > 2 && (
        <span className="px-1 py-1 text-[9px] text-bark" title={tags.slice(2).join(', ')}>
          +{tags.length - 2}
        </span>
      )}
    </div>
  );
}

export default function ProductTable({ products, categories, onDelete }) {
  const categoryName = (id) =>
    categories.find((category) => category.id === id)?.name || 'Unknown category';
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-sand bg-white lg:block">
        <table className="w-full table-fixed text-left text-xs">
          <caption className="sr-only">Catalog products and management actions</caption>
          <thead className="border-b border-sand bg-cream/50 text-[10px] tracking-wide text-bark">
            <tr>
              <th scope="col" className="w-[35%] px-4 py-4 font-medium">
                PRODUCT & TAGS
              </th>
              <th scope="col" className="w-[16%] px-2 py-4 font-medium">
                CATEGORY
              </th>
              <th scope="col" className="w-[15%] px-2 py-4 font-medium">
                PRICE
              </th>
              <th scope="col" className="w-[18%] px-2 py-4 font-medium">
                DATE ADDED
              </th>
              <th scope="col" className="w-[16%] px-2 py-4 text-right font-medium">
                ACTIONS
              </th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr
                key={product.id}
                data-testid="admin-product-row"
                className="border-b border-sand/60 last:border-0 hover:bg-cream/25"
              >
                <td className="px-4 py-4">
                  <div className="flex items-start gap-3">
                    <img
                      src={product.image}
                      alt=""
                      width="48"
                      height="56"
                      className="h-14 w-12 shrink-0 rounded-md object-cover"
                    />
                    <div className="min-w-0">
                      <Link
                        to={`/admin/products/${product.id}/edit`}
                        className="font-medium leading-5 text-walnut hover:underline wrap-anywhere"
                      >
                        {product.name}
                      </Link>
                      <Tags tags={product.tags} />
                    </div>
                  </div>
                </td>
                <td className="px-2 py-4 leading-5 text-bark wrap-anywhere">
                  {categoryName(product.category)}
                </td>
                <td className="px-2 py-4 text-walnut wrap-anywhere">
                  {formatPrice(product.price)}
                </td>
                <td className="px-2 py-4 text-[10px] leading-5 text-bark">
                  {formatDate(product.createdAt)}
                </td>
                <td className="py-4 pr-2">
                  <Actions product={product} onDelete={onDelete} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 lg:hidden">
        {products.map((product) => (
          <article
            key={product.id}
            data-testid="admin-product-card"
            className="rounded-xl border border-sand bg-white p-4"
          >
            <div className="flex items-start gap-3">
              <img
                src={product.image}
                alt=""
                width="68"
                height="80"
                className="h-20 w-[68px] shrink-0 rounded-md object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-bark">{categoryName(product.category)}</p>
                <Link
                  to={`/admin/products/${product.id}/edit`}
                  className="mt-1 block text-sm font-medium leading-6 text-walnut wrap-anywhere"
                >
                  {product.name}
                </Link>
                <p className="mt-1 text-sm">{formatPrice(product.price)}</p>
              </div>
            </div>
            <Tags tags={product.tags} />
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-sand/70 pt-2">
              <p className="text-[10px] text-bark">Added {formatDate(product.createdAt)}</p>
              <Actions product={product} onDelete={onDelete} />
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
