import { ArrowUpRight, Heart, Leaf, Shapes } from 'lucide-react';
import { Link } from 'react-router-dom';
import Breadcrumbs from '../components/Breadcrumbs';
import VisitBanner from '../components/VisitBanner';
import { business } from '../data/site';
import usePageTitle from '../hooks/usePageTitle';

export default function AboutPage() {
  usePageTitle('About us');
  return (
    <>
      <div className="container-shell">
        <Breadcrumbs items={[{ label: 'About us' }]} />
      </div>
      <section className="relative isolate flex min-h-[380px] items-center bg-walnut text-white sm:min-h-[460px]">
        <img
          src="/images/interior.webp"
          alt="A warm, light-filled interior with carefully arranged furniture"
          width="1800"
          height="1200"
          fetchPriority="high"
          className="absolute inset-0 -z-20 h-full w-full object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-black/45" />
        <div className="container-shell py-16 text-center">
          <p className="eyebrow mb-5 text-cream">The idea behind Manglam</p>
          <h1 className="page-title mx-auto max-w-3xl text-white">
            Good furniture makes a room.
            <br />
            <span className="italic">You make it home.</span>
          </h1>
        </div>
      </section>
      <section className="container-shell section-space">
        <div className="grid items-start gap-8 md:grid-cols-[.8fr_1.2fr] lg:gap-24">
          <div>
            <p className="eyebrow mb-4 text-bark">About Manglam Furniture</p>
            <h2 className="section-title">
              Every home has
              <br />a story to tell.
            </h2>
          </div>
          <div>
            <p className="font-display text-2xl leading-relaxed text-walnut sm:text-3xl">
              The best spaces don’t just look beautiful.
              <br />
              They feel like they belong to you.
            </p>
            <p className="mt-6 text-sm leading-8 text-bark">
              Manglam Furniture is a place to explore pieces for everyday living — from a
              comfortable seat by the window to a table that brings people together. Our catalog
              helps you look closer, compare details, and find inspiration at your own pace.
            </p>
            <p className="mt-4 text-sm leading-8 text-bark">
              Warm materials, simple forms, and rooms full of character guide the collection you see
              here. This sample edit introduces that vision while our full showroom information is
              being prepared.
            </p>
          </div>
        </div>
      </section>
      <section className="bg-cream">
        <div className="container-shell section-space grid items-center gap-10 md:grid-cols-2 lg:gap-20">
          <img
            src="/images/bedroom.webp"
            alt="A welcoming bedroom with a wooden bed and layered natural fabrics"
            width="900"
            height="1000"
            loading="lazy"
            className="aspect-[5/4.5] w-full rounded-sm object-cover"
          />
          <div>
            <p className="eyebrow mb-4 text-bark">Our story</p>
            <h2 className="section-title">
              Rooted in the feeling
              <br />
              of coming home.
            </h2>
            <p className="mt-6 whitespace-pre-line text-sm leading-8 text-bark">
              {business.story ||
                'Every business has its own beginnings, people, and milestones. The Manglam Furniture story will be shared here once those details have been provided.'}
            </p>
            {!business.story && (
              <p className="mt-4 text-xs leading-7 text-bark">
                For now, get to know our design perspective through the sample collection:
                comfortable forms, natural inspiration, and room for your own personality.
              </p>
            )}
            <Link to="/shop" className="text-link mt-6 border-b border-walnut/30">
              Discover the collection
              <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
      </section>
      <section className="container-shell section-space">
        <div className="mb-12 text-center">
          <p className="eyebrow mb-4 text-bark">Our design perspective</p>
          <h2 className="section-title">What makes a home feel right.</h2>
        </div>
        <div className="grid gap-9 sm:grid-cols-3">
          {[
            {
              icon: Heart,
              title: 'Everyday comfort',
              text: 'Spaces are meant to be lived in. We’re drawn to inviting shapes, thoughtful proportions, and a sense of ease.',
            },
            {
              icon: Leaf,
              title: 'Natural warmth',
              text: 'Wood grain, soft fabrics, and earthy tones bring a quiet connection to the natural world.',
            },
            {
              icon: Shapes,
              title: 'Personal character',
              text: 'A home should reflect the people in it. Mix textures, explore details, and find your own point of view.',
            },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="border-t border-sand pt-7">
              <Icon size={28} strokeWidth={1.2} className="mb-5 text-walnut" />
              <h3 className="font-display text-3xl text-walnut">{title}</h3>
              <p className="mt-4 text-sm leading-7 text-bark">{text}</p>
            </div>
          ))}
        </div>
      </section>
      <VisitBanner />
    </>
  );
}
