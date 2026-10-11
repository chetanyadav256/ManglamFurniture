# Manglam Furniture

A responsive furniture showroom catalog built with React, Vite, and Tailwind CSS, backed by an Express/Mongoose API and MongoDB.

## Current implementation

The customer-facing Home, Shop, Search, and Product Details pages load products and categories from the public API. Shop filters/search use the API, and product detail routes use MongoDB product IDs. About and Contact provide business information and navigation.

The admin dashboard is connected to protected backend APIs for login, profile/password management, product and category management, and Cloudinary image management. Its dashboard counts are derived from public catalog API reads; there is no separate statistics endpoint.

This is a **catalog**, not an online purchasing system. It has no cart, checkout, payment processing, or customer accounts. Product copy, prices, and catalog photography remain illustrative. The verified business contact details are centralized in `frontend/src/data/site.js`; email and opening hours are intentionally omitted because they have not been provided.

Product images are limited to five per product. The first image in the ordered image array is the main image. Category deletion is rejected if any product references that category, whether active or inactive. Product creation, category reassignment, and category deletion coordinate through MongoDB transactions and a write to the category record. Use a transaction-capable MongoDB deployment (such as an Atlas replica set or sharded cluster); these operations do not fall back to non-transactional writes.

## Admin dashboard

Open <http://127.0.0.1:5173/admin/login> and sign in using an admin account provisioned by the backend CLI. Admin routes require an authenticated, active admin account; the browser keeps authentication in memory and does not persist tokens in local or session storage.

| URL                        | Purpose                                                                       |
| -------------------------- | ----------------------------------------------------------------------------- |
| `/admin/login`             | Admin sign-in                                                                 |
| `/admin/dashboard`         | Active product count, per-category active product counts, and recent products |
| `/admin/products`          | Search, filter, sort, edit, deactivate, and manage product images             |
| `/admin/products/new`      | Create a product and its catalog details                                      |
| `/admin/products/:id/edit` | Edit a product                                                                |
| `/admin/categories`        | Create, rename, count, and delete categories                                  |
| `/admin/settings`          | Update the signed-in admin display name or password                           |

Image uploads accept JPEG, PNG, and WebP, up to 5 MiB each, with no more than five images in total for a product. Admins can reorder the main image or remove images. Product deactivation is a soft delete; it removes the product from public catalog results. Category deletion remains blocked by references from active and inactive products.

## Run on Windows

Open two PowerShell terminals in VS Code. The catalog and admin dashboard require the backend and a configured MongoDB database.

**Frontend**

```powershell
Set-Location 'C:\Users\oeguf\OneDrive\Desktop\ManglamFurniture\frontend'
npm.cmd run dev
```

Open <http://127.0.0.1:5173>.

**Backend**

```powershell
Set-Location 'C:\Users\oeguf\OneDrive\Desktop\ManglamFurniture\backend'
npm.cmd run dev
```

Health endpoint: <http://127.0.0.1:5000/api/health>.

Stop either server with **Ctrl+C**. On a fresh checkout, run `npm.cmd ci` inside each application folder first. `npm.cmd` avoids PowerShell execution-policy issues with `npm.ps1`.

Copy each `.env.example` to `.env` once and set the required private values before starting the backend. Do not overwrite an existing `.env`. `MONGODB_URI` and a sufficiently strong `JWT_SECRET` are required by the backend; Cloudinary variables are required for image management. In local development the API client defaults to `http://127.0.0.1:5000`; `VITE_API_BASE_URL` can override that base URL.

## Routes

| URL                                  | Purpose                                         |
| ------------------------------------ | ----------------------------------------------- |
| `/`                                  | Home                                            |
| `/shop`                              | Complete collection                             |
| `/shop?category=sofas`               | Category collection                             |
| `/search?q=oak`                      | Name, category, and tag search                  |
| `/products/:id`                      | Product details, using the product's MongoDB ID |
| `/about`                             | Brand introduction and story                    |
| `/contact`                           | Showroom/contact details                        |
| `/contact?product=olive-lounge-sofa` | Contact page preserving product context         |
| Any unknown route                    | 404 with recovery links                         |

Search/filter state lives in URL parameters (`q`, `category`, `material`, `price`, `sort`) so refresh, browser history, and shared links preserve the selection. Product/category data comes from the API; text search, category and price constraints are sent to the API, with the current material and name-sort controls applied in the frontend.

## Files and customisation

The frontend API client is `frontend/src/services/api.js`; admin API and state integration lives under `frontend/src/admin/`. The Express API, models, middleware, and services are under `backend/src/`. Detailed route references are in [backend/PUBLIC_API.md](backend/PUBLIC_API.md) and [backend/IMAGE_API.md](backend/IMAGE_API.md).

**Business details:** `frontend/src/data/site.js` is the shared source for the confirmed address, both telephone links, Google Maps location, and Instagram profile. Email and opening hours are unset and omitted from the UI; do not invent them.

**Products:** product records are stored in MongoDB and served by the backend API. `frontend/src/data/catalog.js` also contains local presentation data, such as category artwork and sample content used by preview/fallback components; it is not the live catalog source. The API stores product category, price, material, color, dimensions, tags, and ordered images.

**Brand theme:** `frontend/src/index.css` defines dark wood `#593B2B`, warm brown `#C68A57`, cream `#F7F2EB`, and white. Typography uses self-hosted Cormorant Garamond and DM Sans. Tailwind runs through `@tailwindcss/vite` with CSS-first theme configuration.

## Responsive and accessibility behaviour

- Two-column product grids on 360px and 390px phones, expanding on larger screens.
- Compact, wrapping category choices with no horizontally scrolling page layouts.
- Desktop filters switch to a mobile dialog below 1024px.
- Navigation switches to a mobile drawer below 1024px.
- At 1024px and above, the header shows Home, Shop (with its shop icon), About, Contact, Location, and Search. Phone/tablet headers keep the logo and three touch-friendly menu, search, and location controls.
- Homepage hero typography scales smoothly from 40px to 64px with `clamp()`. Public page headings share a fluid type scale, and the hero overlay maintains text contrast across breakpoints.
- Mobile menus and filters close when switching to desktop, release scroll locking, and restore focus to a visible element.
- Dialogs contain keyboard focus, close with Escape, restore trigger focus, and lock background scrolling.
- Controls have labels, focus indicators, and touch-friendly hit areas; selected filters and gallery images expose their state.
- Local images have descriptive alternative text, reserved aspect ratios, and lazy loading where appropriate.
- Motion is disabled when `prefers-reduced-motion` is enabled.

## Checks

From `frontend/`:

```powershell
npm.cmd run test:unit
npm.cmd run test:ui
npm.cmd run build
```

Playwright's Chromium browser must be available for browser tests. On a fresh machine, install it once:

```powershell
npx.cmd playwright install chromium
```

The frontend unit tests validate API URL resolution and admin API adapters. Playwright tests exercise public and admin flows, including API behavior and responsive layouts.

From `backend/`:

```powershell
npm.cmd test
npm.cmd run check
```

Backend tests use mocks or isolated test data; they do not change real MongoDB records or upload/delete Cloudinary assets. Transaction tests simulate MongoDB conflict behavior and do not replace verification against the configured transaction-capable database.

## Backend setup and deployment

The backend requires `MONGODB_URI`, `JWT_SECRET`, and `JWT_EXPIRES_IN` in its private `.env`. Set Cloudinary's `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` to enable image management. See `backend/.env.example` for variable names and placeholders. Never put backend secrets in frontend environment variables or commit a real `.env`.

Before creating the initial admin, review the target database and run these separate, controlled setup steps from `backend/`:

```powershell
node scripts/createAdmin.js --create-index
node scripts/setupCategoryIndexes.js
node scripts/createAdmin.js
```

The first command creates the admin email unique index; the second creates category name/slug unique indexes. The last command prompts for the account details and accepts its password through hidden interactive input. These are manual operations and never run at server startup.

Category-reference transactions require MongoDB transaction support. Product creation, category reassignment, and category deletion rely on those transactions to preserve the no-dangling-reference rule. Use a transaction-capable MongoDB deployment; standalone MongoDB is not suitable.

Render and Vercel configuration is prepared but **the application is not deployed**. Follow [backend/RENDER_DEPLOYMENT.md](backend/RENDER_DEPLOYMENT.md) and [frontend/VERCEL_DEPLOYMENT.md](frontend/VERCEL_DEPLOYMENT.md). Render uses root `backend`, `npm ci`, `npm start`, and health path `/api/health`; the server uses the platform `PORT`, binds to `0.0.0.0` in production, and requires an explicit `CLIENT_ORIGIN` allowlist. Vercel uses root `frontend`, Vite, `npm ci`, `npm run build`, output `dist`, and the SPA rewrite in `frontend/vercel.json`. Production still requires setting private backend environment variables, exact frontend CORS origin(s), the frontend `VITE_API_BASE_URL`, and MongoDB/Cloudinary access as applicable.

`GET /api/health` returns HTTP 200 with a database status field; it is a liveness endpoint, not proof that all database operations or external integrations are ready.

## Dependency notes

The frontend install reports zero known vulnerabilities. The backend's earlier production audit (`npm audit --omit=dev`) also reported zero. Its full audit reported three development-only entries in the `nodemon → chokidar → braces` chain; npm's proposed obsolete nodemon downgrade was not applied. Recheck with `npm.cmd audit` before future backend work.

Lockfiles are committed for reproducible installs. Review current audit output before deployment; historical audit results are not a guarantee about present dependency advisories.
