import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save } from 'lucide-react';
import { useAdminProducts } from '../context/AdminProductsContext';
import { validateProduct } from '../services/adminMockService';
import { BusyLabel, Field, FormAlert, panelClass } from './AdminUI';
import ImagePicker from './ImagePicker';
import TagInput from './TagInput';

export default function ProductForm({ product }) {
  const {
    categories,
    loading: catalogLoading,
    error: catalogError,
    refresh,
    saveProduct,
    loadProductImages,
    uploadProductImages,
    removeProductImage,
    makeProductImageMain,
  } = useAdminProducts();
  const navigate = useNavigate();
  const [values, setValues] = useState(() => ({
    name: product?.name || '',
    category: product?.category || '',
    price: product?.price ?? '',
    description: product?.description || '',
    material: product?.material || '',
    color: product?.color || '',
    length: product?.dimensionValues.length ?? '',
    width: product?.dimensionValues.width ?? '',
    height: product?.dimensionValues.height ?? '',
    images: product?.images.map((image) => ({ ...image })) || [],
    tags: [...(product?.tags || [])],
  }));
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [imagesBusy, setImagesBusy] = useState(false);
  const [imageError, setImageError] = useState('');
  const [imageStatus, setImageStatus] = useState('');
  const [imageStateUncertain, setImageStateUncertain] = useState(false);
  const [mainImageId, setMainImageId] = useState(product?.images?.[0]?.imageId || '');
  const productId = useRef(product?.id || null);
  const savedPayload = useRef(null);

  useEffect(() => {
    if (!product?.id) return undefined;
    let active = true;
    setImagesBusy(true);
    loadProductImages(product.id)
      .then((images) => {
        if (!active) return;
        setValues((previous) => ({ ...previous, images }));
        setMainImageId(images[0]?.imageId || '');
        setImageError('');
      })
      .catch((issue) => {
        if (active) setImageError(issue.message);
      })
      .finally(() => {
        if (active) setImagesBusy(false);
      });
    return () => {
      active = false;
    };
  }, [loadProductImages, product?.id]);

  function change(key, value) {
    setValues((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
  }
  function inputProps(key) {
    return {
      id: `product-${key}`,
      name: key,
      value: values[key],
      onChange: (event) => change(key, event.target.value),
      className: 'field rounded-md',
      required: true,
      'aria-invalid': Boolean(errors[key]),
      'aria-describedby': errors[key] ? `product-${key}-error` : undefined,
    };
  }

  function addImages(images) {
    setValues((previous) => ({ ...previous, images }));
    if (!images.some((image) => image.imageId === mainImageId || image.id === mainImageId)) {
      setMainImageId(images[0]?.imageId || images[0]?.id || '');
    }
    setImageError('');
  }

  async function removeImage(image) {
    if (!image.imageId) {
      setImageError(
        'This saved image is missing its backend image ID. Reload the product and try again.',
      );
      return;
    }
    setImagesBusy(true);
    setImageError('');
    setImageStatus('Removing image…');
    try {
      const result = await removeProductImage(productId.current, image.imageId);
      const managedImages = result.images;
      const pendingImages = values.images.filter((item) => item.file);
      setValues((previous) => ({ ...previous, images: [...managedImages, ...pendingImages] }));
      setMainImageId(managedImages[0]?.imageId || pendingImages[0]?.id || '');
      setImageStatus(
        result.cleanupPending
          ? 'Image removed from the product. Cloudinary cleanup is still pending.'
          : '',
      );
    } catch (issue) {
      if (issue.status === null || issue.status >= 500) {
        setImageStateUncertain(true);
        setImageError(
          `${issue.message} The server may have completed the change; reload the product before retrying image changes.`,
        );
      } else {
        setImageError(issue.message);
      }
      setImageStatus('');
    } finally {
      setImagesBusy(false);
    }
  }

  async function setMainImage(image) {
    setImageError('');
    if (image.file) {
      setMainImageId(image.id);
      return;
    }
    if (!image.imageId) {
      setImageError(
        'This saved image is missing its backend image ID. Reload the product and try again.',
      );
      return;
    }
    setImagesBusy(true);
    setImageStatus('Updating the main image…');
    try {
      const managedImages = await makeProductImageMain(productId.current, image.imageId);
      const pendingImages = values.images.filter((item) => item.file);
      setValues((previous) => ({ ...previous, images: [...managedImages, ...pendingImages] }));
      setMainImageId(managedImages[0]?.imageId || '');
      setImageStatus('');
    } catch (issue) {
      if (issue.status === null || issue.status >= 500) {
        setImageStateUncertain(true);
        setImageError(
          `${issue.message} The server may have completed the change; reload the product before retrying image changes.`,
        );
      } else {
        setImageError(issue.message);
      }
      setImageStatus('');
    } finally {
      setImagesBusy(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (busy || imagesBusy) return;
    // Include the latest native field values, including browser autofill.
    const submission = { ...values, ...Object.fromEntries(new FormData(event.currentTarget)) };
    setValues(submission);
    const next = validateProduct(submission, categories, { requireImages: false });
    setErrors(next);
    setError('');
    if (Object.keys(next).length) {
      setError('Please check the highlighted fields before saving.');
      document.getElementById(`product-${Object.keys(next)[0]}`)?.focus();
      return;
    }
    setBusy(true);
    setImageError('');
    setImageStatus('');
    let detailsSaved = false;
    let uncertainImageOperation = '';
    try {
      const payload = {
        name: submission.name,
        category: submission.category,
        price: Number(submission.price),
        description: submission.description,
        material: submission.material,
        color: submission.color,
        dimensions: {
          length: Number(submission.length),
          width: Number(submission.width),
          height: Number(submission.height),
        },
        tags: submission.tags,
      };
      const serializedPayload = JSON.stringify(payload);
      detailsSaved = savedPayload.current === serializedPayload;
      if (!productId.current || savedPayload.current !== serializedPayload) {
        let response;
        try {
          response = await saveProduct(payload, productId.current);
        } catch (issue) {
          const savedId = issue.operationResult?.product?.id;
          if (typeof savedId === 'string' && /^[a-f\d]{24}$/i.test(savedId)) {
            productId.current = savedId;
            savedPayload.current = serializedPayload;
            detailsSaved = true;
          }
          throw issue;
        }
        const savedId = response?.product?.id || productId.current;
        if (typeof savedId !== 'string' || !/^[a-f\d]{24}$/i.test(savedId)) {
          throw new Error(
            'Product details were saved, but the server did not return a product ID. Images cannot be uploaded until the product can be reloaded.',
          );
        }
        productId.current = savedId;
        savedPayload.current = serializedPayload;
        detailsSaved = true;
      }

      let currentImages = submission.images.filter((image) => !image.file);
      const newImages = submission.images.filter((image) => image.file);
      if (newImages.length) {
        uncertainImageOperation = 'upload';
        setImageStatus('Uploading images…');
        const existingImageCount = currentImages.length;
        const files = newImages.map((image) => image.file);
        const uploadedImages = await uploadProductImages(productId.current, files, (percent) => {
          setImageStatus(`Uploading images… ${percent}%`);
        });
        uncertainImageOperation = '';
        currentImages = uploadedImages;
        setValues((previous) => ({ ...previous, images: uploadedImages }));
        const preferredPending = newImages.find((image) => image.id === mainImageId);
        if (preferredPending) {
          const fileIndex = newImages.findIndex((image) => image.id === preferredPending.id);
          const uploadedMain = uploadedImages[existingImageCount + fileIndex];
          if (!uploadedMain?.imageId) {
            throw new Error('Images were uploaded, but the server did not return their image IDs.');
          }
          setMainImageId(uploadedMain.imageId);
          if (uploadedImages[0]?.imageId !== uploadedMain.imageId) {
            uncertainImageOperation = 'main image update';
            setImageStatus('Setting the main image…');
            currentImages = await makeProductImageMain(productId.current, uploadedMain.imageId);
            uncertainImageOperation = '';
            setValues((previous) => ({ ...previous, images: currentImages }));
          }
          setMainImageId(currentImages[0]?.imageId || '');
        } else {
          setMainImageId(uploadedImages[0]?.imageId || '');
        }
      } else if (mainImageId && currentImages.length && currentImages[0]?.imageId !== mainImageId) {
        uncertainImageOperation = 'main image update';
        setImageStatus('Setting the main image…');
        currentImages = await makeProductImageMain(productId.current, mainImageId);
        uncertainImageOperation = '';
        setValues((previous) => ({ ...previous, images: currentImages }));
        setMainImageId(currentImages[0]?.imageId || '');
      }
      setImageStatus('');
      navigate('/admin/products');
    } catch (issue) {
      const outcomeUncertain =
        uncertainImageOperation && (issue.status === null || issue.status >= 500);
      setError(
        detailsSaved && outcomeUncertain
          ? `Product details were saved, but the ${uncertainImageOperation} outcome could not be confirmed. Reload the product and check its images before retrying. ${issue.message}`
          : detailsSaved
            ? `Product details were saved, but image management did not fully complete. ${issue.message} You can retry without creating another product.`
            : issue.message,
      );
      if (outcomeUncertain) {
        setImageStateUncertain(true);
      }
      setBusy(false);
      setImageStatus('');
    }
  }
  return (
    <form onSubmit={submit} noValidate aria-busy={busy}>
      <FormAlert>{error || catalogError}</FormAlert>
      {catalogError && (
        <button
          type="button"
          className="mb-5 min-h-11 text-xs text-walnut underline"
          disabled={catalogLoading}
          onClick={() => refresh().catch(() => {})}
        >
          Retry loading categories and products
        </button>
      )}
      <fieldset disabled={busy} className="min-w-0">
        <legend className="sr-only">
          {product ? 'Edit product details' : 'New product details'}
        </legend>
        <div className="grid items-start gap-5 xl:grid-cols-[1.5fr_1fr]">
          <div className="min-w-0 space-y-5">
            <section className={panelClass}>
              <h2 className="mb-1 font-display text-2xl text-walnut">The essentials</h2>
              <p className="mb-6 text-xs leading-6 text-bark">
                Introduce your piece. Fields marked * are required.
              </p>
              <div className="space-y-5">
                <Field label="Product name" id="product-name" required error={errors.name}>
                  <input
                    {...inputProps('name')}
                    maxLength={120}
                    placeholder="e.g. Premium Wooden Dining Chair"
                  />
                </Field>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Category" id="product-category" required error={errors.category}>
                    <select {...inputProps('category')}>
                      <option value="">Choose a category</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Price (₹ INR)" id="product-price" required error={errors.price}>
                    <input
                      {...inputProps('price')}
                      type="number"
                      min="0.01"
                      max="100000000"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="e.g. 12900"
                    />
                  </Field>
                </div>
                <Field
                  label="Description"
                  id="product-description"
                  required
                  error={errors.description}
                >
                  <textarea
                    {...inputProps('description')}
                    rows={5}
                    maxLength={4000}
                    className="field min-h-36 resize-y rounded-md py-3 leading-7"
                    placeholder="Describe the design, comfort, and character of this piece…"
                  />
                </Field>
              </div>
            </section>
            <section className={panelClass}>
              <h2 className="mb-6 font-display text-2xl text-walnut">Materials & proportions</h2>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Material" id="product-material" required error={errors.material}>
                  <input
                    {...inputProps('material')}
                    maxLength={120}
                    placeholder="e.g. Sheesham wood"
                  />
                </Field>
                <Field label="Color" id="product-color" required error={errors.color}>
                  <input
                    {...inputProps('color')}
                    maxLength={120}
                    placeholder="e.g. Natural walnut"
                  />
                </Field>
              </div>
              <p className="mb-4 mt-6 text-xs leading-6 text-bark">
                Dimensions in centimetres. Length describes the depth of the piece.
              </p>
              <div className="grid gap-5 sm:grid-cols-3">
                {['length', 'width', 'height'].map((key) => (
                  <Field
                    key={key}
                    label={`${key[0].toUpperCase() + key.slice(1)} (cm)`}
                    id={`product-${key}`}
                    required
                    error={errors[key]}
                  >
                    <input
                      {...inputProps(key)}
                      type="number"
                      min="0.1"
                      max="10000"
                      step="0.1"
                      inputMode="decimal"
                      placeholder="0"
                    />
                  </Field>
                ))}
              </div>
            </section>
            <section className={panelClass}>
              <h2 className="mb-2 font-display text-2xl text-walnut">Help people discover it.</h2>
              <p className="mb-5 text-xs leading-6 text-bark">
                Add useful search terms for rooms, styles, materials, or details.
              </p>
              <TagInput
                tags={values.tags}
                onChange={(tags) => change('tags', tags)}
                disabled={busy}
              />
              {errors.tags && (
                <p role="alert" className="mt-2 text-xs text-red-700">
                  {errors.tags}
                </p>
              )}
            </section>
          </div>
          <section className={panelClass}>
            <ImagePicker
              images={values.images}
              onChange={addImages}
              disabled={busy || catalogLoading || imagesBusy || imageStateUncertain}
              onBusyChange={setImagesBusy}
              error={imageError || errors.images}
              mainImageId={mainImageId}
              onRemoveImage={removeImage}
              onSetMainImage={setMainImage}
              status={imageStatus}
            />
          </section>
        </div>
        <div className="mt-7 flex flex-col-reverse gap-3 rounded-xl border border-sand bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] leading-6 text-bark">
            Product details and selected images are saved to the backend.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={busy || imagesBusy}
              className="btn-outline flex-1 rounded-md sm:flex-none"
              onClick={() => navigate('/admin/products')}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                busy || imagesBusy || imageStateUncertain || catalogLoading || !categories.length
              }
              className="btn-primary flex-1 rounded-md sm:flex-none"
            >
              <BusyLabel
                busy={busy || imagesBusy}
                busyText={imageStatus || (imagesBusy ? 'Preparing images…' : 'Saving product…')}
              >
                <Save size={16} />
                {product ? 'Save changes' : 'Save product'}
              </BusyLabel>
            </button>
          </div>
        </div>
      </fieldset>
    </form>
  );
}
