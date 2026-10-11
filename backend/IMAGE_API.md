# Admin image API

All routes require `Authorization: Bearer <access-token>`. Authentication middleware verifies the JWT and reloads the admin, who must be active and have the `admin` or `superadmin` role. The product must exist and be active. These routes are integrated with the authenticated admin product-management UI.

| Method   | Route                                          | Purpose                                                                |
| -------- | ---------------------------------------------- | ---------------------------------------------------------------------- |
| `GET`    | `/api/admin/products/:id/images`               | Fetch the active product and stable image identifiers.                 |
| `POST`   | `/api/admin/products/:id/images`               | Append multipart files using the repeated `images` field. Returns 201. |
| `DELETE` | `/api/admin/products/:id/images/:imageId`      | Remove one image. Returns 200.                                         |
| `PATCH`  | `/api/admin/products/:id/images/:imageId/main` | Move an image to first position. Returns 200.                          |

Product IDs must be 24 hexadecimal characters. `imageId` is the 64-character hash returned by these admin image endpoints; it is derived from saved metadata, remains stable when images are reordered, and is not a Cloudinary public ID. The server locates it only within the specified product. No query parameters are accepted. Management requests accept no body or an empty JSON object.

Responses contain `{ product: {...} }`, following the admin product format, with an additional `imageId` on each image. A removal that saved successfully but could not delete the Cloudinary asset additionally returns `cleanupPending: true`. Public response structures are unchanged.

## Validation and limits

- JPEG, PNG, and WebP; maximum 5 MiB (5 × 1024 × 1024 bytes) per file.
- At most five images total, including existing and legacy images. Empty uploads, extra fields, wrong field names, excessive file counts, and unsupported MIME types are rejected.
- File signatures/headers are checked against declared MIME types; filenames are not trusted. These local checks are not a full image decoder. Cloudinary additionally decodes the content and restricts allowed formats; its returned resource type, format, public ID, and HTTPS URL are checked before saving.
- Multer memory storage only; upload files are not written to disk. At most two upload requests run at a time per Node process, with no buffered queue. A third receives 429 and `Retry-After: 5`. File payloads are capped at 25 MiB per request; temporary buffering and runtime overhead can exceed that payload size. Parsing has a 30-second deadline, bounded multipart fields/parts, and a Content-Length cap when supplied. Cloudinary upload and cleanup operations have timeouts.
- Server-generated IDs use `manglam-furniture/products/<productId>_<UUID>`, with overwrite disabled. The media asset folder is `manglam-furniture/products`.
- Image errors use generic messages without SDK details, credentials, or stack traces. Invalid inputs return 400/415, oversized files 413, unavailable products/images 404, stale concurrent changes/full products 409, busy uploads 429, and storage operation failures 502.

## Image ordering and concurrency

Product image schema entries remain `{ url, publicId }`; the first image in the array is the main image. Uploads append and preserve the previous main image. Main selection moves only the selected image to the front, preserving the relative order of the others. Removing the main image makes the next image main. Removing the last image is allowed.

The initial count check is followed by a MongoDB atomic compare-and-swap of the complete original image array, also requiring `isActive: true`. When competing requests read the same state, only one can commit; the other receives 409 and cleans up its new assets. Product deactivation during an upload also prevents its commit.

The ordinary product JSON PATCH route rejects `images`; image changes must use these routes. Product creation still supports up to five legacy URLs with absent/empty `publicId`, but cannot inject Cloudinary asset IDs. This prevents that route from bypassing upload limits, ownership, and deletion handling. Other product fields and public APIs retain their existing behavior.

## Failure recovery

MongoDB and Cloudinary cannot share an atomic transaction:

1. All uploads must succeed before one image-array update is attempted. On an upload failure or confirmed compare-and-swap conflict, cleanup is attempted for every new server-generated ID, including the failed attempt, without touching previous images.
2. A lost database acknowledgement may hide a successful or still-pending commit. In that case assets are retained and a recovery event is emitted; the server does not risk deleting images that MongoDB may reference. Refresh the admin image GET before retrying after a failed operation.
3. Removal commits the MongoDB change first, then deletes the asset. A failure before an acknowledged commit never triggers deletion. Only IDs matching this product's server-generated namespace can be destroyed. Legacy/external IDs are detached but not deleted remotely. A duplicate saved reference prevents destruction while another reference remains.
4. Failed cleanup and uncertain commits emit a structured `image_cleanup_required` warning containing only the product ID, safe asset IDs, and a fixed reason. Raw SDK/database errors and credentials are never logged. Persist these logs in the deployment's normal log storage.
5. Recovery is manual; there is no durable cleanup queue or background worker. For each logged asset, wait until the request has finished and database availability is restored. Check references across **all** products, including inactive ones, before deleting an unreferenced asset in Cloudinary. Retain any referenced asset. Confirm the exact product namespace, never delete a whole folder, and record the outcome. Retry Cloudinary deletion after transient failures.
6. A process crash or upload timeout can leave an orphan even without a recovery log (a remote upload may finish after cleanup). Periodically reconcile this folder against all saved image public IDs, with a grace period longer than outstanding operations and manual review. Do not automatically remove recent or referenced assets. Log retention and reconciliation are prerequisites for reliable operational cleanup until a durable worker is introduced.

No existing records/assets are migrated or deleted by installing this code. Existing products with more than five images can be reduced using removal; further uploads are rejected until there is room.

## Manual API test

1. Configure the three `CLOUDINARY_*` variables privately in `backend/.env`, and ensure MongoDB/JWT configuration works. Start the backend from `backend` with `npm.cmd run dev`.
2. Use an existing active admin's login token and the ID of an active product that you intend to modify. A manual upload creates Cloudinary assets and updates that product.
3. Send `POST http://127.0.0.1:5000/api/admin/products/<id>/images` with a Bearer token. Choose multipart/form-data and add file entries named `images`; let the client generate the Content-Type boundary. Add no text fields.
4. Expect 201 and HTTPS URLs. Copy an `imageId` from the response (or protected GET response). Use `PATCH .../images/<imageId>/main` with no body to make it main, or `DELETE .../images/<imageId>` to remove it.
5. Use a real JPEG/PNG/WebP under 5 MiB only when intentionally testing against a non-production account and database. Refresh after a 409; wait after a 429. If `cleanupPending` is returned, the database removal succeeded; follow recovery instructions instead of assuming remote deletion succeeded.

## Automated tests

Run `npm.cmd test` and `npm.cmd run check` from `backend`. Image tests use isolated model stubs and mocked storage/SDK methods; they do not connect to Atlas or upload to Cloudinary. They cover validation, limits, ownership, authentication, main ordering, rollback/cleanup, unknown commit outcomes, image-array conflicts, and SDK options. MongoDB transaction conflict tests are deterministic mocks, not live database tests. Cloudinary account permissions and runtime integration still require verification in the configured deployment.

Implementation references: [Multer memory storage and limits](https://expressjs.com/en/resources/middleware/multer/), [Cloudinary Node uploads](https://cloudinary.com/documentation/node_image_and_video_upload), [Cloudinary upload API options](https://cloudinary.com/documentation/image_upload_api_reference).
