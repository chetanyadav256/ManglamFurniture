import { useEffect, useRef } from 'react';
import { LoaderCircle, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

export function AdminPageHeading({ eyebrow = 'Catalog workspace', title, description, action }) {
  return (
    <div className="mb-7 flex flex-col items-start justify-between gap-5 sm:mb-9 sm:flex-row sm:items-center">
      <div className="min-w-0">
        <p className="eyebrow mb-2 text-bark">{eyebrow}</p>
        <h1 className="font-display text-[36px] leading-tight text-walnut sm:text-[42px]">
          {title}
        </h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-7 text-bark">{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function AddProductLink() {
  return (
    <Link to="/admin/products/new" className="btn-primary shrink-0 rounded-md">
      <Plus size={17} />
      Add product
    </Link>
  );
}
export function BusyLabel({ busy, children, busyText = 'Saving preview…' }) {
  return (
    <>
      {busy && <LoaderCircle size={17} className="shrink-0 animate-spin" aria-hidden="true" />}
      {busy ? busyText : children}
    </>
  );
}
export function Field({ label, id, error, required, hint, children }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-2 block text-xs font-medium text-walnut">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="mt-2 text-[11px] leading-5 text-bark">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-2 text-xs leading-5 text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
export function FormAlert({ children, focusKey, variant = 'error' }) {
  const feedback = useRef(null);
  useEffect(() => {
    if (!children || focusKey === undefined) return;
    // Centre feedback in the usable viewport rather than leaving it above a
    // long mobile form. A submission key also handles identical errors twice.
    feedback.current?.focus({ preventScroll: true });
    feedback.current?.scrollIntoView({ block: 'center', behavior: 'instant' });
  }, [children, focusKey]);
  return children ? (
    <div
      ref={feedback}
      tabIndex={focusKey === undefined ? undefined : -1}
      role={variant === 'error' ? 'alert' : 'status'}
      className={`mb-5 rounded-md border p-4 text-sm leading-6 ${variant === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-sand bg-cream text-walnut'}`}
    >
      {children}
    </div>
  ) : null;
}
export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="rounded-xl border border-dashed border-sand bg-white px-6 py-14 text-center">
      {Icon && <Icon size={32} strokeWidth={1.3} className="mx-auto mb-4 text-bark" />}
      <h2 className="font-display text-3xl text-walnut">{title}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-bark">{children}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
export const panelClass =
  'rounded-xl border border-sand/80 bg-white p-5 shadow-[0_2px_8px_rgb(89_59_43_/_0.025)] sm:p-7';
