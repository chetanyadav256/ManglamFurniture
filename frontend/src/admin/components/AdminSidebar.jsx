import { ArrowUpRight, LayoutDashboard, LogOut, Package, Settings, Shapes } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import Brand from '../../components/Brand';

export const adminNavigation = [
  { to: '/admin/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/categories', label: 'Categories', icon: Shapes },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];
export default function AdminSidebar({ onNavigate }) {
  return (
    <div className="flex h-full flex-col bg-walnut px-5 py-7 text-cream">
      <div className="px-3">
        <Brand light />
        <p className="eyebrow mt-5 text-[#e2bc9c]">Catalog studio</p>
      </div>
      <nav aria-label="Admin navigation" className="mt-9 space-y-2">
        {adminNavigation.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex min-h-12 items-center gap-3 rounded-lg px-4 text-sm transition-colors ${isActive ? 'bg-cream text-walnut' : 'text-cream/85 hover:bg-white/10'}`
            }
          >
            <Icon size={19} strokeWidth={1.5} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto pt-12">
        <div className="rounded-lg border border-white/15 bg-white/5 p-4">
          <p className="text-xs text-[#e2bc9c]">A space for your collection.</p>
          <p className="mt-2 text-xs leading-6 text-cream/75">
            Keep every piece, category, and detail thoughtfully organised.
          </p>
        </div>
        <Link
          to="/"
          className="mt-5 flex min-h-11 items-center justify-between px-3 text-xs text-cream/85"
          onClick={onNavigate}
        >
          View public website
          <ArrowUpRight size={16} />
        </Link>
        <Link
          to="/admin/login"
          className="flex min-h-11 items-center gap-3 px-3 text-xs text-cream/75"
          onClick={onNavigate}
        >
          <LogOut size={16} />
          Exit UI preview
        </Link>
      </div>
    </div>
  );
}
