import { ArrowUpRight, Armchair, Leaf, Ruler, ScanSearch } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import CategoryCard from '../components/CategoryCard';
import ProductCard from '../components/ProductCard';
import SectionHeading from '../components/SectionHeading';
import VisitBanner from '../components/VisitBanner';
import { categories } from '../data/catalog';
import usePageTitle from '../hooks/usePageTitle';
import { getProducts } from '../services/api';

const productImageFallback = '/images/living-room.webp';

const values = [
  {
    icon: Armchair,
    title: 'Comfort, considered',
    text: 'Explore inviting shapes and thoughtful proportions for the way you live.',
  },
  {
    icon: Leaf,
    title: 'Materials with character',
    text: 'Discover natural textures, warm wood finishes, and tactile fabrics.',
  },
  {
    icon: Ruler,
    title: 'Find your perfect fit',
    text: 'Compare dimensions, materials, and details before choosing a piece.',
  },
  {
    icon: ScanSearch,
    title: 'A simpler way to explore',
    text: 'Browse at your own pace. Find inspiration for one corner or a whole room.',
  },
];

export default function HomePage() {
  usePageTitle('Furniture for a beautiful everyday');
  const [attempt, setAttempt] = useState(0);
  const [productState, setProductState] = useState({ loading: true, products: [], error: '' });

  useEffect(() => {
    const controller = new AbortController();
    setProductState({ loading: true, products: [], error: '' });

    // The backend has no featured flag, so the edit is the four newest active products.
    getProducts({ sort: 'newest', page: 1, limit: 4 }, { signal: controller.signal })
      .then(({ products }) => {
        if (controller.signal.aborted) return;
        setProductState({
          loading: false,
          error: '',
          products: products.map((product) => ({
            id: product.id,
            name: product.name,
            price: product.price,
            categoryName: product.category?.name || 'Furniture',
            image: product.images?.[0]?.url || productImageFallback,
            isSample: false,
          })),
        });
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setProductState({
            loading: false,
            products: [],
            error: error.message || 'Unable to load furniture.',
          });
        }
      });

    return () => controller.abort();
  }, [attempt]);

  return (
    <>
      <section
        className="relative isolate flex min-h-[480px] items-center overflow-hidden bg-walnut text-white sm:min-h-[510px] lg:min-h-[560px]"
        aria-labelledby="home-hero-title"
      >
        <img
          src="/images/living-room.webp"
          alt="Sunlit living room with a warm tan sofa, natural wood table, and soft accent chairs"
          fetchPriority="high"
          width="1800"
          height="1350"
          className="absolute inset-0 -z-20 h-full w-full object-cover object-[65%_center] sm:object-center"
        />
        <div className="hero-shade absolute inset-0 -z-10" />
        <div className="container-shell py-14 sm:py-16 lg:py-20">
          <p className="eyebrow mb-5 flex items-center gap-3 text-cream">
            <span className="h-px w-8 bg-[#dfb18d]" />
            Spaces with a soul
          </p>
          <h1 id="home-hero-title" className="hero-title max-w-[620px]">
            Beautiful furniture.
            <br />
            Even better <span className="italic text-[#e9c9a8]">living.</span>
          </h1>
          <p className="mt-5 max-w-[350px] text-sm leading-7 text-white/95 sm:max-w-[390px]">
            Warm textures. Timeless forms. Thoughtful pieces that make your space feel like you.
          </p>
          <Link to="/shop" className="btn-light mt-6 sm:mt-7">
            Explore collection
            <ArrowUpRight size={19} />
          </Link>
          <p className="mt-6 text-[10px] leading-5 tracking-[0.12em] text-white/85 uppercase">
            Thoughtfully chosen. Beautifully lived in.
          </p>
        </div>
        <div className="absolute bottom-9 right-12 hidden items-center gap-3 text-[10px] tracking-[0.12em] text-white/85 lg:flex">
          <span className="h-px w-10 bg-white/60" />
          THE ART OF FEELING AT HOME
        </div>
      </section>

      <div className="border-b border-sand bg-cream">
        <div className="container-shell grid grid-cols-3 gap-3 py-5 text-center text-[9px] text-bark sm:py-6 sm:text-xs">
          <span className="flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-3">
            <Armchair size={18} strokeWidth={1.3} />
            Considered comfort
          </span>
          <span className="flex flex-col items-center justify-center gap-2 border-x border-sand sm:flex-row sm:gap-3">
            <Leaf size={18} strokeWidth={1.3} />
            Natural inspiration
          </span>
          <span className="flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-3">
            <Ruler size={18} strokeWidth={1.3} />
            Details that matter
          </span>
        </div>
      </div>

      <section className="container-shell section-space">
        <SectionHeading
          eyebrow="A place for everything"
          title="Find your kind of comfort."
          link="Explore all categories"
          to="/shop"
        />
        <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 sm:gap-6 lg:grid-cols-6">
          {categories.slice(0, 6).map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      </section>

      <section className="bg-cream/70">
        <div className="container-shell section-space">
          <SectionHeading
            eyebrow="The Manglam edit"
            title="Pieces to come home to."
            description="Discover a considered edit from our latest active furniture collection."
            link="View the collection"
            to="/shop"
          />
          {productState.loading ? (
            <p role="status" className="py-8 text-center text-sm leading-7 text-bark">
              Loading furniture…
            </p>
          ) : productState.error ? (
            <div
              role="alert"
              className="rounded-sm border border-sand bg-cream/50 px-6 py-10 text-center"
            >
              <h3 className="font-display text-3xl text-walnut">Unable to load the collection.</h3>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-bark">
                {productState.error}
              </p>
              <button className="btn-primary mt-6" onClick={() => setAttempt((value) => value + 1)}>
                Try again
              </button>
            </div>
          ) : productState.products.length ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-6 lg:grid-cols-4">
              {productState.products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <p role="status" className="py-8 text-center text-sm leading-7 text-bark">
              Our furniture collection is taking shape. Please check back soon.
            </p>
          )}
        </div>
      </section>

      <section className="container-shell section-space">
        <div className="grid items-center gap-9 md:grid-cols-2 lg:gap-20">
          <div className="relative">
            <img
              src="/images/interior.webp"
              alt="A considered interior with natural textures and softly layered furniture"
              width="900"
              height="1000"
              loading="lazy"
              className="aspect-[5/4] w-full rounded-sm object-cover md:aspect-[5/5.2]"
            />
            <span className="absolute bottom-5 left-5 max-w-[calc(100%-2.5rem)] rounded-sm bg-cream/95 px-5 py-3 font-display text-xl text-walnut">
              A little warmth goes a long way.
            </span>
          </div>
          <div className="max-w-lg">
            <p className="eyebrow mb-5 text-bark">More than a room</p>
            <h2 className="section-title">
              A home is a feeling.
              <br />
              <span className="italic">Make it yours.</span>
            </h2>
            <p className="mt-6 text-sm leading-8 text-bark">
              The chair you curl up in. The table where everyone gathers. The quiet corner that
              feels entirely your own.
            </p>
            <p className="mt-4 text-sm leading-8 text-bark">
              At Manglam Furniture, our collection starts with those everyday moments. Explore an
              approach to furniture that feels warm, personal, and easy to live with.
            </p>
            <Link to="/about" className="text-link mt-6 border-b border-walnut/30">
              Meet Manglam Furniture
              <ArrowUpRight size={17} />
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-sand">
        <div className="container-shell pb-16 pt-14 sm:pb-20">
          <div className="mb-10 text-center">
            <p className="eyebrow mb-3 text-bark">Why choose Manglam</p>
            <h2 className="section-title">Thoughtful in every detail.</h2>
          </div>
          <div className="grid gap-x-8 gap-y-9 sm:grid-cols-2 lg:grid-cols-4">
            {values.map(({ icon: Icon, title, text }) => (
              <div key={title} className="text-center">
                <Icon
                  size={30}
                  strokeWidth={1.2}
                  className="mx-auto mb-5 text-walnut"
                  aria-hidden="true"
                />
                <h3 className="font-display text-2xl text-walnut">{title}</h3>
                <p className="mx-auto mt-3 max-w-[260px] text-xs leading-7 text-bark">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <VisitBanner />
    </>
  );
}
