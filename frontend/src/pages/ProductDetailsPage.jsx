import { Link, useParams } from 'react-router-dom';
import { ArrowUpRight, Info, MapPin, Ruler } from 'lucide-react';
import Breadcrumbs from '../components/Breadcrumbs';
import ProductGallery from '../components/ProductGallery';
import ProductCard from '../components/ProductCard';
import SectionHeading from '../components/SectionHeading';
import VisitBanner from '../components/VisitBanner';
import { formatPrice, getCategory, products } from '../data/catalog';
import usePageTitle from '../hooks/usePageTitle';
import NotFoundPage from './NotFoundPage';

export default function ProductDetailsPage() {
  const { productId } = useParams();
  const product = products.find((item) => item.id === productId);
  usePageTitle(product?.name || 'Product not found');
  if (!product) return <NotFoundPage productMissing />;
  const category = getCategory(product.category);
  const related = products
    .filter((item) => item.id !== product.id)
    .sort(
      (a, b) => Number(b.category === product.category) - Number(a.category === product.category),
    )
    .slice(0, 4);

  return (
    <>
      <div className="container-shell">
        <Breadcrumbs
          items={[
            { label: 'Collection', to: '/shop' },
            { label: category.name, to: `/shop?category=${category.id}` },
            { label: product.name },
          ]}
        />
        <section className="grid items-start gap-8 pb-14 pt-2 md:grid-cols-2 lg:gap-16 lg:pb-20">
          <ProductGallery key={product.id} product={product} />
          <div className="lg:pt-5">
            <Link
              to={`/shop?category=${category.id}`}
              className="eyebrow inline-flex min-h-8 items-center gap-2 text-bark"
            >
              {category.name}
              <ArrowUpRight size={13} />
            </Link>
            <h1 className="page-title mt-3">{product.name}</h1>
            <div className="mt-5 flex items-baseline gap-3">
              <p className="text-2xl text-walnut">{formatPrice(product.price)}</p>
              <span className="text-[10px] text-bark">Illustrative price</span>
            </div>
            <p className="mt-6 text-sm leading-8 text-bark">{product.description}</p>
            <dl className="mt-7 grid grid-cols-2 gap-x-5 gap-y-6 border-y border-sand py-6">
              <div>
                <dt className="eyebrow mb-2 text-bark">Material</dt>
                <dd className="text-xs leading-6">
                  {product.material} · {product.wood}
                </dd>
              </div>
              <div>
                <dt className="eyebrow mb-2 text-bark">Colour</dt>
                <dd className="flex items-center gap-2 text-xs leading-6">
                  <span
                    className="size-4 shrink-0 rounded-full border border-black/10"
                    style={{ backgroundColor: product.colorHex }}
                    aria-hidden="true"
                  />
                  {product.color}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="eyebrow mb-2 flex items-center gap-2 text-bark">
                  <Ruler size={14} />
                  Dimensions (W × D × H)
                </dt>
                <dd className="text-xs">{product.dimensions}</dd>
              </div>
            </dl>
            <p className="mt-6 text-xs leading-6 text-bark">
              Imagining this in your home? View our contact details to learn how to get in touch
              once showroom information is available.
            </p>
            <Link
              to={`/contact?product=${product.id}`}
              className="btn-primary mt-5 w-full sm:w-auto"
            >
              <MapPin size={17} />
              Enquire about this piece
              <ArrowUpRight size={16} />
            </Link>
            <div className="mt-6 flex items-start gap-2.5 rounded-sm bg-cream p-4 text-[10px] leading-6 text-bark">
              <Info size={15} className="mt-1 shrink-0" />
              <p>
                This is a sample product. Images, materials, dimensions, colours, and prices are
                illustrative, and do not confirm current stock or availability.
              </p>
            </div>
            <div className="mt-7">
              <h2 className="eyebrow mb-3 text-bark">Explore similar details</h2>
              <div className="flex flex-wrap gap-2">
                {product.tags.map((tag) => (
                  <Link
                    key={tag}
                    to={`/search?q=${encodeURIComponent(tag)}`}
                    className="chip text-[10px]"
                  >
                    {tag}
                    <ArrowUpRight size={12} />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
      <section className="border-t border-sand">
        <div className="container-shell section-space">
          <SectionHeading
            eyebrow="A considered pairing"
            title="You might also love."
            link="View all furniture"
            to="/shop"
          />
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-6 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </div>
      </section>
      <VisitBanner />
    </>
  );
}
