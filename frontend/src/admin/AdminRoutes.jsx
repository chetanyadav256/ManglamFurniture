import { Navigate, Route, Routes, Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { AdminPreviewProvider } from './context/AdminPreviewContext';
import AdminLayout from './layout/AdminLayout';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import ManageProducts from './pages/ManageProducts';
import AddProduct from './pages/AddProduct';
import EditProduct from './pages/EditProduct';
import ManageCategories from './pages/ManageCategories';
import AdminSettings from './pages/AdminSettings';
import { EmptyState } from './components/AdminUI';

// Explicitly unprotected, UI-only routes. Add server-backed authentication later.
export default function AdminRoutes() {
  return (
    <Routes>
      <Route element={<AdminPreviewProvider />}>
        <Route index element={<Navigate to="login" replace />} />
        <Route path="login" element={<AdminLogin />} />
        <Route element={<AdminLayout />}>
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="products" element={<ManageProducts />} />
          <Route path="products/new" element={<AddProduct />} />
          <Route path="products/:id/edit" element={<EditProduct />} />
          <Route path="categories" element={<ManageCategories />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route
            path="*"
            element={
              <EmptyState
                icon={Compass}
                title="This workspace page isn’t here."
                action={
                  <Link to="/admin/dashboard" className="btn-primary rounded-md">
                    Back to overview
                  </Link>
                }
              >
                Check the address or return to your catalog overview.
              </EmptyState>
            }
          />
        </Route>
      </Route>
    </Routes>
  );
}
