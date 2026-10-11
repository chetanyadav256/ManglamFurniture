import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpRight, ChevronDown, MapPin, Menu, Search, Store, X } from 'lucide-react';
import Brand from './Brand';
import Modal from './Modal';
import { categories } from '../data/catalog';
import { business, navigation } from '../data/site';

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const dropdown = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
    if (dropdown.current) dropdown.current.open = false;
  }, [location.key]);

  useEffect(() => {
    const dismiss = (event) => {
      if (dropdown.current && !dropdown.current.contains(event.target))
        dropdown.current.open = false;
    };
    const escape = (event) => {
      if (event.key === 'Escape' && dropdown.current?.open) {
        dropdown.current.open = false;
        dropdown.current.querySelector('summary').focus();
      }
    };
    const resize = () => {
      if (window.innerWidth >= 1024) setMenuOpen(false);
      else if (dropdown.current) dropdown.current.open = false;
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    window.addEventListener('resize', resize);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('resize', resize);
    };
  }, []);

  function submitSearch(event) {
    event.preventDefault();
    navigate(`/search${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`);
    setSearchOpen(false);
  }

  return (
    <>
      <div className="bg-walnut px-4 py-2.5 text-center text-[9px] tracking-[0.12em] text-cream sm:text-[10px]">
        THOUGHTFUL FURNITURE. BEAUTIFUL EVERYDAY LIVING.
      </div>
      <header className="sticky top-0 z-30 border-b border-sand/70 bg-white/95 backdrop-blur-md">
        <div className="container-shell flex h-[76px] items-center justify-between gap-2 max-sm:px-[clamp(0.25rem,calc((100vw-19.5rem)/2),1.25rem)] lg:h-[88px] lg:gap-5">
          <Brand />
          <nav aria-label="Main navigation" className="hidden items-center gap-5 lg:flex xl:gap-8">
            {navigation.map(({ label, to }) =>
              label === 'Shop' ? (
                <div key={to} className="flex items-center gap-0.5">
                  <NavLink
                    to={to}
                    className={({ isActive }) =>
                      `flex min-h-11 items-center gap-2 text-xs ${isActive ? 'text-walnut font-semibold' : 'text-bark hover:text-walnut'}`
                    }
                  >
                    <Store size={15} aria-hidden="true" />
                    Shop
                  </NavLink>
                  <details
                    ref={dropdown}
                    className="group relative"
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget))
                        event.currentTarget.open = false;
                    }}
                  >
                    <summary
                      aria-label="Shop categories"
                      className="flex size-11 list-none items-center justify-center rounded-full hover:bg-cream [&::-webkit-details-marker]:hidden"
                    >
                      <ChevronDown
                        size={14}
                        className="transition-transform group-open:rotate-180"
                        aria-hidden="true"
                      />
                    </summary>
                    <div className="absolute left-0 top-full w-64 rounded-sm border border-sand bg-white p-3 shadow-xl">
                      <p className="eyebrow px-3 py-3 text-bark">Find your favourite</p>
                      {categories.map((category) => (
                        <Link
                          key={category.id}
                          to={`/shop?category=${category.id}`}
                          className="flex min-h-11 items-center justify-between rounded-sm px-3 text-xs hover:bg-cream"
                        >
                          {category.name}
                          <ArrowUpRight size={14} aria-hidden="true" />
                        </Link>
                      ))}
                    </div>
                  </details>
                </div>
              ) : (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `flex min-h-11 items-center text-xs ${isActive ? 'text-walnut font-semibold' : 'text-bark hover:text-walnut'}`
                  }
                >
                  {label}
                </NavLink>
              ),
            )}
          </nav>
          <div className="flex shrink-0 items-center gap-0.5 sm:gap-2">
            <a
              href={business.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="nav-action order-2 lg:order-1"
              aria-label="Find our showroom"
            >
              <MapPin size={19} strokeWidth={1.5} aria-hidden="true" />
              <span className="hidden lg:inline">Location</span>
            </a>
            <button
              type="button"
              className="nav-action order-1 lg:order-2"
              aria-label="Search furniture"
              aria-haspopup="dialog"
              aria-expanded={searchOpen}
              aria-controls="furniture-search"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={19} strokeWidth={1.5} aria-hidden="true" />
              <span className="hidden lg:inline">Search</span>
            </button>
            <button
              type="button"
              className="icon-button order-3 lg:hidden"
              aria-label="Open navigation"
              aria-controls="mobile-navigation"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <Menu size={22} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </header>

      <Modal
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        labelledBy="menu-title"
        id="mobile-navigation"
      >
        <div className="flex h-full flex-col overflow-y-auto p-6">
          <div className="flex items-center justify-between border-b border-sand pb-5">
            <h2 id="menu-title" className="font-display text-3xl text-walnut">
              Make yourself at home.
            </h2>
            <button
              className="icon-button"
              aria-label="Close navigation"
              onClick={() => setMenuOpen(false)}
            >
              <X size={22} />
            </button>
          </div>
          <nav aria-label="Mobile navigation" className="py-5">
            {navigation.map(({ label, to }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex min-h-14 items-center justify-between border-b border-sand/60 text-lg ${isActive ? 'text-walnut font-semibold' : 'text-bark'}`
                }
                onClick={() => setMenuOpen(false)}
              >
                <span className="flex items-center gap-3">
                  {label === 'Shop' && <Store size={18} />}
                  {label}
                </span>
                <ArrowUpRight size={18} />
              </NavLink>
            ))}
          </nav>
          <p className="eyebrow mb-3 text-bark">Explore by category</p>
          <div className="grid grid-cols-2 gap-2">
            {categories.map((category) => (
              <Link
                key={category.id}
                to={`/shop?category=${category.id}`}
                className="flex min-h-11 items-center rounded-sm bg-cream px-3 text-xs"
                onClick={() => setMenuOpen(false)}
              >
                {category.name}
              </Link>
            ))}
          </div>
          <Link to="/contact" className="text-link mt-6" onClick={() => setMenuOpen(false)}>
            <MapPin size={17} />
            Find our showroom
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </Modal>

      <Modal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        labelledBy="search-title"
        id="furniture-search"
        className="search-dialog w-[calc(100%-2rem)] max-w-xl rounded-sm border-0 bg-cream p-6 text-ink sm:p-10"
      >
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 id="search-title" className="font-display text-4xl text-walnut">
            Find your next favourite.
          </h2>
          <button
            className="icon-button"
            aria-label="Close search"
            onClick={() => setSearchOpen(false)}
          >
            <X size={22} />
          </button>
        </div>
        <form onSubmit={submitSearch} role="search">
          <label htmlFor="global-search" className="mb-2 block text-xs text-bark">
            Search product names, descriptions, or tags
          </label>
          <div className="flex gap-2">
            <input
              id="global-search"
              data-autofocus
              type="search"
              className="field"
              placeholder="Try “sofa” or “oak”"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button className="btn-primary px-4" aria-label="Submit search">
              <Search size={20} />
            </button>
          </div>
        </form>
        <p className="eyebrow mb-3 mt-8 text-bark">A little inspiration</p>
        <div className="flex flex-wrap gap-2">
          {['Sofas', 'Oak', 'Bedroom', 'Small space'].map((tag) => (
            <Link
              key={tag}
              to={`/search?q=${encodeURIComponent(tag)}`}
              className="chip bg-white"
              onClick={() => setSearchOpen(false)}
            >
              {tag}
              <ArrowUpRight size={13} />
            </Link>
          ))}
        </div>
      </Modal>
    </>
  );
}
