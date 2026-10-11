import usePageTitle from '../../hooks/usePageTitle';
import { AdminPageHeading } from '../components/AdminUI';
import ProductForm from '../components/ProductForm';

export default function AddProduct() {
  usePageTitle('Add product');
  return (
    <>
      <AdminPageHeading
        eyebrow="Products / Add new"
        title="Make room for a new piece."
        description="Good photographs and thoughtful details make all the difference."
      />
      <ProductForm />
    </>
  );
}
