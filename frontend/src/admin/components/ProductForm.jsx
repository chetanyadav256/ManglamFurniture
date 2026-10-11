import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save } from 'lucide-react';
import { useAdminPreview } from '../context/AdminPreviewContext';
import { validateProduct } from '../services/adminMockService';
import { BusyLabel, Field, FormAlert, panelClass } from './AdminUI';
import ImagePicker from './ImagePicker';
import TagInput from './TagInput';

export default function ProductForm({ product }) {
  const { categories, run, notify } = useAdminPreview();
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
  async function submit(event) {
    event.preventDefault();
    if (busy || imagesBusy) return;
    // Include the latest native field values, including browser autofill.
    const submission = { ...values, ...Object.fromEntries(new FormData(event.currentTarget)) };
    setValues(submission);
    const next = validateProduct(submission, categories);
    setErrors(next);
    setError('');
    if (Object.keys(next).length) {
      setError('Please check the highlighted fields before saving.');
      document.getElementById(`product-${Object.keys(next)[0]}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      await run('saveProduct', submission, product?.id);
      notify(`“${submission.name.trim()}” ${product ? 'updated' : 'added'} in the UI preview.`);
      navigate('/admin/products');
    } catch (issue) {
      setError(issue.message);
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} noValidate aria-busy={busy}>
      <FormAlert>{error}</FormAlert>
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
              onChange={(images) => change('images', images)}
              disabled={busy}
              onBusyChange={setImagesBusy}
              error={errors.images}
            />
          </section>
        </div>
        <div className="mt-7 flex flex-col-reverse gap-3 rounded-xl border border-sand bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] leading-6 text-bark">Saving updates the local preview only.</p>
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
              disabled={busy || imagesBusy || !categories.length}
              className="btn-primary flex-1 rounded-md sm:flex-none"
            >
              <BusyLabel
                busy={busy || imagesBusy}
                busyText={imagesBusy ? 'Preparing images…' : 'Saving preview…'}
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
