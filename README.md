# Manglam Furniture

A responsive furniture showroom catalog built with React (JavaScript), Vite, and Tailwind CSS, with an Express/Mongoose backend foundation.

## Current implementation

The complete customer-facing UI uses a local sample catalog. It includes:

- Home with a photographic hero, category cards, featured pieces, brand introduction, and design values.
- Shop with seven categories, name/category/tag search, category/material/price filters, sorting, and empty states.
- Product details with a main photo, selectable image crops, specifications, searchable tags, related products, and an enquiry link.
- About with a brand introduction, design perspective, and a configurable business-story placeholder.
- Contact with configurable address, phone, hours, email, and Google Maps link. Missing details are clearly labelled; the map button remains disabled until configured.
- Search results sharing the shop's filtering and sorting components.
- A 404 page for missing pages and unknown products.
- Desktop category dropdown, mobile navigation, search dialog, mobile filter drawer, and shared footer.

This is a **catalog**, not an online purchasing system. There are no carts, wishlists, checkout, payments, quantity selectors, or customer accounts. The admin dashboard now supports product and category CRUD in a clearly labelled, in-memory UI preview. Real admin authentication and API persistence are not implemented. JWT and bcryptjs remain installed in the backend for that later milestone.

All product names, specifications, prices, and photographs are illustrative. No actual address, telephone number, business history, store hours, or showroom location has been invented. The existing MVC backend architecture is unchanged.

## Admin dashboard preview

Open <http://127.0.0.1:5173/admin/login> and select **Open dashboard preview**. No credentials are needed. Admin routes are intentionally unprotected in this UI-only phase; the login form demonstrates validation and does not authenticate anyone.

| URL | Purpose |
| --- | --- |
| `/admin` | Redirect to login preview |
| `/admin/login` | Login form, show/hide password, and explicit preview entry |
| `/admin/dashboard` | Product/category totals, recently added pieces, category distribution |
| `/admin/products` | Search, category filter, sorting, pagination, edit and delete |
| `/admin/products/new` | Add product with validation, images, and tags |
| `/admin/products/:id/edit` | Edit the same fields using the reusable product form |
| `/admin/categories` | Add, rename, count, and safely delete categories |
| `/admin/settings` | Preview profile, password form validation, and exit preview |

The admin area uses its own desktop sidebar, mobile drawer, top navigation, profile dropdown, and page layout. Public page components, sample data, and designs are preserved. The admin routes are lazy-loaded through `App.jsx`.

**Product forms:** name, category, INR price (up to two decimals), description, material, color, and length/width/height in centimetres are required. Select 1–8 JPEG, PNG, or WebP images, up to 5 MB each. Unreadable images are rejected. Preview, remove, or choose the main image; choosing a main image moves it to the first gallery position. Tags are optional, limited to 12 of up to 40 characters, and normalised with Unicode NFKC, lowercase, trimmed/collapsed whitespace, and duplicate prevention. Add with Enter or the Add button.

**Catalog management:** search matches product names, category names, and tags. Combine search with a category filter, sort by date/name/price, and page through eight products at a time. Desktop tables become mobile cards. Product deletion requires confirmation. Category names cannot duplicate existing names regardless of casing or extra whitespace. Renaming preserves product assignments; a category containing products cannot be deleted until its products are reassigned or removed.

**Preview limitations:** the mock service copies the existing sample catalog into React context. Changes survive navigation within `/admin`, including exiting to the login preview, but reset on refresh, closing the tab, or leaving the admin area for the public website. Public products never change from preview edits. Images stay in browser memory; nothing is uploaded. Dates are simulated for the sample products and labelled as such in the overview. No localStorage, sessionStorage, credentials, tokens, or API calls are used. Profile changes affect only the preview; password submission clears its inputs and explicitly reports that real credentials were not changed.

The shared service boundary is `frontend/src/admin/services/adminMockService.js`. A later phase can replace its asynchronous methods with Axios calls, add Express/MongoDB persistence, real image storage, and server-backed admin authentication. None of those integrations is included in Step 3.

Admin implementation files (under `frontend/src/admin/`):

```text
AdminRoutes.jsx
context/AdminPreviewContext.jsx
layout/AdminLayout.jsx
components/AdminHeader.jsx
components/AdminSidebar.jsx
components/AdminUI.jsx
components/ConfirmDialog.jsx
components/ImagePicker.jsx
components/ProductForm.jsx
components/ProductTable.jsx
components/StatsCard.jsx
components/TagInput.jsx
pages/AdminLogin.jsx
pages/AdminDashboard.jsx
pages/ManageProducts.jsx
pages/AddProduct.jsx
pages/EditProduct.jsx
pages/ManageCategories.jsx
pages/AdminSettings.jsx
services/adminMockService.js
```

Other Step 3 files: `frontend/src/App.jsx` (admin route registration), `frontend/tests/admin.spec.js` (admin interaction/responsive tests), and this README. Existing admin work was continued in place; no application dependencies or backend changes were needed.

To try the workflow, add a product with sample details and two local images, select its main image, add tags, and save. Find it by a tag, edit it, then test Cancel and Delete in its confirmation dialog. Add a category, assign a product to it, and verify that deletion is blocked until it is empty. Settings can be tested with a sample name/email and sample password text. Refresh to restore the original data.

## Run on Windows

Open two PowerShell terminals in VS Code. The frontend works independently of the backend while it uses sample data.

**Frontend**

```powershell
Set-Location 'C:\Users\oeguf\OneDrive\Desktop\ManglamFurniture\frontend'
npm.cmd run dev
```

Open <http://127.0.0.1:5173>.

**Backend (optional for the sample UI)**

```powershell
Set-Location 'C:\Users\oeguf\OneDrive\Desktop\ManglamFurniture\backend'
npm.cmd run dev
```

Health endpoint: <http://127.0.0.1:5000/api/health>.

Stop either server with **Ctrl+C**. On a fresh checkout, run `npm.cmd ci` inside each application folder first. `npm.cmd` avoids PowerShell execution-policy issues with `npm.ps1`.

Both applications have useful local defaults without `.env` files. To customise them, run `Copy-Item .env.example .env` inside each application folder **once**. Do not overwrite an existing `.env` containing your settings.

## Routes

| URL | Purpose |
| --- | --- |
| `/` | Home |
| `/shop` | Complete collection |
| `/shop?category=sofas` | Category collection |
| `/search?q=oak` | Name, category, and tag search |
| `/products/olive-lounge-sofa` | Example product details |
| `/about` | Brand introduction and story |
| `/contact` | Showroom/contact details |
| `/contact?product=olive-lounge-sofa` | Contact page preserving product context |
| Any unknown route | 404 with recovery links |

Search/filter state lives in URL parameters (`q`, `category`, `material`, `price`, `sort`) so refresh, browser history, and shared links preserve the selection. Search ignores casing and extra whitespace and matches all entered words against the product name, category name, and tags. Price ranges use the numeric sample price in INR. Filtering and sorting are entirely local at this stage.

## Files and customisation

```text
ManglamFurniture/
├── frontend/
│   ├── public/
│   │   ├── images/                  # Local sample photography + source identifiers
│   │   ├── fonts/                   # Local fonts + license files
│   │   └── favicon.svg
│   ├── src/
│   │   ├── components/
│   │   │   ├── Brand.jsx
│   │   │   ├── Header.jsx           # Desktop/mobile navigation and search dialog
│   │   │   ├── Footer.jsx
│   │   │   ├── Modal.jsx            # Focus containment, Escape, and scroll lock
│   │   │   ├── Breadcrumbs.jsx
│   │   │   ├── CategoryCard.jsx
│   │   │   ├── ProductCard.jsx
│   │   │   ├── ProductGallery.jsx
│   │   │   ├── FilterControls.jsx
│   │   │   ├── SectionHeading.jsx
│   │   │   └── VisitBanner.jsx
│   │   ├── data/
│   │   │   ├── catalog.js           # Products, categories, filters, price formatting
│   │   │   └── site.js              # Verified business details and navigation
│   │   ├── hooks/usePageTitle.js
│   │   ├── layouts/SiteLayout.jsx   # Shared page shell and route scroll behaviour
│   │   ├── pages/
│   │   │   ├── HomePage.jsx
│   │   │   ├── CollectionPage.jsx   # Shared Shop and Search Results page
│   │   │   ├── ProductDetailsPage.jsx
│   │   │   ├── AboutPage.jsx
│   │   │   ├── ContactPage.jsx
│   │   │   └── NotFoundPage.jsx
│   │   ├── services/api.js          # Axios client, reserved for future API integration
│   │   ├── App.jsx                  # Page routes
│   │   ├── main.jsx                 # React entry
│   │   └── index.css                # Tailwind theme and shared styles
│   ├── tests/catalog.spec.js        # Browser interaction and responsive checks
│   ├── playwright.config.js
│   ├── vite.config.js
│   ├── .prettierrc.json
│   ├── .env.example
│   ├── .gitignore
│   ├── index.html
│   ├── package.json
│   └── package-lock.json
├── backend/
│   ├── src/
│   │   ├── config/                 # Environment and optional database connection
│   │   ├── controllers/            # Health controller
│   │   ├── routes/                 # Health routes
│   │   ├── models/                 # Reserved for future models
│   │   ├── middleware/             # JSON 404 and error handling
│   │   ├── app.js
│   │   └── server.js
│   ├── .env.example
│   ├── .gitignore
│   ├── package.json
│   └── package-lock.json
├── .gitignore
└── README.md
```

**Business details:** edit `frontend/src/data/site.js`. Replace `null` values with verified text. `openingHours` and `story` support newline-separated text. Set `mapsUrl` to the verified Google Maps location URL to enable directions. A configured phone enables `tel:` links; a configured email enables `mailto:`. The header, footer, About, and Contact pages share this configuration.

**Products:** edit `frontend/src/data/catalog.js`. Each product has a stable ID, category, price, material, colour, dimensions, tags, and images. The current gallery explicitly labels detail/texture crops of the original photo. When real photographs are available, replace each gallery entry with its own image URL, descriptive label, and `zoom: 1`.

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
npm.cmd run build
npm.cmd run test:ui
npm.cmd run format
```

Playwright's Chromium browser must be available. On a fresh machine, install it once:

```powershell
npx.cmd playwright install chromium
```

The test runner starts Vite automatically or reuses a running development server. It checks search (including tag-only searches directly on Shop), category/material/price filtering, sorting, history, empty states, gallery selection, related-product navigation, enquiry context, mobile menus, focus containment, breakpoint transitions, and contact placeholders. It also visits every page at **360px, 390px, 768px, 1024px, and 1440px**, checking overflow, overlapping header controls, navigation visibility, image loading, browser errors, and the absence of purchasing controls. Screenshots and any failure traces are saved under ignored `frontend/test-results/`.

Admin tests additionally cover login/profile/password preview validation, absence of credential persistence or API calls, product add/edit/delete, image type/size/decode/count validation, main-image selection, tag normalisation, category reassignment and deletion protection, pagination, mobile CRUD, and keyboard navigation. All seven admin pages are checked at **360px, 393px, 768px, 1024px, and 1440px**. Public tests also retain the earlier 390px coverage. Run the admin checks with `npm.cmd run test:ui -- tests/admin.spec.js tests/admin-review.spec.js`.

The pre-backend review fixed Settings feedback that could appear above the visible area after submitting a long form on a short mobile viewport. Error/status feedback now receives focus and scrolls into view, including repeated identical validation errors. The sticky admin header uses an opaque background. New regression coverage in `frontend/tests/admin-review.spec.js` tests 400px-high viewports at 360px/393px, all sidebar links, route recovery, populated-category renaming, PNG/JPEG/WebP previews, main-image removal, Unicode tag normalization, and tag limits. Only admin components and tests/documentation changed; public source files, assets, and backend files were checked against their pre-review hashes.

Verification uses Chromium and viewport emulation, with screenshots for visual review. Physical-device file pickers and other browsers still need testing. The existing frontend development server is reused and left running; the project structure and backend are preserved.

Latest pre-backend review: **production build passed; all 34 Chromium tests passed (18 admin and 16 public)**. Admin layouts passed at 360px, 393px, 768px, 1024px, and 1440px without horizontal page overflow, overlapping header controls, broken images, or browser console/runtime errors. The Settings short-viewport regression initially failed at both phone widths and passed after the feedback visibility fix. All requested mock UI features passed; no unresolved test/build failures remain. Public/backend preservation checks found zero changes across 56 recorded files. Real authentication, database/API persistence, durable uploads, and real account changes remain intentionally unimplemented.

From `backend/`:

```powershell
npm.cmd run check
```

With the backend running:

```powershell
Invoke-RestMethod http://127.0.0.1:5000/api/health
Invoke-RestMethod http://127.0.0.1:5173/api/health
```

`npm.cmd start` runs the backend without nodemon. `npm.cmd run preview` in the frontend serves the built UI on port 4173. Production hosting must support SPA fallback to `index.html`. Vite's local API proxy is not bundled into the static build; future deployment needs an API reverse proxy or a configured public `VITE_API_BASE_URL` and corresponding backend CORS origin.

## Backend environment

Setup was verified on **Node.js v20.15.0 / npm 10.8.2**. Vite 6, React's Vite plugin 4, and Mongoose 8 retain compatibility with that Node version. Lockfiles record exact installed versions.

MongoDB is optional for the current health-only backend. With `MONGODB_URI` empty, health reports:

```json
{
  "status": "ok",
  "service": "Manglam Furniture API",
  "database": "not_configured"
}
```

To enable a database connection later, start MongoDB and set `MONGODB_URI=mongodb://127.0.0.1:27017/manglam_furniture` in `backend/.env`, then restart the server. A configured but unreachable database prevents startup. Actual database connectivity and admin authentication have not been implemented/verified as part of the frontend milestone.

`JWT_SECRET` stays blank until authentication is implemented. Keep private values in backend `.env` only; frontend `VITE_*` variables are public browser configuration. Both applications bind to loopback. Changing ports also requires updating the Vite proxy and backend `CLIENT_ORIGIN` as appropriate.

## Dependency notes

The frontend install reports zero known vulnerabilities. The backend's earlier production audit (`npm audit --omit=dev`) also reported zero. Its full audit reported three development-only entries in the `nodemon → chokidar → braces` chain; npm's proposed obsolete nodemon downgrade was not applied. Recheck with `npm.cmd audit` before future backend work.

The frontend UI milestone added only development tools (`@playwright/test` and `prettier`), not a new application framework or backend service. Ask for approval before major architectural changes.
