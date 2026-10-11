import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Pencil, Plus, Shapes, Trash2 } from 'lucide-react';
import usePageTitle from '../../hooks/usePageTitle';
import Modal from '../../components/Modal';
import { useAdminPreview } from '../context/AdminPreviewContext';
import { AdminPageHeading, BusyLabel, EmptyState, Field, FormAlert } from '../components/AdminUI';
import ConfirmDialog from '../components/ConfirmDialog';

export default function ManageCategories() {
  usePageTitle('Manage categories');
  const { categories, products, run, notify } = useAdminPreview();
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const count = (id) => products.filter((product) => product.category === id).length;
  function openEditor(category = {}) {
    setName(category.name || '');
    setError('');
    setEditing(category);
  }
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await run('saveCategory', name, editing.id);
      notify(`Category ${editing.id ? 'updated' : 'added'} in the UI preview.`);
      setEditing(null);
    } catch (issue) {
      setError(issue.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setError('');
    try {
      await run('deleteCategory', selected.id);
      notify(`“${selected.name}” deleted from the UI preview.`);
      setSelected(null);
    } catch (issue) {
      setError(issue.message);
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
          <button className="btn-primary shrink-0 rounded-md" onClick={() => openEditor()}>
            <Plus size={17} />
            Add category
          </button>
        }
      />
      <p className="mb-5 text-xs leading-6 text-bark">
        {categories.length} categories · Categories with products must be emptied before deletion.
        Renaming keeps their products assigned.
      </p>
      {categories.length ? (
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
                {count(category.id)} {count(category.id) === 1 ? 'product' : 'products'}
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
        onClose={() => setSelected(null)}
        onConfirm={remove}
        confirmLabel="Delete category"
      >
        <p>
          <strong className="text-walnut">{selected?.name}</strong>
          {selected && count(selected.id)
            ? ` contains ${count(selected.id)} products. Move them to another category or delete them before removing this category.`
            : ' will be removed from the local preview. No products will be affected.'}
        </p>
      </ConfirmDialog>
    </>
  );
}
