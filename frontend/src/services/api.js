import axios from 'axios';

// Accept a backend origin or the previously supported /api-prefixed URL.
export function resolveApiBaseUrl(value, development = false) {
  const base = (value?.trim() || (development ? 'http://127.0.0.1:5000' : '')).replace(/\/+$/, '');
  return base.endsWith('/api') ? base : `${base}/api`;
}

export const api = axios.create({
  baseURL: resolveApiBaseUrl(import.meta.env?.VITE_API_BASE_URL, import.meta.env?.DEV),
  timeout: 10000,
});

export class ApiError extends Error {
  constructor(message, { status = null, code = 'API_ERROR' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request(method, path, body, options) {
  try {
    const { data } = await api.request({ ...options, method, url: path, data: body });
    return data;
  } catch (error) {
    // Preserve Axios cancellation so callers can ignore an aborted request.
    if (axios.isCancel(error)) throw error;
    const status = error.response?.status ?? null;
    if (status !== null) {
      throw new ApiError(
        status >= 500
          ? 'The server could not complete the request. Please try again.'
          : typeof error.response.data?.message === 'string'
            ? error.response.data.message
            : 'The request was unsuccessful.',
        { status, code: 'HTTP_ERROR' },
      );
    }
    const timeout = ['ECONNABORTED', 'ETIMEDOUT'].includes(error.code);
    throw new ApiError(
      timeout
        ? 'The request timed out. Please try again.'
        : 'Unable to reach the server. Check your connection and try again.',
      { code: timeout ? 'TIMEOUT' : 'NETWORK_ERROR' },
    );
  }
}

const get = (path, options) => request('get', path, undefined, options);
const post = (path, body, options) => request('post', path, body, options);
const patch = (path, body, options) => request('patch', path, body, options);
const remove = (path, options) => request('delete', path, undefined, options);

export function loginAdmin(email, password) {
  return post('/admin/login', { email, password });
}

export function getCurrentAdmin(token) {
  return get('/admin/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function updateAdminName(name, token) {
  return patch('/admin/me', { name }, { headers: { Authorization: `Bearer ${token}` } });
}

export async function changeAdminPassword(currentPassword, newPassword, token) {
  const result = await patch('/admin/me/password', { currentPassword, newPassword }, adminCategoryOptions(token));
  if (result?.message !== 'Password changed. Please sign in again.') {
    throw new ApiError('Unable to confirm the password-change result.', { code: 'UNCONFIRMED_RESULT' });
  }
  return result;
}

const productParameters = new Set([
  'search',
  'category',
  'tag',
  'minPrice',
  'maxPrice',
  'sort',
  'page',
  'limit',
]);

export async function getProducts(filters = {}, { signal } = {}) {
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) {
    throw new ApiError('Product filters must be an object.', { code: 'INVALID_FILTER' });
  }
  const params = {};
  for (const [key, value] of Object.entries(filters)) {
    if (!productParameters.has(key))
      throw new ApiError(`Unsupported product filter: ${key}.`, { code: 'INVALID_FILTER' });
    if (value === undefined || value === null || (typeof value === 'string' && !value.trim()))
      continue;
    if (
      !['string', 'number'].includes(typeof value) ||
      (typeof value === 'number' && !Number.isFinite(value))
    ) {
      throw new ApiError(`Invalid value for ${key}.`, { code: 'INVALID_FILTER' });
    }
    params[key] = typeof value === 'string' ? value.trim() : value;
  }
  // The backend searches names, descriptions AND tags through `search`.
  // It does not support an independent tag filter or search+tag intersection.
  if (params.tag !== undefined) {
    if (params.search !== undefined)
      throw new ApiError('Separate search and tag filters are not supported by the backend yet.', {
        code: 'UNSUPPORTED_FILTER',
      });
    params.search = params.tag;
    delete params.tag;
  }
  return get('/products', { params, signal });
}

export async function getProduct(id, { signal } = {}) {
  if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) {
    throw new ApiError('Invalid product ID.', { status: 400, code: 'INVALID_PRODUCT_ID' });
  }
  return get(`/products/${id}`, { signal });
}

export function getCategories({ signal } = {}) {
  return get('/categories', { signal });
}

function adminCategoryOptions(token) {
  if (typeof token !== 'string' || !token.trim()) {
    throw new ApiError('Admin authentication is required. Please sign in again.', {
      status: 401,
      code: 'AUTH_REQUIRED',
    });
  }
  return { headers: { Authorization: `Bearer ${token.trim()}` } };
}

export function createAdminCategory(category, token) {
  return post('/admin/categories', category, adminCategoryOptions(token));
}

export async function updateAdminCategory(categoryId, changes, token) {
  if (typeof categoryId !== 'string' || !/^[a-f\d]{24}$/i.test(categoryId)) {
    throw new ApiError('Invalid category ID.', { status: 400, code: 'INVALID_CATEGORY_ID' });
  }
  return patch(`/admin/categories/${categoryId}`, changes, adminCategoryOptions(token));
}

export async function deleteAdminCategory(categoryId, token) {
  if (typeof categoryId !== 'string' || !/^[a-f\d]{24}$/i.test(categoryId)) {
    throw new ApiError('Invalid category ID.', { status: 400, code: 'INVALID_CATEGORY_ID' });
  }
  return remove(`/admin/categories/${categoryId}`, adminCategoryOptions(token));
}

export async function getHealth({ signal } = {}) {
  return get('/health', { signal });
}

export const adminApiRequest = Object.freeze({ get, post, patch, delete: remove });
