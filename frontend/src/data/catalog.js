// Illustrative catalog. All prices, specifications, and photographs are samples.
const photo = (name) => `/images/${name}.webp`;

export const categories = [
  {
    id: 'sofas',
    name: 'Sofas',
    image: photo('sofa'),
    description: 'Settle into something beautiful.',
  },
  { id: 'beds', name: 'Beds', image: photo('bed'), description: 'Your own quiet retreat.' },
  {
    id: 'dining',
    name: 'Dining Furniture',
    image: photo('dining'),
    description: 'Room for one more story.',
  },
  {
    id: 'chairs',
    name: 'Chairs',
    image: photo('accent-chair'),
    description: 'A little character. A lot of comfort.',
  },
  {
    id: 'tables',
    name: 'Tables',
    image: photo('living-room'),
    description: 'At the centre of everyday life.',
  },
  {
    id: 'storage',
    name: 'Storage',
    image: photo('storage'),
    description: 'A beautiful place for everything.',
  },
  {
    id: 'home-office',
    name: 'Home Office',
    image: photo('desk'),
    description: 'Make space for your best ideas.',
  },
];

const samples = [
  {
    id: 'olive-lounge-sofa',
    name: 'Olive Lounge Sofa',
    category: 'sofas',
    price: 42900,
    material: 'Fabric',
    wood: 'Solid wood frame',
    color: 'Forest green',
    colorHex: '#52634b',
    dimensions: '210 × 88 × 82 cm',
    image: 'sofa',
    tags: ['three seater', 'modern', 'green', 'living room'],
    featured: true,
    description:
      'An inviting silhouette with deep green upholstery and clean wooden legs. This three-seater concept brings a relaxed, modern presence to a living space.',
  },
  {
    id: 'haven-upholstered-bed',
    name: 'Haven Upholstered Bed',
    category: 'beds',
    price: 54900,
    material: 'Fabric',
    wood: 'Engineered wood frame',
    color: 'Soft ivory',
    colorHex: '#e2d8c8',
    dimensions: '212 × 162 × 115 cm',
    image: 'bed',
    tags: ['queen bed', 'upholstered', 'neutral', 'bedroom'],
    featured: true,
    description:
      'A soft upholstered headboard and an understated profile create a restful focal point. A queen-size bed concept for warm, layered bedrooms.',
  },
  {
    id: 'verdant-dining-set',
    name: 'Verdant Dining Set',
    category: 'dining',
    price: 68900,
    material: 'Stone',
    wood: 'Stone-look top, metal base',
    color: 'Ivory & emerald',
    colorHex: '#396151',
    dimensions: '180 × 90 × 76 cm',
    image: 'dining',
    tags: ['six seater', 'dining set', 'marble look', 'green'],
    featured: true,
    description:
      'A light stone-look dining table paired with jewel-toned seating. This six-seat concept makes an expressive setting for long meals and everyday conversation.',
  },
  {
    id: 'elm-accent-chair',
    name: 'Elm Accent Chair',
    category: 'chairs',
    price: 12900,
    material: 'Wood',
    wood: 'Oak-finish frame, woven upholstery',
    color: 'Pebble grey',
    colorHex: '#98958e',
    dimensions: '56 × 58 × 83 cm',
    image: 'accent-chair',
    tags: ['accent chair', 'oak', 'minimal', 'reading corner'],
    featured: true,
    description:
      'Rounded upholstery meets the simplicity of a warm oak-finish frame. An adaptable accent chair concept for a desk, a quiet corner, or an occasional seat.',
  },
  {
    id: 'sienna-lounge-sofa',
    name: 'Sienna Lounge Sofa',
    category: 'sofas',
    price: 62900,
    material: 'Leather',
    wood: 'Solid wood frame',
    color: 'Warm tan',
    colorHex: '#a96939',
    dimensions: '218 × 92 × 84 cm',
    image: 'living-room',
    position: '80% 60%',
    tags: ['leather', 'tan', 'three seater', 'living room'],
    description:
      'Warm tan tones and generous cushions give this sofa concept an easygoing character. The room photograph illustrates how it might sit alongside natural wood and linen.',
  },
  {
    id: 'meadow-platform-bed',
    name: 'Meadow Platform Bed',
    category: 'beds',
    price: 38900,
    material: 'Wood',
    wood: 'Walnut-finish wood',
    color: 'Natural walnut',
    colorHex: '#765640',
    dimensions: '208 × 158 × 95 cm',
    image: 'bedroom',
    tags: ['queen bed', 'wooden', 'natural', 'bedroom'],
    description:
      'A low, simple wooden bed concept for a softer pace of life. Its understated outline works with layered textiles, muted colours, and a little greenery.',
  },
  {
    id: 'forma-shell-chair',
    name: 'Forma Shell Chair',
    category: 'chairs',
    price: 8900,
    material: 'Fabric',
    wood: 'Upholstered shell, metal legs',
    color: 'Blush rose',
    colorHex: '#c69d9b',
    dimensions: '58 × 60 × 81 cm',
    image: 'chair',
    tags: ['modern', 'accent chair', 'pink', 'compact'],
    description:
      'A sculptural shell and slim legs keep this occasional chair concept light and expressive. Designed in the sample collection as a small-space accent.',
  },
  {
    id: 'orbit-coffee-table',
    name: 'Orbit Coffee Table',
    category: 'tables',
    price: 16900,
    material: 'Wood',
    wood: 'Oak-finish wood',
    color: 'Natural oak',
    colorHex: '#c2a579',
    dimensions: '90 × 90 × 40 cm',
    image: 'living-room',
    position: '50% 75%',
    tags: ['round', 'coffee table', 'oak', 'living room'],
    description:
      'A rounded oak-finish coffee table concept with a sculptural base. The room photograph offers a styling reference for a warm, conversational living space.',
  },
  {
    id: 'aria-wall-cabinet',
    name: 'Aria Wall Cabinet',
    category: 'storage',
    price: 24900,
    material: 'Wood',
    wood: 'Oak-finish engineered wood',
    color: 'Light oak',
    colorHex: '#c7b693',
    dimensions: '80 × 35 × 140 cm',
    image: 'storage',
    tags: ['cabinet', 'wall mounted', 'oak', 'organiser'],
    description:
      'Open shelving and closed compartments create a considered balance in this wall-mounted storage concept. A light oak finish adds warmth without visual weight.',
  },
  {
    id: 'studio-writing-desk',
    name: 'Studio Writing Desk',
    category: 'home-office',
    price: 18900,
    material: 'Wood',
    wood: 'Painted wood top, wood legs',
    color: 'White & oak',
    colorHex: '#ddd9cf',
    dimensions: '120 × 60 × 75 cm',
    image: 'desk',
    tags: ['desk', 'study table', 'work from home', 'compact'],
    description:
      'A simple desk concept for everyday work and fresh ideas. A pale palette and open leg space keep a home office feeling bright and uncluttered.',
  },
  {
    id: 'gather-dining-table',
    name: 'Gather Dining Table',
    category: 'dining',
    price: 32900,
    material: 'Stone',
    wood: 'Stone-look top, metal base',
    color: 'Warm white',
    colorHex: '#ded8ca',
    dimensions: '180 × 90 × 76 cm',
    image: 'dining',
    tags: ['table only', 'six seater', 'marble look', 'dining'],
    description:
      'A standalone dining table concept with a pale stone-look surface and a balanced profile. Chairs shown in the illustrative room photograph are separate.',
  },
  {
    id: 'nook-side-table',
    name: 'Nook Side Table',
    category: 'tables',
    price: 6900,
    material: 'Metal',
    wood: 'Metal frame with wood-look top',
    color: 'Black & walnut',
    colorHex: '#4b3c30',
    dimensions: '45 × 45 × 52 cm',
    image: 'living-room',
    position: '95% 80%',
    tags: ['side table', 'round', 'small space', 'living room'],
    description:
      'A slim circular side table concept for a favourite book or a cup of tea. Its dark frame adds a quiet contrast beside soft upholstery.',
  },
];

export const products = samples.map((product, index) => ({
  ...product,
  image: photo(product.image),
  // Honest sample crops; replace with actual product angles when available.
  images: [
    {
      src: photo(product.image),
      label: 'Full view',
      position: product.position || 'center',
      zoom: 1,
    },
    {
      src: photo(product.image),
      label: 'Detail crop',
      position: product.position || '50% 60%',
      zoom: 1.45,
    },
    {
      src: photo(product.image),
      label: 'Texture crop',
      position: product.position || '50% 80%',
      zoom: 1.9,
    },
  ],
  order: index,
}));

export const materials = ['Wood', 'Fabric', 'Leather', 'Stone', 'Metal'];
export const sortOptions = [
  { value: 'featured', label: 'Featured' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'name', label: 'Name: A–Z' },
];
export const priceOptions = [
  { value: '', label: 'All prices' },
  { value: 'under-20000', label: 'Under ₹20,000' },
  { value: '20000-50000', label: '₹20,000 – ₹50,000' },
  { value: 'over-50000', label: 'Over ₹50,000' },
];
export const getCategory = (id) => categories.find((category) => category.id === id);
export const formatPrice = (price) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(price);

export function filterProducts({
  query = '',
  category = '',
  material = '',
  price = '',
  sort = 'featured',
} = {}) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return products
    .filter((product) => {
      const searchable =
        `${product.name} ${getCategory(product.category).name} ${product.tags.join(' ')}`.toLocaleLowerCase();
      return (
        terms.every((term) => searchable.includes(term)) &&
        (!category || product.category === category) &&
        (!material || product.material === material) &&
        (!price ||
          (price === 'under-20000'
            ? product.price < 20000
            : price === '20000-50000'
              ? product.price >= 20000 && product.price <= 50000
              : price === 'over-50000'
                ? product.price > 50000
                : true))
      );
    })
    .sort((a, b) => {
      if (sort === 'price-asc') return a.price - b.price;
      if (sort === 'price-desc') return b.price - a.price;
      if (sort === 'name') return a.name.localeCompare(b.name);
      return Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || a.order - b.order;
    });
}
