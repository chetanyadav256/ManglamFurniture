import { ArrowUpRight, Clock3, Mail, MapPin, Phone } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import Breadcrumbs from '../components/Breadcrumbs';
import { business } from '../data/site';
import { products } from '../data/catalog';
import usePageTitle from '../hooks/usePageTitle';

export default function ContactPage() {
  usePageTitle('Visit & contact');
  const [params] = useSearchParams();
  const product = products.find((item) => item.id === params.get('product'));
  return (
    <>
      <section className="bg-cream">
        <div className="container-shell">
          <Breadcrumbs items={[{ label: 'Contact' }]} />
          <div className="pb-12 pt-3 text-center sm:pb-16">
            <p className="eyebrow mb-4 text-bark">Let’s make room for a conversation</p>
            <h1 className="page-title">Your next chapter starts here.</h1>
            <p className="mx-auto mt-5 max-w-lg text-sm leading-7 text-bark">
              Have a piece in mind, or simply looking for inspiration?
              <br className="hidden sm:block" /> Find our showroom and contact information below.
            </p>
          </div>
        </div>
      </section>
      <section className="container-shell section-space">
        {product && (
          <div className="mb-9 flex items-center gap-4 rounded-sm border border-sand bg-cream p-4 sm:p-5">
            <img
              src={product.image}
              alt=""
              width="64"
              height="64"
              className="size-16 rounded-sm object-cover"
            />
            <div className="min-w-0">
              <p className="eyebrow mb-1 text-bark">Your selected piece</p>
              <Link
                to={`/products/${product.id}`}
                className="font-display text-2xl text-walnut underline decoration-sand underline-offset-4"
              >
                {product.name}
              </Link>
              <p className="mt-1 text-[10px] text-bark">
                Mention this sample product when contacting us.
              </p>
            </div>
          </div>
        )}
        <div className="grid items-start gap-12 md:grid-cols-2 lg:gap-20">
          <div>
            <p className="eyebrow mb-4 text-bark">Visit Manglam Furniture</p>
            <h2 className="section-title">
              Come in.
              <br />
              Feel at home.
            </h2>
            <div className="mt-8 space-y-7">
              <div className="flex gap-4 border-b border-sand pb-6">
                <MapPin size={22} strokeWidth={1.4} className="mt-1 shrink-0 text-walnut" />
                <div>
                  <h3 className="mb-2 text-sm font-medium">Our showroom</h3>
                  <p className="whitespace-pre-line text-sm leading-7 text-bark">
                    {business.address || 'Store address to be confirmed.'}
                  </p>
                  {!business.address && (
                    <p className="mt-1 text-xs leading-6 text-bark">
                      Our verified location will appear here once provided.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-4 border-b border-sand pb-6">
                <Phone size={21} strokeWidth={1.4} className="mt-1 shrink-0 text-walnut" />
                <div>
                  <h3 className="mb-2 text-sm font-medium">Give us a call</h3>
                  {business.phone ? (
                    <a
                      href={`tel:${business.phone.replace(/[^+\d]/g, '')}`}
                      className="inline-flex min-h-11 items-center text-sm text-walnut underline"
                    >
                      {business.phone}
                    </a>
                  ) : (
                    <p className="text-sm leading-7 text-bark">Contact number to be confirmed.</p>
                  )}
                </div>
              </div>
              <div className="flex gap-4 border-b border-sand pb-6">
                <Clock3 size={22} strokeWidth={1.4} className="mt-1 shrink-0 text-walnut" />
                <div>
                  <h3 className="mb-2 text-sm font-medium">Opening hours</h3>
                  <p className="whitespace-pre-line text-sm leading-7 text-bark">
                    {business.openingHours || 'Store hours will be shared soon.'}
                  </p>
                  {!business.openingHours && (
                    <p className="mt-1 text-xs leading-6 text-bark">
                      Please check back before planning your visit.
                    </p>
                  )}
                </div>
              </div>
              {business.email && (
                <div className="flex gap-4">
                  <Mail size={22} strokeWidth={1.4} className="mt-1 shrink-0" />
                  <div>
                    <h3 className="mb-2 text-sm font-medium">Write to us</h3>
                    <a href={`mailto:${business.email}`} className="break-all text-sm underline">
                      {business.email}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div>
            <img
              src="/images/living-room.webp"
              alt="Interior inspiration: a sunlit living space with warm wood furniture"
              width="1000"
              height="700"
              loading="lazy"
              className="aspect-[4/3] w-full rounded-t-sm object-cover"
            />
            <div className="rounded-b-sm bg-cream p-6 sm:p-8">
              <p className="eyebrow mb-3 text-bark">Find your way to us</p>
              <h3 className="font-display text-3xl text-walnut">We’ll save you a seat.</h3>
              <p className="mt-3 text-sm leading-7 text-bark">
                {business.mapsUrl
                  ? 'Open our verified location in Google Maps to plan your route.'
                  : 'Directions will be available when our showroom location has been confirmed.'}
              </p>
              {business.mapsUrl ? (
                <a
                  href={business.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary mt-6"
                >
                  <MapPin size={16} />
                  Open in Google Maps
                  <ArrowUpRight size={16} />
                </a>
              ) : (
                <>
                  <button
                    type="button"
                    disabled
                    className="btn-primary mt-6 w-full sm:w-auto"
                    aria-describedby="map-status"
                  >
                    <MapPin size={16} />
                    Open in Google Maps
                    <ArrowUpRight size={16} />
                  </button>
                  <p id="map-status" className="mt-3 text-[10px] leading-6 text-bark">
                    Location pending · Map link not yet available.
                  </p>
                </>
              )}
              <p className="mt-5 border-t border-sand pt-4 text-[10px] leading-6 text-bark">
                Interior image is for inspiration and does not depict our showroom.
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className="border-t border-sand">
        <div className="container-shell flex flex-col items-start justify-between gap-6 py-12 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-3xl text-walnut">
              In the meantime, find a little inspiration.
            </h2>
            <p className="mt-3 text-sm text-bark">
              Explore our sample collection and discover your favourites.
            </p>
          </div>
          <Link to="/shop" className="btn-outline shrink-0">
            Explore the collection
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </section>
    </>
  );
}
