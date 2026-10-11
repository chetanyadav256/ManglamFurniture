import { createContext, useContext, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { CheckCircle2, X } from 'lucide-react';
import { createAdminMockService } from '../services/adminMockService';

const AdminContext = createContext(null);

export function AdminPreviewProvider() {
  const [service] = useState(createAdminMockService);
  const [data, setData] = useState(() => service.getSnapshot());
  const [notice, setNotice] = useState(null);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(null), 7000);
    return () => clearTimeout(timeout);
  }, [notice]);
  async function run(method, ...args) {
    const result = await service[method](...args);
    setData(service.getSnapshot());
    return result;
  }
  const value = { ...data, run, notify: (message) => setNotice({ message, id: Date.now() }) };
  return (
    <AdminContext.Provider value={value}>
      <Outlet />
      {notice && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 flex max-w-[calc(100%-2.5rem)] items-start gap-3 rounded-lg border border-sand bg-white p-4 text-sm text-walnut shadow-xl sm:max-w-md"
        >
          <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-700" />
          <p className="min-w-0 leading-6">{notice.message}</p>
          <button
            className="flex size-8 shrink-0 items-center justify-center"
            aria-label="Dismiss notification"
            onClick={() => setNotice(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </AdminContext.Provider>
  );
}

export function useAdminPreview() {
  const context = useContext(AdminContext);
  if (!context) throw new Error('Admin preview context is missing.');
  return context;
}
