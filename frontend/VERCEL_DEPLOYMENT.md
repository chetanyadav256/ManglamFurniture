# Vercel frontend deployment

Create a Vercel project from this repository and configure:

- **Root Directory:** `frontend`
- **Framework Preset:** Vite
- **Install Command:** `npm ci`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`

Set this environment variable for Production (and Preview if those deployments
should use the backend):

| Variable | Value |
| --- | --- |
| `VITE_API_BASE_URL` | The Render backend origin, for example `https://your-backend.onrender.com`; do not include `/api` unless using the already-supported `/api`-prefixed form. |

Vite exposes `VITE_*` variables to browser code. Only the public backend URL
belongs here; never configure MongoDB credentials, Cloudinary API secrets, JWT
secrets, or admin passwords in frontend environment variables.

When `VITE_API_BASE_URL` is configured, the shared API client sends requests to
that backend and appends `/api`. If it is unset, development uses
`http://127.0.0.1:5000`; production uses same-origin `/api` and does not fall
back to localhost. For separately hosted production, configure the Render URL
in Vercel.

`vercel.json` rewrites page routes to the Vite `index.html` entry point, allowing
direct visits and refreshes on product detail, `/shop`, `/search`, and admin
routes. Vercel serves existing static output files normally; the rewrite is the
SPA fallback for route paths.
