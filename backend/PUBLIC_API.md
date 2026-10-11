# Public and admin API

The catalog read endpoints are public. All account, product-write, category-write, and image-management endpoints require admin authentication unless stated otherwise.

## Public endpoints

| Method and path         | Response and behavior                                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/products`     | `{ products: [...], pagination: { total, page, limit, totalPages } }`. Returns active products only.                                                                |
| `GET /api/products/:id` | `{ product: {...} }`. The ID must contain 24 hexadecimal characters. Malformed IDs return 400; missing or inactive products return 404.                             |
| `GET /api/categories`   | `{ categories: [...] }`, sorted alphabetically without case sensitivity. Categories are returned even when they have no active products.                            |
| `GET /api/health`       | HTTP 200 with `{ status, service, database }`. This is a liveness response; `database` reports connection state but the endpoint does not run a database operation. |

A public product contains `id`, `name`, `category`, `price`, `description`, `images`, `material`, `color`, `dimensions`, `tags`, and timestamps when present. `category` contains `id`, `name`, `slug`, and optional `description`; it is `null` if the referenced category is missing. Images contain `url` and `publicId`; the first image is the main image. Dimensions contain optional numeric `length`, `width`, and `height`. Internal fields such as `__v`, admin-only `isActive`, and the internal category reference version are excluded.

An empty collection returns HTTP 200 with an empty array. Empty product results include `total: 0` and `totalPages: 0`; a page beyond the last page returns an empty array with the actual total.

### Product list query parameters

| Parameter              | Behavior                                                                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search`               | Case-insensitive literal substring matching across name, description, and tags; 1–100 characters. Unicode and whitespace are normalized and regex characters are escaped. |
| `category`             | Category slug, trimmed and lowercased; up to 100 characters, using letters, digits, and separating hyphens. Unknown slugs return an empty result.                         |
| `minPrice`, `maxPrice` | Inclusive non-negative decimal bounds. Empty values, exponent notation, non-finite values, and reversed ranges are rejected.                                              |
| `sort`                 | `price_asc`, `price_desc`, `newest` (default), or `oldest`; `_id` is the deterministic tie-breaker.                                                                       |
| `page`                 | Positive safe integer, default 1; the calculated offset must also be safe.                                                                                                |
| `limit`                | Positive integer, default 12, maximum 100.                                                                                                                                |

Filters combine. Unknown, repeated, nested, or malformed parameters return 400. Product-detail and category endpoints accept no query parameters. Errors use `{ "message": "..." }`; unexpected errors return a generic 500 response. Unsupported routes return 404.

Example: `/api/products?category=sofas&search=green&minPrice=10000&sort=price_asc&page=1&limit=12`.

## Authentication and admin account

There is no public admin-registration endpoint. `POST /api/admin/login` accepts JSON `{ "email": "...", "password": "..." }`. Email is normalized before lookup. A successful response is `{ token, admin: { id, name, email, role } }`; password hashes are never returned. Invalid credentials share a generic 401 response, malformed input returns 400, and login attempts are rate-limited.

Send the returned JWT as `Authorization: Bearer <access-token>` for protected routes. Middleware verifies the HS256 signature and expiration, reloads the account, checks that it is active and that its token version is current, and requires an `admin` or `superadmin` role. Missing or invalid tokens return 401; insufficient roles return 403.

| Method and path                | Request and response                                                                                                                                                                                                                                       |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/admin/me`            | Returns `{ admin: { id, name, email, role } }` for the current admin.                                                                                                                                                                                      |
| `PATCH /api/admin/me`          | JSON `{ "name": "..." }`; updates the display name and returns `{ admin }`.                                                                                                                                                                                |
| `PATCH /api/admin/me/password` | JSON `{ "currentPassword": "...", "newPassword": "..." }`; verifies the current password, changes its hash, and increments the token version. Success returns `{ "message": "Password changed. Please sign in again." }`; previous tokens are invalidated. |

## Protected product and category APIs

All routes below require `Authorization: Bearer <access-token>`. Request bodies reject unsupported fields.

| Method and path                    | Request and response behavior                                                                                                                                                                                                                                                |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/admin/products`         | Creates a product and returns 201 `{ product }`. Required: `name`, `category` (24-hex category ID), finite non-negative numeric `price`, and `description`. Optional: `material`, `color`, `dimensions`, `tags`, `isActive`, and up to five existing image metadata entries. |
| `PATCH /api/admin/products/:id`    | Updates supplied approved product fields and returns `{ product }`. Invalid IDs, fields, values, or categories return 400; a missing product returns 404. To change images, use the image routes in [IMAGE_API.md](IMAGE_API.md), not this endpoint.                         |
| `DELETE /api/admin/products/:id`   | Soft-deactivates the product and returns `{ message, productId }`. Public product reads then exclude it. Repeating the operation succeeds while the product exists.                                                                                                          |
| `POST /api/admin/categories`       | JSON category fields `name` (required) and optional `description`; derives a normalized slug. Returns 201 `{ category }`; duplicate name/slug returns 409.                                                                                                                   |
| `PATCH /api/admin/categories/:id`  | Updates supplied `name` and/or `description`, returning `{ category }`. A rename preserves the category ID and generates a new slug; duplicate name/slug returns 409.                                                                                                        |
| `DELETE /api/admin/categories/:id` | Deletes an unused category and returns `{ message, categoryId }`. Returns 409 if any product, active or inactive, references it; missing category returns 404.                                                                                                               |

Product creation may include at most five existing image entries containing `url` and optional empty `publicId`; it does not accept Cloudinary public IDs or file uploads. Image order determines the main image: the first item is main; there is no `isMain` field. Image changes and Cloudinary upload behavior are documented in [IMAGE_API.md](IMAGE_API.md).

## Category reference safety and database requirements

Category deletion checks for every product reference, without filtering by `isActive`, and performs the reference check and deletion in one transaction. Product creation and category reassignment increment an internal version on the category document in the same transaction as the product write. This shared category write fence makes concurrent creation/reassignment contend with deletion. Transient transaction errors receive bounded retries; there is no non-transactional fallback.

MongoDB transaction support is required for product creation, category reassignment, and category deletion; use a transaction-capable deployment such as an Atlas replica set or sharded cluster. A standalone MongoDB server is not sufficient. Product deactivation retains its category reference, so inactive products continue to block deletion. A reference-conflict response is 409.

Category create/update operations also require the unique case-insensitive category-name and unique slug indexes. Automatic index creation is disabled. After checking the target database for duplicates, run `node scripts/setupCategoryIndexes.js` from `backend` as a separate, controlled setup operation. It creates the indexes and does not modify category documents. Category writes fail closed if either index is missing.

## Frontend integration

The React storefront reads product and category data from the public API. The shared Axios client is `frontend/src/services/api.js`; product links use MongoDB IDs, category slugs drive storefront filters, and image URLs/dimensions are adapted for the existing presentation components. Material filtering and name sorting remain frontend display behavior.

Admin login and account settings use the protected account routes. Product management and Cloudinary image operations use the protected product routes. Category management uses the protected category routes. Dashboard counts are derived from public catalog reads; there is no dedicated statistics endpoint. The displayed per-category counts include active public products only, while category deletion independently protects references from inactive products too.

## Verification and database safety

From `backend` on Windows:

```powershell
node --test tests/publicCatalog.test.js
npm.cmd run check
npm.cmd start
Invoke-RestMethod http://127.0.0.1:5000/api/health
```

Automated API tests use mocks and do not change real MongoDB records. Transaction tests simulate conflict behavior; they do not replace verification against a transaction-capable MongoDB deployment. Connection options disable automatic collection and index creation. Queries have a five-second execution limit. Literal substring search and large offsets can become slow for large catalogs. Product list and count queries are independent reads, not a transactional snapshot.
