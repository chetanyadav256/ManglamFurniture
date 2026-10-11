import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function ProductGallery({ product }) {
  const [selected, setSelected] = useState(0);
  const current = product.images[selected];
  function move(direction) {
    setSelected((index) => (index + direction + product.images.length) % product.images.length);
  }
  return (
    <div>
      <div
        className="relative aspect-square overflow-hidden rounded-sm bg-cream sm:aspect-[5/4.8]"
        aria-roledescription="carousel"
        aria-label={`${product.name} sample images`}
      >
        <img
          src={current.src}
          alt={`${product.name} — ${current.label.toLowerCase()}`}
          width="1000"
          height="1000"
          fetchPriority="high"
          className="h-full w-full object-cover transition-transform duration-300"
          style={{
            objectPosition: current.position,
            transform: `scale(${current.zoom})`,
            transformOrigin: current.position,
          }}
          data-testid="main-product-image"
        />
        <span className="absolute left-4 top-4 rounded-sm bg-white/95 px-3 py-2 text-[9px] tracking-wider uppercase">
          Sample collection
        </span>
        <div className="absolute bottom-4 right-4 flex gap-2">
          <button
            className="icon-button bg-white shadow-sm"
            aria-label="Previous product image"
            onClick={() => move(-1)}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="icon-button bg-white shadow-sm"
            aria-label="Next product image"
            onClick={() => move(1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="mt-3 flex gap-3" aria-label="Choose a product image">
        {product.images.map((image, index) => (
          <button
            key={image.label}
            className={`relative aspect-square w-20 overflow-hidden rounded-sm border-2 p-0.5 sm:w-24 ${index === selected ? 'border-walnut' : 'border-transparent hover:border-sand'}`}
            aria-label={`Show ${image.label.toLowerCase()}`}
            aria-pressed={selected === index}
            onClick={() => setSelected(index)}
          >
            <span className="block h-full overflow-hidden">
              <img
                src={image.src}
                alt=""
                width="96"
                height="96"
                className="h-full w-full object-cover"
                style={{
                  objectPosition: image.position,
                  transform: `scale(${image.zoom})`,
                  transformOrigin: image.position,
                }}
              />
            </span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-[10px] leading-6 text-bark" aria-live="polite">
        {selected + 1} / {product.images.length} · {current.label}. Illustrative photograph;
        thumbnails include detail crops.
      </p>
    </div>
  );
}
