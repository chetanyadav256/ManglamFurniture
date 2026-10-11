import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { FlaskConical, X } from 'lucide-react';
import Modal from '../../components/Modal';
import AdminSidebar from '../components/AdminSidebar';
import AdminHeader from '../components/AdminHeader';

export default function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.getElementById('main-content')?.focus({ preventScroll: true });
  }, [pathname]);
  useEffect(() => {
    const resize = () => {
      if (window.innerWidth >= 1024) setMenuOpen(false);
    };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  return (
    <div className="min-h-dvh bg-[#faf8f5]">
      <a
        href="#main-content"
        className="sr-only z-50 bg-white p-4 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to admin content
      </a>
      <aside
        aria-label="Desktop admin sidebar"
        className="fixed inset-y-0 left-0 z-30 hidden w-60 overflow-y-auto lg:block"
      >
        <AdminSidebar />
      </aside>
      <div className="min-w-0 lg:ml-60">
        <AdminHeader menuOpen={menuOpen} onOpenMenu={() => setMenuOpen(true)} />
        <div className="flex items-start gap-2 border-b border-sand bg-cream px-5 py-3 text-[11px] leading-5 text-walnut sm:px-7 lg:px-9">
          <FlaskConical size={15} className="mt-0.5 shrink-0" />
          <p>
            <strong className="font-semibold">UI preview</strong> · No authentication. Changes stay
            in memory, reset on refresh, and do not change the public catalog.
          </p>
        </div>
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto max-w-[1500px] px-5 py-7 focus:outline-none sm:px-7 sm:py-9 lg:px-9"
        >
          <Outlet />
        </main>
        <footer className="mx-5 flex flex-wrap justify-between gap-2 border-t border-sand py-5 text-[10px] text-bark sm:mx-7 lg:mx-9">
          <span>Manglam Furniture · Catalog studio</span>
          <Link to="/admin/login" className="underline underline-offset-4">
            About this UI preview
          </Link>
        </footer>
      </div>
      <Modal
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        labelledBy="admin-menu-title"
        id="admin-mobile-navigation"
      >
        <div className="flex h-full flex-col">
          <div className="flex shrink-0 items-center justify-between border-b border-sand px-5 py-3">
            <h2 id="admin-menu-title" className="font-display text-2xl text-walnut">
              Catalog navigation
            </h2>
            <button
              className="icon-button"
              aria-label="Close admin navigation"
              onClick={() => setMenuOpen(false)}
            >
              <X size={21} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <AdminSidebar onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
