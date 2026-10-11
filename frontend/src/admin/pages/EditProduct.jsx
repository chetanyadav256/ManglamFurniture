import { Link, useParams } from 'react-router-dom';
import { PackageSearch } from 'lucide-react';
import usePageTitle from '../../hooks/usePageTitle';
import { useAdminProducts } from '../context/AdminProductsContext';
import { AdminPageHeading, EmptyState } from '../components/AdminUI';
import ProductForm from '../components/ProductForm';

export default function EditProduct() {
  const { id } = useParams();
  const { products, loading, error, refresh } = useAdminProducts();
  const product = products.find((item) => item.id === id);
  usePageTitle(product ? `Edit ${product.name}` : 'Product not found');
  if (loading) {
    return (
      <>
        <AdminPageHeading eyebrow="Products / Edit" title="Loading product details." />
        <p role="status" className="py-10 text-center text-sm text-bark">
          Loading product…
        </p>
      </>
    );
  }
  if (error) {
    return (
      <>
        <AdminPageHeading eyebrow="Products / Edit" title="Product details could not be loaded." />
        <EmptyState
          icon={PackageSearch}
          title="Please try again."
          action={
            <button
              type="button"
              className="btn-outline rounded-md"
              onClick={() => refresh().catch(() => {})}
            >
              Retry loading products
            </button>
          }
        >
          {error}
        </EmptyState>
      </>
    );
  }
  return product ? (
    <>
      <AdminPageHeading
        eyebrow="Products / Edit"
        title="A little attention to detail."
        description={`Editing ${product.name}`}
      />
      <ProductForm key={product.id} product={product} />
    </>
  ) : (
    <>
      <AdminPageHeading eyebrow="Products / Edit" title="This piece isn’t here." />
      <EmptyState
        icon={PackageSearch}
        title="Not in the active catalog."
        action={
          <Link to="/admin/products" className="btn-primary rounded-md">
            Back to products
          </Link>
        }
      >
        This product may have been deactivated or does not exist in the active public catalog.
      </EmptyState>
    </>
  );
}
