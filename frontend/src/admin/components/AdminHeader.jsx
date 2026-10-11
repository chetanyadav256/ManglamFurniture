import { useEffect, useRef } from 'react';
import { ChevronDown, ExternalLink, LogOut, Menu, Settings, UserRound } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Brand from '../../components/Brand';
import { useAdminAuth } from '../context/AdminAuthContext';

export default function AdminHeader({ onOpenMenu, menuOpen }) {
  const { admin, logout } = useAdminAuth();
  const navigate = useNavigate();
  const dropdown = useRef(null);
  const { pathname } = useLocation();
  useEffect(() => {
    if (dropdown.current) dropdown.current.open = false;
  }, [pathname]);
  useEffect(() => {
    const dismiss = (event) => {
      if (!dropdown.current?.contains(event.target)) dropdown.current.open = false;
    };
    const escape = (event) => {
      if (event.key === 'Escape' && dropdown.current?.open) {
        dropdown.current.open = false;
        dropdown.current.querySelector('summary').focus();
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, []);
  return (
    <header className="sticky top-0 z-20 flex min-h-20 items-center justify-between gap-2 border-b border-sand bg-white px-4 sm:px-7 lg:px-9">
      <div className="flex min-w-0 items-center gap-2">
        <button
          className="icon-button lg:hidden"
          aria-label="Open admin navigation"
          aria-controls="admin-mobile-navigation"
          aria-expanded={menuOpen}
          onClick={onOpenMenu}
        >
          <Menu size={21} />
        </button>
        <div className="lg:hidden">
          <Brand />
        </div>
        <div className="hidden lg:block">
          <p className="text-sm font-medium text-walnut">Manglam Furniture</p>
          <p className="mt-1 text-[11px] text-bark">Administration · Catalog management</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <Link to="/" className="hidden min-h-11 items-center gap-2 text-xs text-bark sm:flex">
          View website
          <ExternalLink size={14} />
        </Link>
        <details
          ref={dropdown}
          className="relative"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              event.currentTarget.open = false;
          }}
        >
          <summary
            aria-label="Admin profile options"
            className="flex min-h-11 list-none items-center gap-2 rounded-full p-1 [&::-webkit-details-marker]:hidden"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-cream text-walnut">
              <UserRound size={18} />
            </span>
            <span className="hidden max-w-28 truncate text-xs text-walnut md:block">
              {admin?.name}
            </span>
            <ChevronDown size={14} className="hidden sm:block" />
          </summary>
          <div className="absolute right-0 top-[calc(100%+12px)] w-56 rounded-lg border border-sand bg-white p-2 shadow-lg">
            <p className="break-words border-b border-sand px-3 py-3 text-xs text-bark">
              {admin?.email}
            </p>
            <Link
              to="/admin/settings"
              className="flex min-h-11 items-center gap-3 rounded-md px-3 text-xs hover:bg-cream"
            >
              <Settings size={15} />
              Profile & settings
            </Link>
            <button
              type="button"
              onClick={() => {
                logout();
                navigate('/admin/login', { replace: true });
              }}
              className="flex min-h-11 items-center gap-3 rounded-md px-3 text-xs hover:bg-cream"
            >
              <LogOut size={15} />
              Logout
            </button>
          </div>
        </details>
      </div>
    </header>
  );
}
