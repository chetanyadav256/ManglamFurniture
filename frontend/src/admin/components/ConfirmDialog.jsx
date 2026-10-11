import { AlertTriangle, X } from 'lucide-react';
import Modal from '../../components/Modal';
import { BusyLabel, FormAlert } from './AdminUI';

export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = 'Delete',
  busy = false,
  error,
  disabled = false,
  onClose,
  onConfirm,
}) {
  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      labelledBy="admin-confirm-title"
      className="w-[calc(100%-2rem)] max-w-md rounded-xl border-0 bg-white p-6 text-ink sm:p-8"
    >
      <div className="mb-5 flex items-center justify-between">
        <span className="flex size-11 items-center justify-center rounded-full bg-red-50 text-red-700">
          <AlertTriangle size={22} />
        </span>
        <button
          disabled={busy}
          className="icon-button"
          aria-label="Close confirmation"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <h2 id="admin-confirm-title" className="font-display text-3xl text-walnut">
        {title}
      </h2>
      <div className="mb-6 mt-3 text-sm leading-7 text-bark">{children}</div>
      <FormAlert>{error}</FormAlert>
      <div className="flex flex-wrap justify-end gap-3">
        <button data-autofocus disabled={busy} className="btn-outline rounded-md" onClick={onClose}>
          Cancel
        </button>
        <button
          disabled={busy || disabled}
          className="btn-primary rounded-md border-red-800 bg-red-800 hover:border-red-900 hover:bg-red-900"
          onClick={onConfirm}
        >
          <BusyLabel busy={busy} busyText="Deleting…">
            {confirmLabel}
          </BusyLabel>
        </button>
      </div>
    </Modal>
  );
}
