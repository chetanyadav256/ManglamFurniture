import { ArrowUpRight, MapPin, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import Brand from './Brand';
import { business, navigation } from '../data/site';
import { categories } from '../data/catalog';

export default function Footer() {
  return (
    <footer className="bg-walnut text-cream">
      <div className="container-shell grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.5fr_.7fr_1fr_1.1fr] lg:gap-12 lg:py-16">
        <div>
          <Brand light />
          <p className="mt-5 max-w-xs text-xs leading-7 text-cream/75">
            For slow mornings, lively evenings, and all the moments that make a house your home.
          </p>
          <p className="eyebrow mt-6 text-[#dfb18d]">Room for a beautiful everyday.</p>
        </div>
        <div>
          <h2 className="eyebrow mb-4 text-[#dfb18d]">Discover</h2>
          <nav aria-label="Footer navigation" className="flex flex-col items-start">
            {navigation.map(({ label, to }) => (
              <Link
                key={to}
                to={to}
                className="flex min-h-10 items-center text-xs text-cream/85 hover:text-white"
              >
                {label === 'Shop' ? 'Our collection' : label}
              </Link>
            ))}
          </nav>
        </div>
        <div>
          <h2 className="eyebrow mb-4 text-[#dfb18d]">Our collections</h2>
          <nav aria-label="Footer categories" className="flex flex-col items-start">
            {categories.slice(0, 5).map((category) => (
              <Link
                key={category.id}
                to={`/shop?category=${category.id}`}
                className="flex min-h-10 items-center text-xs text-cream/85 hover:text-white"
              >
                {category.name}
              </Link>
            ))}
          </nav>
        </div>
        <div>
          <h2 className="eyebrow mb-6 text-[#dfb18d]">Come say hello</h2>
          <p className="flex items-start gap-3 text-xs leading-6 text-cream/80">
            <MapPin size={17} className="mt-1 shrink-0" />
            {business.address || 'Showroom address will be added soon.'}
          </p>
          <p className="mt-5 flex items-start gap-3 text-xs leading-6 text-cream/80">
            <Phone size={16} className="mt-1 shrink-0" />
            {business.phone ? (
              <a href={`tel:${business.phone.replace(/[^+\d]/g, '')}`}>{business.phone}</a>
            ) : (
              'Contact number coming soon.'
            )}
          </p>
          <Link
            to="/contact"
            className="mt-5 inline-flex min-h-11 items-center gap-3 border-b border-cream/40 text-xs"
          >
            Visit & contact
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </div>
      <div className="border-t border-white/15">
        <div className="container-shell flex flex-col justify-between gap-3 py-5 text-[10px] leading-5 text-cream/65 sm:flex-row">
          <p>© {new Date().getFullYear()} Manglam Furniture.</p>
          <p>Sample catalog · Illustrative images, specifications & prices.</p>
        </div>
      </div>
    </footer>
  );
}
