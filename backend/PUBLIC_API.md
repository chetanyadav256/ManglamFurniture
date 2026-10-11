# Public catalog API

These endpoints require no authentication and expose no write operations.

## Endpoints and responses

- `GET /api/products`: `{ products: [...], pagination: { total, page, limit, totalPages } }`.
- `GET /api/products/:id`: `{ product: {...} }`. IDs must be 24 hexadecimal characters. Malformed IDs return 400; missing or inactive products return 404.
- `GET /api/categories`: `{ categories: [...] }`, sorted alphabetically without case sensitivity.
- `GET /api/health`: existing health response, including database connection status.

A product contains `id`, `name`, `category`, `price`, `description`, `images`, `material`, `color`, `dimensions`, `tags`, and timestamps when present. `category` contains `id`, `name`, `slug`, and optional `description`; it is null if the referenced category is missing. Images contain `url` and `publicId`, with the main image first. Dimensions contain optional numeric `length`, `width`, and `height`. Internal fields such as `__v` are excluded.

Only products with `isActive: true` are returned. Categories are returned even if they have no active products. Empty results return 200 with empty arrays; an empty product result has `total: 0` and `totalPages: 0`. A page beyond the last page returns an empty array while retaining the actual total.

## Product list query parameters

| Parameter | Behavior |
| --- | --- |
| `search` | 1–100 characters; case-insensitive literal substring matching across name, description and tags. Unicode and whitespace are normalized; regex characters are escaped. |
| `category` | Category slug, trimmed and lowercased; up to 100 characters, using letters, digits and separating hyphens. Unknown slugs return an empty result. |
| `minPrice`, `maxPrice` | Inclusive non-negative decimal bounds. Empty values, exponent notation, non-finite values and reversed ranges are rejected. Maximum is JavaScript's safe integer ceiling. |
| `sort` | `price_asc`, `price_desc`, `newest` (default), or `oldest`. ID is the deterministic tie-breaker. |
| `page` | Positive safe integer, default 1; the calculated offset must also be a safe integer. |
| `limit` | Positive integer, default 12, maximum 100. |

All filters combine. Unknown, repeated, nested or malformed parameters return 400. Detail and category endpoints accept no query parameters. Errors use `{ message: "..." }`; unexpected errors return 500 with a generic message and no database details. Unsupported write requests return the existing route-not-found response (404).

Example: `/api/products?category=sofas&search=green&minPrice=10000&sort=price_asc&page=1&limit=12`.

## Later frontend integration

The UI and its mock service are unchanged. A future adapter must:

- Use API product `id` (MongoDB ID) instead of the mock human-readable product ID for detail links.
- Map `category.slug` to the current product's category string. Category cards currently use their slug as `id`; retain the separate database ID when needed.
- Map `images[].url` to the UI's `images[].src`, and use the first image for the current `image` field. Labels and crop settings are presentation concerns absent from the schema.
- Map the dimensions object to `dimensionValues`; format the public dimensions string as width × length × height in cm, as the existing mock service does.
- Handle absent optional values and missing categories. Category images, `featured`, `wood`, and `colorHex` are not stored by the current schemas; do not assume the API supplies them.

## Verification and database safety

From `backend` on Windows:

```powershell
node --test tests/publicCatalog.test.js
npm.cmd run check
npm.cmd start
Invoke-RestMethod http://127.0.0.1:5000/api/health
```

Tests use Node's built-in test runner and mock collection methods without connecting to MongoDB. They run real Express routing, Mongoose query casting and category population. They do not verify MongoDB's regex, collation or index engine against live records.

Connection options disable automatic collection and index creation, so loading models at startup remains read-only. Existing indexes are untouched; provisioning declared indexes is a separate future database task. Queries have a five-second execution limit. Literal substring search can still require scans on large catalogs; large offsets can also become slow. List and count queries are independent reads, not a transactional snapshot.
