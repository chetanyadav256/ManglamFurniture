import { ArrowUpRight, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function VisitBanner() {
  return (
    <section className="bg-cream">
      <div className="container-shell flex flex-col items-start justify-between gap-7 py-12 sm:flex-row sm:items-center sm:py-14">
        <div>
          <p className="eyebrow mb-3 text-bark">From inspiration to your home</p>
          <h2 className="font-display text-4xl text-walnut sm:text-[44px]">
            Some things are better in person.
          </h2>
          <p className="mt-3 text-sm leading-6 text-bark">
            Find our showroom details and plan a visit.
          </p>
        </div>
        <Link to="/contact" className="btn-outline shrink-0">
          <MapPin size={16} />
          Visit our showroom
          <ArrowUpRight size={16} />
        </Link>
      </div>
    </section>
  );
}
