import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Outlet } from 'react-router-dom';
import { useAdminAuth } from './AdminAuthContext';
import { ApiError, getCategories, getProducts } from '../../services/api';
import {
  createAdminProduct,
  deactivateAdminProduct,
  deleteAdminProductImage,
  getAdminProductImages,
  setAdminProductMainImage,
  updateAdminProduct,
  uploadAdminProductImages,
} from '../services/adminProductApi';

const AdminProductsContext = createContext(null);

const placeholderImage = '/images/living-room.webp';

function productForManagement(product) {
  const dimensions = product.dimensions ?? {};
  const image = product.images?.[0]?.url || placeholderImage;
  return {
    ...product,
    category: product.category?.id ?? '',
    categoryName: product.category?.name || 'Unknown category',
    image,
    images: (product.images ?? []).map((item) => ({
      ...item,
      src: item.url,
      label: product.name,
      position: 'center',
    })),
    dimensionValues: {
      length: dimensions.length ?? '',
      width: dimensions.width ?? '',
      height: dimensions.height ?? '',
    },
  };
}

function mapManagedImages(images, name) {
  if (
    !Array.isArray(images) ||
    images.some(
      (image) =>
        !image ||
        typeof image.url !== 'string' ||
        !(/^https:\/\//.test(image.url) || /^\/(?!\/)[^\s\\]+$/.test(image.url)) ||
        typeof image.imageId !== 'string' ||
        !/^[a-f\d]{64}$/.test(image.imageId),
    )
  ) {
    throw new ApiError('The server returned invalid product image data.', {
      code: 'INVALID_IMAGE_RESPONSE',
    });
  }
  return images.map((image) => ({
    ...image,
    src: image.url,
    label: name,
    position: 'center',
  }));
}

async function loadActiveCatalog() {
  const [{ categories }, firstPage] = await Promise.all([
    getCategories(),
    getProducts({ page: 1, limit: 100 }),
  ]);
  if (!Array.isArray(categories)) {
    throw new ApiError('The server returned invalid category data.', {
      code: 'INVALID_CATEGORY_RESPONSE',
    });
  }
  if (
    !Array.isArray(firstPage.products) ||
    firstPage.pagination?.page !== 1 ||
    firstPage.pagination?.limit !== 100 ||
    !Number.isInteger(firstPage.pagination?.totalPages) ||
    firstPage.pagination.totalPages < 0
  ) {
    throw new ApiError('The server returned invalid product data.', {
      code: 'INVALID_PRODUCT_RESPONSE',
    });
  }

  const products = [...firstPage.products];
  for (let page = 2; page <= firstPage.pagination.totalPages; page += 1) {
    const result = await getProducts({ page, limit: 100 });
    if (!Array.isArray(result.products) || result.pagination?.page !== page) {
      throw new ApiError('The server returned invalid product pagination data.', {
        code: 'INVALID_PRODUCT_RESPONSE',
      });
    }
    products.push(...result.products);
  }

  return {
    categories,
    products: [...new Map(products.map((item) => [item.id, item])).values()].map(
      productForManagement,
    ),
  };
}

export function AdminProductsProvider() {
  const { token, logout } = useAdminAuth();
  const [catalog, setCatalog] = useState({
    products: [],
    categories: [],
    loading: true,
    error: '',
  });
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setCatalog((current) => ({ ...current, loading: true, error: '' }));
    try {
      const data = await loadActiveCatalog();
      if (requestId.current === currentRequest) {
        setCatalog({ ...data, loading: false, error: '' });
      }
      return data;
    } catch (error) {
      if (requestId.current === currentRequest) {
        setCatalog((current) => ({ ...current, loading: false, error: error.message }));
      }
      throw error;
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => {});
    return () => {
      requestId.current += 1;
    };
  }, [refresh]);

  const handleRequest = useCallback(
    async (operation) => {
      try {
        const result = await operation();
        try {
          await refresh();
        } catch (error) {
          const refreshError = new ApiError(
            `The product was saved, but the list could not be refreshed. ${error.message}`,
            {
              status: error.status,
              code: 'PRODUCT_REFRESH_FAILED',
            },
          );
          refreshError.operationResult = result;
          throw refreshError;
        }
        return result;
      } catch (error) {
        if (error.status === 401 || error.status === 403) logout();
        throw error;
      }
    },
    [logout, refresh],
  );

  const saveProduct = useCallback(
    (payload, productId) =>
      handleRequest(() =>
        productId
          ? updateAdminProduct(productId, payload, token)
          : createAdminProduct(payload, token),
      ),
    [handleRequest, token],
  );

  const deactivateProduct = useCallback(
    (productId) => handleRequest(() => deactivateAdminProduct(productId, token)),
    [handleRequest, token],
  );

  const applyImageResponse = useCallback((productId, response) => {
    if (
      response?.product?.id !== productId ||
      response.product.images?.length > 5 ||
      response.product.images?.some(
        (image) => !image || typeof image.url !== 'string' || typeof image.publicId !== 'string',
      )
    ) {
      throw new ApiError('The server returned invalid product image data.', {
        code: 'INVALID_IMAGE_RESPONSE',
      });
    }
    const images = mapManagedImages(response.product.images, response.product.name);
    setCatalog((current) => ({
      ...current,
      products: current.products.map((product) =>
        product.id === productId
          ? { ...product, images, image: images[0]?.url || placeholderImage }
          : product,
      ),
    }));
    return images;
  }, []);

  const runImageRequest = useCallback(
    async (productId, operation) => {
      try {
        return applyImageResponse(productId, await operation());
      } catch (error) {
        if (error.status === 401 || error.status === 403) logout();
        throw error;
      }
    },
    [applyImageResponse, logout],
  );

  const loadProductImages = useCallback(
    (productId) => runImageRequest(productId, () => getAdminProductImages(productId, token)),
    [runImageRequest, token],
  );

  const uploadProductImages = useCallback(
    (productId, files, onUploadProgress) =>
      runImageRequest(productId, () =>
        uploadAdminProductImages(productId, files, token, onUploadProgress),
      ),
    [runImageRequest, token],
  );

  const removeProductImage = useCallback(
    async (productId, imageId) => {
      try {
        const response = await deleteAdminProductImage(productId, imageId, token);
        return {
          images: applyImageResponse(productId, response),
          cleanupPending: response.cleanupPending === true,
        };
      } catch (error) {
        if (error.status === 401 || error.status === 403) logout();
        throw error;
      }
    },
    [applyImageResponse, logout, token],
  );

  const makeProductImageMain = useCallback(
    (productId, imageId) =>
      runImageRequest(productId, () => setAdminProductMainImage(productId, imageId, token)),
    [runImageRequest, token],
  );

  const value = useMemo(
    () => ({
      ...catalog,
      refresh,
      saveProduct,
      deactivateProduct,
      loadProductImages,
      uploadProductImages,
      removeProductImage,
      makeProductImageMain,
    }),
    [
      catalog,
      deactivateProduct,
      loadProductImages,
      makeProductImageMain,
      refresh,
      removeProductImage,
      saveProduct,
      uploadProductImages,
    ],
  );

  return (
    <AdminProductsContext.Provider value={value}>
      <Outlet />
    </AdminProductsContext.Provider>
  );
}

export function useAdminProducts() {
  const context = useContext(AdminProductsContext);
  if (!context) throw new Error('Admin products context is missing.');
  return context;
}
