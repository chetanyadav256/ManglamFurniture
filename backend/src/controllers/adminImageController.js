import { createHash, randomUUID } from 'node:crypto';
import Product from '../models/Product.js';
import { serializeProduct } from './adminProductController.js';
import { IMAGE_FOLDER } from '../config/cloudinary.js';
import { imageStorage } from '../services/imageStorage.js';
import { MAX_IMAGES, parseImages, imageError } from '../middleware/imageUpload.js';

let uploadsInFlight = 0;
const MAX_CONCURRENT_UPLOADS = 2;
export const imageId = (image) => createHash('sha256').update(`${image.url}\0${image.publicId ?? ''}`).digest('hex');
const metadata = (images = []) => images.map(({ url, publicId = '' }) => ({ url, publicId }));
const responseProduct = (product) => ({ ...serializeProduct(product), images: metadata(product.images).map((image) => ({ ...image, imageId: imageId(image) })) });

async function loadProduct(req) {
  if (!/^[a-f\d]{24}$/i.test(req.params.id)) throw imageError(400, 'Invalid product ID.');
  if (Object.keys(req.query).length) throw imageError(400, 'Query parameters are not supported.');
  const product = await Product.findOne({ _id: req.params.id, isActive: true }).lean();
  if (!product) throw imageError(404, 'Active product not found.');
  return product;
}

function owned(publicId, productId) {
  return new RegExp(`^${IMAGE_FOLDER}/${String(productId).toLowerCase()}_[a-f0-9-]{36}$`).test(publicId);
}

// Exact-array compare-and-swap protects order and count across server processes.
async function replaceImages(product, images) {
  return Product.findOneAndUpdate(
    { _id: product._id, isActive: true, images: metadata(product.images) },
    { $set: { images }, $inc: { __v: 1 } },
    { new: true, runValidators: true },
  ).lean();
}

function recovery(productId, publicIds, reason) {
  // Only server-generated asset IDs and a fixed reason; never log SDK errors.
  console.warn(JSON.stringify({ event: 'image_cleanup_required', productId: String(productId), publicIds, reason }));
}

async function cleanup(productId, publicIds) {
  const failed = [];
  for (const publicId of publicIds) {
    if (!owned(publicId, productId)) continue;
    try { await imageStorage.destroy(publicId); } catch { failed.push(publicId); }
  }
  if (failed.length) recovery(productId, failed, 'cloudinary_cleanup_failed');
  return failed.length > 0;
}

function sendError(res, error) {
  const safe = error.status >= 400 && error.status < 500;
  return res.status(safe ? error.status : 502).json({ message: safe ? error.message : 'Image operation failed. Please retry or contact the administrator.' });
}

export async function uploadProductImages(req, res) {
  if (uploadsInFlight >= MAX_CONCURRENT_UPLOADS) return res.status(429).set('Retry-After', '5').json({ message: 'Image uploads are busy. Please retry shortly.' });
  uploadsInFlight++;
  const attempted = [];
  let product, commitAttempted = false, commitConfirmed = false, committed = false;
  try {
    product = await loadProduct(req);
    if ((product.images?.length ?? 0) >= MAX_IMAGES) throw imageError(409, 'A product can have at most five images.');
    await parseImages(req, res);
    if ((product.images?.length ?? 0) + req.files.length > MAX_IMAGES) throw imageError(409, 'A product can have at most five images.');
    const additions = [];
    for (const file of req.files) {
      const publicId = `${IMAGE_FOLDER}/${String(product._id).toLowerCase()}_${randomUUID()}`;
      attempted.push(publicId);
      const result = await imageStorage.upload(file.buffer, publicId);
      if (result.public_id !== publicId || result.format !== file.detectedFormat
        || result.resource_type !== 'image' || !/^https:\/\//.test(result.secure_url ?? '')) {
        throw imageError(502, 'Image storage returned an invalid result.');
      }
      additions.push({ url: result.secure_url, publicId });
    }
    commitAttempted = true;
    const updated = await replaceImages(product, [...metadata(product.images), ...additions]);
    commitConfirmed = true;
    if (!updated) throw imageError(409, 'Product images changed during upload. Refresh and retry.');
    committed = true;
    return res.status(201).json({ product: responseProduct(updated) });
  } catch (error) {
    if (!committed && attempted.length) {
      // A lost DB acknowledgement may hide a successful or still-pending write.
      // Retain assets for reconciliation; never risk deleting an attached image.
      if (commitAttempted && !commitConfirmed) {
        recovery(product._id, attempted, 'database_commit_uncertain');
      } else {
        await cleanup(product._id, attempted);
      }
    }
    return sendError(res, error);
  } finally {
    req.files = undefined;
    uploadsInFlight--;
  }
}

async function manageImage(req, res, remove) {
  let pendingRemoval;
  try {
    if (!/^[a-f0-9]{64}$/.test(req.params.imageId)) throw imageError(400, 'Invalid image ID.');
    if ((Number(req.get('content-length')) > 0 || req.get('transfer-encoding')) && !req.is('application/json')) throw imageError(415, 'Use an empty body or an empty JSON object.');
    if (req.body != null && (typeof req.body !== 'object' || Array.isArray(req.body) || Object.keys(req.body).length)) throw imageError(400, 'This operation does not accept body fields.');
    const product = await loadProduct(req);
    const images = metadata(product.images);
    const index = images.findIndex((image) => imageId(image) === req.params.imageId);
    if (index < 0) throw imageError(404, 'Image does not belong to this product.');
    const [selected] = images.splice(index, 1);
    if (!remove) images.unshift(selected);
    if (remove && owned(selected.publicId, product._id)) pendingRemoval = { productId: product._id, publicId: selected.publicId };
    const updated = await replaceImages(product, images);
    pendingRemoval = undefined;
    if (!updated) throw imageError(409, 'Product images changed. Refresh and retry.');
    // Only destroy our product-scoped assets, after the DB change succeeds.
    const cleanupPending = remove && !images.some((image) => image.publicId === selected.publicId)
      ? await cleanup(product._id, [selected.publicId]) : false;
    return res.json({ product: responseProduct(updated), ...(cleanupPending ? { cleanupPending: true } : {}) });
  } catch (error) {
    if (pendingRemoval) recovery(pendingRemoval.productId, [pendingRemoval.publicId], 'database_removal_uncertain');
    return sendError(res, error);
  }
}

export const removeProductImage = (req, res) => manageImage(req, res, true);
export const selectMainProductImage = (req, res) => manageImage(req, res, false);

export async function getProductImages(req, res) {
  try { return res.json({ product: responseProduct(await loadProduct(req)) }); }
  catch (error) { return sendError(res, error); }
}
