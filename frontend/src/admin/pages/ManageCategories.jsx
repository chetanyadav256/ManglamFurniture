import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Pencil, Plus, Shapes, Trash2 } from 'lucide-react';
import usePageTitle from '../../hooks/usePageTitle';
import Modal from '../../components/Modal';
import {
  ApiError,
  createAdminCategory,
  deleteAdminCategory,
  getCategories,
  getProducts,
  updateAdminCategory,
} from '../../services/api';
import { useAdminAuth } from '../context/AdminAuthContext';
import { AdminPageHeading, BusyLabel, EmptyState, Field, FormAlert } from '../components/AdminUI';
import ConfirmDialog from '../components/ConfirmDialog';

const idPattern = /^[a-f\d]{24}$/i;

async function loadCategoryData() {
  const response = await getCategories();
  if (
    !Array.isArray(response?.categories) ||
    response.categories.some(
      (category) =>
        !category ||
        typeof category.id !== 'string' ||
        !idPattern.test(category.id) ||
        typeof category.name !== 'string' ||
        typeof category.slug !== 'string',
    )
  ) {
    throw new ApiError('The server returned invalid category data.', {
      code: 'INVALID_CATEGORY_RESPONSE',
    });
  }

  const counts = {};
  try {
    const firstPage = await getProducts({ page: 1, limit: 100 });
    if (
      !Array.isArray(firstPage?.products) ||
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
      const nextPage = await getProducts({ page, limit: 100 });
      if (!Array.isArray(nextPage?.products) || nextPage.pagination?.page !== page) {
        throw new ApiError('The server returned invalid product pagination data.', {
          code: 'INVALID_PRODUCT_RESPONSE',
        });
      }
      products.push(...nextPage.products);
    }
    for (const product of products) {
      const categoryId =
        typeof product.category === 'string' ? product.category : product.category?.id;
      if (categoryId) counts[categoryId] = (counts[categoryId] ?? 0) + 1;
    }
    return { categories: response.categories, counts, countsError: '' };
  } catch (error) {
    return { categories: response.categories, counts: null, countsError: error.message };
  }
}

export default function ManageCategories() {
  usePageTitle('Manage categories');
  const { token, logout } = useAdminAuth();
  const [categories, setCategories] = useState([]);
  const [productCounts, setProductCounts] = useState(null);
  const [countsError, setCountsError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setLoadError('');
    try {
      const data = await loadCategoryData();
      if (currentRequest === requestId.current) {
        setCategories(data.categories);
        setProductCounts(data.counts);
        setCountsError(data.countsError);
        setLoading(false);
      }
      return data;
    } catch (issue) {
      if (currentRequest === requestId.current) {
        setLoadError(issue.message);
        setLoading(false);
      }
      throw issue;
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => {});
    return () => {
      requestId.current += 1;
    };
  }, [refresh]);

  const handleAuthError = useCallback(
    (issue) => {
      if (issue.status === 401 || issue.status === 403) logout();
    },
    [logout],
  );

  const count = (id) => productCounts?.[id] ?? 0;

  function openEditor(category = {}) {
    setName(category.name || '');
    setError('');
    setEditing(category);
  }

  async function refreshAfterChange(successMessage) {
    try {
      await refresh();
      return true;
    } catch (issue) {
      setLoadError(
        `${successMessage}, but the category list could not be refreshed. ${issue.message}`,
      );
      return false;
    }
  }

  async function save(event) {
    event.preventDefault();
    if (busy) return;
    const cleanName = name.normalize('NFKC').trim().replace(/\s+/g, ' ');
    if (!cleanName || cleanName.length > 60) {
      setError('Category name must contain 1–60 characters.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (editing.id) {
        await updateAdminCategory(editing.id, { name: cleanName }, token);
      } else {
        await createAdminCategory({ name: cleanName }, token);
      }
      setEditing(null);
      await refreshAfterChange(`Category ${editing.id ? 'updated' : 'created'}`);
    } catch (issue) {
      handleAuthError(issue);
      setError(issue.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!selected || busy) return;
    setBusy(true);
    setError('');
    try {
      await deleteAdminCategory(selected.id, token);
      setSelected(null);
      await refreshAfterChange('Category deleted');
    } catch (issue) {
      handleAuthError(issue);
      setError(
        issue.status === 409
          ? `${issue.message} This includes inactive products. Move or remove every product reference before deleting the category.`
          : issue.message,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AdminPageHeading
        title="A place for every piece."
        description="Organise the collection into clear, useful categories."
        action={
          <button
            className="btn-primary shrink-0 rounded-md"
            disabled={loading}
            onClick={() => openEditor()}
          >
            <Plus size={17} />
            Add category
          </button>
        }
      />
      {loadError && (
        <div className="mb-5">
          <FormAlert>{loadError}</FormAlert>
          <button
            type="button"
            className="mt-2 min-h-11 text-xs text-walnut underline"
            disabled={loading}
            onClick={() => refresh().catch(() => {})}
          >
            Retry loading categories
          </button>
        </div>
      )}
      {!loadError && (
        <>
          <p className="mb-5 text-xs leading-6 text-bark">
            {categories.length} categories · Categories with products must be emptied before
            deletion. Renaming keeps their products assigned.
          </p>
          {countsError && (
            <p role="status" className="mb-5 text-xs leading-6 text-bark">
              Active product counts could not be loaded: {countsError} The server checks all product
              references, including inactive products, before deletion.
            </p>
          )}
          {loading ? (
            <p role="status" className="py-10 text-center text-sm text-bark">
              Loading categories…
            </p>
          ) : categories.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {categories.map((category) => (
                <article
                  key={category.id}
                  data-testid="admin-category-card"
                  className="min-w-0 rounded-xl border border-sand bg-white p-5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-cream text-walnut">
                      <Shapes size={21} strokeWidth={1.4} />
                    </span>
                    <div className="flex">
                      <button
                        className="icon-button"
                        aria-label={`Edit category ${category.name}`}
                        onClick={() => openEditor(category)}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="icon-button text-red-800"
                        aria-label={`Delete category ${category.name}`}
                        onClick={() => {
                          setError('');
                          setSelected(category);
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                  <h2 className="mt-5 font-display text-3xl text-walnut wrap-anywhere">
                    {category.name}
                  </h2>
                  <p className="mt-2 text-xs text-bark">
                    {productCounts === null
                      ? 'Active product count unavailable'
                      : `${count(category.id)} active ${count(category.id) === 1 ? 'product' : 'products'}`}
                  </p>
                  <Link
                    to={`/admin/products?category=${category.id}`}
                    className="mt-5 flex min-h-11 items-center justify-between border-t border-sand pt-3 text-xs text-walnut"
                  >
                    View products
                    <ArrowUpRight size={15} />
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState icon={Shapes} title="Start with a category.">
              Add a category before creating your first product.
            </EmptyState>
          )}
        </>
      )}
      <Modal
        open={Boolean(editing)}
        onClose={() => {
          if (!busy) setEditing(null);
        }}
        labelledBy="category-form-title"
        className="w-[calc(100%-2rem)] max-w-md rounded-xl border-0 bg-white p-6 text-ink sm:p-8"
      >
        <h2 id="category-form-title" className="font-display text-3xl text-walnut">
          {editing?.id ? 'Edit category' : 'Add a category'}
        </h2>
        <p className="mb-6 mt-3 text-xs leading-6 text-bark">
          Use a clear name that helps people find their kind of furniture.
        </p>
        <form noValidate onSubmit={save} aria-busy={busy}>
          <FormAlert>{error}</FormAlert>
          <Field label="Category name" id="category-name" required>
            <input
              data-autofocus
              id="category-name"
              required
              maxLength={60}
              value={name}
              disabled={busy}
              onChange={(event) => setName(event.target.value)}
              className="field rounded-md"
              placeholder="e.g. Home Decor"
            />
          </Field>
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              disabled={busy}
              className="btn-outline rounded-md"
              onClick={() => setEditing(null)}
            >
              Cancel
            </button>
            <button className="btn-primary rounded-md" disabled={busy}>
              <BusyLabel busy={busy}>Save category</BusyLabel>
            </button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog
        open={Boolean(selected)}
        title={
          selected && count(selected.id) ? 'This category has products.' : 'Delete this category?'
        }
        disabled={Boolean(selected && count(selected.id))}
        busy={busy}
        error={error}
        onClose={() => {
          if (!busy) {
            setSelected(null);
            setError('');
          }
        }}
        onConfirm={remove}
        confirmLabel="Delete category"
      >
        <p>
          <strong className="text-walnut">{selected?.name}</strong>
          {selected && count(selected.id)
            ? ` contains ${count(selected.id)} active products. Move them to another category or remove them before deleting this category. The server also checks inactive products.`
            : ' will be deleted only if no active or inactive products reference it.'}
        </p>
      </ConfirmDialog>
    </>
  );
}
