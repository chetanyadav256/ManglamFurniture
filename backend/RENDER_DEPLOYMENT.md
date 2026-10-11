# Render backend deployment

Configure a Render **Web Service** from the repository with:

- **Root Directory:** `backend`
- **Runtime:** Node
- **Build Command:** `npm ci`
- **Start Command:** `npm start`
- **Health Check Path:** `/api/health`

The backend uses the platform-provided `PORT`. In production it binds to
`0.0.0.0` by default. Leave `HOST` unset on Render unless the service requires
an explicit `0.0.0.0` value.

Set these environment variables in the Render service settings; do not put
production credentials in the repository:

| Variable | Required | Purpose |
| --- | --- | --- |
| `NODE_ENV` | Yes | Set to `production`. |
| `PORT` | Provided by Render | HTTP listening port; Render supplies this value. |
| `HOST` | No | Defaults to `0.0.0.0` in production. |
| `MONGODB_URI` | Yes | MongoDB Atlas connection URI. Allowlist Render's outbound IP addresses in Atlas, or use Atlas network access rules appropriate for the deployment. |
| `JWT_SECRET` | Yes | Random private secret of at least 32 bytes and 12 distinct characters. |
| `JWT_EXPIRES_IN` | Yes | JWT duration such as `1d` or `12h`. |
| `CLIENT_ORIGIN` | Yes | Exact Vercel frontend origin(s), comma-separated; do not use `*` or include URL paths. |
| `CLOUDINARY_CLOUD_NAME` | Yes for image management | Cloudinary account cloud name. |
| `CLOUDINARY_API_KEY` | Yes for image management | Cloudinary API key. |
| `CLOUDINARY_API_SECRET` | Yes for image management | Cloudinary API secret. |

For local development, `.env.example` retains the `127.0.0.1` bind address and
localhost frontend origins. The application trusts one proxy hop only when
`NODE_ENV=production`, matching Render's reverse-proxy deployment. Login
rate-limiting continues to key on Express's `req.ip`, which uses that trusted
proxy configuration in production.

`GET /api/health` is a liveness endpoint and returns HTTP 200 without exposing
credentials or database details. Database readiness is represented by the
existing `database` status field; the endpoint does not perform database
operations.
