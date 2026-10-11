import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import SiteLayout from './layouts/SiteLayout';
import HomePage from './pages/HomePage';
import NotFoundPage from './pages/NotFoundPage';
import CollectionPage from './pages/CollectionPage';
import ProductDetailsPage from './pages/ProductDetailsPage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';

const AdminRoutes = lazy(() => import('./admin/AdminRoutes'));

export default function App() {
  return (
    <Routes>
      <Route
        path="admin/*"
        element={
          <Suspense
            fallback={
              <div
                role="status"
                className="flex min-h-dvh items-center justify-center bg-cream p-6 text-walnut"
              >
                Loading catalog studio…
              </div>
            }
          >
            <AdminRoutes />
          </Suspense>
        }
      />
      <Route element={<SiteLayout />}>
        <Route index element={<HomePage />} />
        <Route path="shop" element={<CollectionPage />} />
        <Route path="search" element={<CollectionPage key="search" searchMode />} />
        <Route path="products/:productId" element={<ProductDetailsPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
