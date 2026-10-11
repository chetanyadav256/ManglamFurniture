import { Armchair } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Brand({ light = false }) {
  return (
    <Link
      to="/"
      className={`inline-flex min-h-11 shrink-0 items-center gap-2.5 ${light ? 'text-cream' : 'text-walnut'}`}
      aria-label="Manglam Furniture home"
    >
      <Armchair className="size-9 shrink-0 sm:size-10" aria-hidden="true" strokeWidth={1.2} />
      <span>
        <span className="block font-display text-[29px] leading-none sm:text-[32px]">Manglam</span>
        <span className="mt-1.5 block text-[8px] tracking-[0.38em] uppercase">Furniture</span>
      </span>
    </Link>
  );
}
