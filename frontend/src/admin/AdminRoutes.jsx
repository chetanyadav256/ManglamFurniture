import { Navigate, Route, Routes, Link, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Compass } from 'lucide-react';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';
import { AdminPreviewProvider } from './context/AdminPreviewContext';
import { AdminProductsProvider } from './context/AdminProductsContext';
import AdminLayout from './layout/AdminLayout';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import ManageProducts from './pages/ManageProducts';
import AddProduct from './pages/AddProduct';
import EditProduct from './pages/EditProduct';
import ManageCategories from './pages/ManageCategories';
import AdminSettings from './pages/AdminSettings';
import { EmptyState } from './components/AdminUI';

function RequireAdmin() {
  const { isAuthenticated, verifySession } = useAdminAuth();
  const { pathname } = useLocation();
  const [verifiedPath, setVerifiedPath] = useState(null);

  useEffect(() => {
    let current = true;
    setVerifiedPath(null);
    if (isAuthenticated) {
      verifySession().then((valid) => {
        if (current) setVerifiedPath(valid ? pathname : null);
      });
    }
    return () => {
      current = false;
    };
  }, [isAuthenticated, pathname, verifySession]);

  if (!isAuthenticated) return <Navigate to="/admin/login" replace />;
  if (verifiedPath !== pathname) {
    return (
      <div
        role="status"
        className="flex min-h-dvh items-center justify-center bg-cream p-6 text-walnut"
      >
        Verifying admin session…
      </div>
    );
  }
  return <Outlet />;
}

function AdminLoginRoute() {
  const { isAuthenticated } = useAdminAuth();
  return isAuthenticated ? <Navigate to="/admin/dashboard" replace /> : <AdminLogin />;
}

export default function AdminRoutes() {
  return (
    <AdminAuthProvider>
      <Routes>
        <Route element={<AdminPreviewProvider />}>
          <Route index element={<Navigate to="login" replace />} />
          <Route path="login" element={<AdminLoginRoute />} />
          <Route element={<RequireAdmin />}>
            <Route element={<AdminLayout />}>
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route element={<AdminProductsProvider />}>
                <Route path="products" element={<ManageProducts />} />
                <Route path="products/new" element={<AddProduct />} />
                <Route path="products/:id/edit" element={<EditProduct />} />
              </Route>
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
        </Route>
      </Routes>
    </AdminAuthProvider>
  );
}
