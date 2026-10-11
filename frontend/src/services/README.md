# Public API service

The public Shop and MongoDB Product Details routes use this service. Search, Home and the admin mock service remain unchanged.

Set the public backend origin in `VITE_API_BASE_URL` (see `frontend/.env.example`), then restart Vite. If unset, development uses `http://127.0.0.1:5000`; production uses same-origin `/api`. URLs already ending in `/api` remain supported. Vite variables are public: never put secrets in them.

```js
import { getProducts, getProduct, getCategories } from './api.js';

const { products, pagination } = await getProducts({
  search: 'green',
  category: 'sofas',
  sort: 'price_asc',
  page: 1,
  limit: 12,
});
const { product } = await getProduct('507f1f77bcf86cd799439013');
const { categories } = await getCategories();
```

List parameters: `search`, category slug, `minPrice`, `maxPrice`, `sort`, `page`, `limit`. Sort values are `price_asc`, `price_desc`, `newest`, `oldest`; backend defaults are newest, page 1, limit 12, maximum limit 100. Empty optional values are omitted. Backend validation remains authoritative.

**Tag mismatch:** the backend rejects a separate `tag` query parameter. `getProducts({ tag: 'green' })` maps it to `search=green`, which matches names, descriptions and tags, not exclusively tags. Providing both nonempty `search` and `tag` rejects with `UNSUPPORTED_FILTER`; independent tag filtering needs a later backend change. No client-side post-filtering is done, so pagination stays accurate.

Responses retain their backend envelopes: `{ products, pagination }`, `{ product }`, `{ categories }`. No mapping to mock data is performed. Category objects, MongoDB IDs, `images[].url`, and numeric dimensions will need adaptation during later UI integration.

Failures throw `ApiError` with `message`, `status` (null for network/local errors except malformed product IDs), and `code`. Codes include `HTTP_ERROR`, `NETWORK_ERROR`, `TIMEOUT`, `INVALID_FILTER`, `UNSUPPORTED_FILTER`, and `INVALID_PRODUCT_ID`. Requests time out after 10 seconds. Helpers accept `{ signal }` as their options argument (second argument for product/list requests); Axios cancellation is preserved. Existing `api` and `getHealth` exports remain available.

From `frontend`, verify with `node --test tests/api.unit.js` and `npm.cmd run build`. Service tests mock Axios transport and make no live requests. The `.unit.js` filename keeps Node tests separate from Playwright discovery.

## Shop integration (Step 2)

`useShopCatalog` loads categories and product lists without authentication. It debounces product requests by 250 ms, cancels superseded requests and ignores aborted responses. Loading, retryable errors and empty results use the existing collection styling; failures never fall back to sample products.

Shop previously displayed every match without pagination/load-more controls. It therefore consumes every backend page (requesting up to 100 items per page) before displaying results. A failure on any page shows an error instead of a misleading partial collection. This preserves the UI but will cost more requests/memory as the catalog grows; visible pagination is a future decision, not part of this step.

- Category slugs, search, inclusive price bounds and price sorting are sent to the backend. Exclusive “under”/“over” price boundaries are applied locally after fetching.
- Material selection uses the existing exact material names and runs locally over all matches. A–Z sorting also runs locally. No unsupported material/name-sort/tag parameters are sent.
- The existing Featured choice uses backend newest-first because the schema has no featured flag. No featured badges are fabricated.
- Backend search matches a literal phrase across names, descriptions and tags; it does not search category names or apply the old separate-word matching. Category chips remain the way to filter categories.
- Card names/prices/categories come from the API. The first image URL is used directly. There is no dedicated placeholder asset in this project; `/images/living-room.webp`, the existing showroom photograph, is reused when no image is saved.
- Category artwork is not in the backend schema. Existing artwork is retained for matching slugs; new slugs use the showroom fallback. Category labels/IDs always come from the API.
- Sample-price disclaimers are replaced only for the live Shop. Shared components preserve their mock defaults elsewhere.
- Real product links use MongoDB IDs and open API-backed Product Details. Header/Home category links remain static until their own integration.

Shop browser tests and existing public-layout checks intercept the public APIs with deterministic fixtures; they do not seed or modify the real database. Run `npm.cmd run test:ui -- tests/shop-api.spec.js` for focused checks.

## Product Details integration (Step 3)

`useProductDetails` loads `/api/products/:id` through the existing service, without JWT. MongoDB IDs never fall back to sample records. Known legacy sample slugs retain their previews so the unchanged Home/Search links still work; other malformed IDs and backend 404 responses show the existing not-found page. Network/server failures display a retry action instead of 404. Requests are aborted on navigation, and superseded responses are ignored.

API images are mapped to the existing gallery fields in saved order; image zero is initially main. The existing showroom photograph is used if there are no images. No artificial detail crops are added. Thumbnail/arrow selection remains local, and a new product resets selection. A `min-w-0` constraint prevents the five-image thumbnail row from forcing the mobile grid wider than the viewport.

Real name, price, category, description, material and color are displayed. Missing material/color use “Not specified.” Dimensions are shown as width × length (depth) × height in cm using the existing convention; unavailable axes use a dash, and the dimensions row is omitted if entirely absent. Color swatches and wood descriptions are not fabricated when the API has no such fields. Sample disclaimers remain only on legacy previews.

Related cards use the product list endpoint, favoring its category and excluding the current ID. Failure of that optional request does not hide the main product. Real-product tag links go to the integrated Shop search. Contact navigation preserves the existing `?product=<id>` link, but the unchanged Contact page still resolves sample-only enquiry names; that remaining integration is outside this step.

Focused checks: `npm.cmd run test:ui -- tests/product-details-api.spec.js`. Responses and Cloudinary images are intercepted by tests; no database records or Cloudinary assets are written.

## Admin authentication integration (Step 4A)

The existing admin login calls `POST /api/admin/login`, then sends its Bearer JWT to `GET /api/admin/me` before accepting the session. Admin routes recheck `/me` during in-app route changes, when the window regains focus, and every minute while signed in; unauthorized or forbidden responses clear the in-memory session and return to login. Logout clears the same client state. Product/category workspace operations intentionally remain on the existing mock service.

The JWT is held only in React memory; it is not written to localStorage, sessionStorage, cookies, or URLs. This limits persistence and means a page reload or new tab requires signing in again. Browser memory is still accessible to scripts running in the page, so existing XSS protections remain important. No auth token is sent with public catalog requests.

## Admin product API service (Step 4B.1)

`admin/services/adminProductApi.js` provides reusable create, update, soft-deactivate, image-list, image-upload, image-delete, and main-image selection functions. Each operation that calls the backend takes the current in-memory JWT as its final argument; pass `token` from `useAdminAuth()`. The service uses the shared Axios client and returns backend response envelopes without adapting dashboard data.

Image uploads use `FormData` with repeated `images` fields and do not set a multipart content type manually, so the browser can supply its boundary. The service checks the selected files and current image count against the five-image maximum, accepts JPEG/PNG/WebP only, and caps each file at 5 MiB. The backend remains authoritative, including for concurrent uploads and actual image content. Image deletion and main-image selection use backend `imageId`, not Cloudinary `publicId`. `ApiError` preserves HTTP status for handling 401/403 sessions and provides safe network/server messages.

Focused service tests use a mocked Axios adapter and do not contact MongoDB or Cloudinary. Run `node --test tests/adminProductApi.unit.js tests/api.unit.js` from `frontend`, then `npm.cmd run build`.

## Admin product management integration (Step 4B.2)

The Admin Products list and existing Add/Edit forms now use `admin/context/AdminProductsContext.jsx`. It fetches categories from public `GET /api/categories` and reads all product pages from public `GET /api/products` (100 per page), then submits creates, partial updates, and soft-deactivations through the authenticated Admin Product API service. Category form options use the category MongoDB ID; product list records expose a populated category object, which is mapped to that ID. Prices are sent as numbers and dimensions as `{ length, width, height }`; tags remain strings and are normalized by the backend.

There is no admin product-list endpoint yet. The public endpoint filters to `isActive: true`, so this UI lists active products only and cannot show or restore deactivated products. This limitation is shown on the Manage Products page; adding an admin inventory endpoint is separate backend work and was intentionally not done here. Categories use the existing public list endpoint and do not alter category-management UI.

The existing image picker now stages local previews and uploads selected files only after product details have been saved and a MongoDB product ID is available. Existing products load the protected image-list response to obtain backend `imageId` values. Upload, removal, and main-image selection use the existing authenticated API service; API image responses update the product preview. The backend's first image is main. If an image request fails after product details were saved, the form reports partial completion and permits retrying without creating a duplicate product.

The picker limits the total to five JPEG/PNG/WebP images at 5 MiB each. Uploads use browser-generated multipart boundaries and show request progress where the browser provides totals; backend validation remains authoritative. Focused UI tests intercept product/category/auth/image APIs and perform no database or Cloudinary writes. Run `npm.cmd run test:ui -- tests/admin-products-api.spec.js tests/admin.spec.js tests/admin-review.spec.js` from `frontend`.
