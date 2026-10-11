import { Link, useParams } from 'react-router-dom';
import { PackageSearch } from 'lucide-react';
import usePageTitle from '../../hooks/usePageTitle';
import { useAdminPreview } from '../context/AdminPreviewContext';
import { AdminPageHeading, EmptyState } from '../components/AdminUI';
import ProductForm from '../components/ProductForm';

export default function EditProduct() {
  const { id } = useParams();
  const { products } = useAdminPreview();
  const product = products.find((item) => item.id === id);
  usePageTitle(product ? `Edit ${product.name}` : 'Product not found');
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
    <EmptyState
      icon={PackageSearch}
      title="This piece isn’t here."
      action={
        <Link to="/admin/products" className="btn-primary rounded-md">
          Back to products
        </Link>
      }
    >
      The product may have been removed, or this preview was refreshed. New products exist only
      until refresh.
    </EmptyState>
  );
}
