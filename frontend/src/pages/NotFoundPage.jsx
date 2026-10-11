import { ArrowLeft, Armchair } from 'lucide-react';
import { Link } from 'react-router-dom';
import usePageTitle from '../hooks/usePageTitle';

export default function NotFoundPage({ productMissing = false }) {
  usePageTitle(productMissing ? 'Product not found' : 'Page not found');
  return (
    <section className="bg-cream">
      <div className="container-shell grid min-h-[600px] items-center gap-10 py-16 md:grid-cols-2 lg:gap-20">
        <div>
          <p className="eyebrow mb-5 text-bark">404 · A little out of place</p>
          <h1 className="page-title">
            Let’s find you
            <br />
            somewhere <span className="italic">comfortable.</span>
          </h1>
          <p className="mt-6 max-w-sm text-sm leading-8 text-bark">
            {productMissing
              ? 'We couldn’t find that piece in our collection. It may have moved, or the link may be incorrect.'
              : 'This page seems to have wandered off. There’s still plenty of inspiration waiting for you.'}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/" className="btn-primary">
              <ArrowLeft size={16} />
              Back to home
            </Link>
            <Link to="/shop" className="btn-outline">
              Explore collection
            </Link>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-sm">
          <img
            src="/images/accent-chair.webp"
            alt="A welcoming upholstered accent chair"
            width="500"
            height="600"
            className="aspect-[4/4.5] w-full rounded-t-full object-cover"
          />
          <div className="absolute -bottom-4 right-3 rounded-sm border border-sand bg-white px-5 py-4 text-xs text-walnut shadow-sm">
            <Armchair size={18} className="mr-2 inline-block" />
            There’s always a seat for you.
          </div>
        </div>
      </div>
    </section>
  );
}
