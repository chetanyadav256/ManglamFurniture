import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function SectionHeading({ eyebrow, title, description, link, to }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 sm:mb-10">
      <div>
        {eyebrow && <p className="eyebrow mb-3 text-bark">{eyebrow}</p>}
        <h2 className="section-title">{title}</h2>
        {description && <p className="mt-4 max-w-xl text-sm leading-7 text-bark">{description}</p>}
      </div>
      {link && (
        <Link to={to} className="text-link border-b border-walnut/30">
          {link}
          <ArrowUpRight size={17} />
        </Link>
      )}
    </div>
  );
}
