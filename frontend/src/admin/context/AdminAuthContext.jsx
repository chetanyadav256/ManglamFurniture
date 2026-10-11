import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, getCurrentAdmin, loginAdmin, updateAdminName } from '../../services/api';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const profileRevision = useRef(0);

  const logout = useCallback((reason) => {
    setSession(null);
    setPasswordChanged(reason === 'passwordChanged');
  }, []);

  const verifySession = useCallback(async () => {
    if (!session?.token) return false;
    const revision = profileRevision.current;
    try {
      const response = await getCurrentAdmin(session.token);
      const admin = response.admin;
      if (!admin || !['admin', 'superadmin'].includes(admin.role)) {
        logout();
        return false;
      }
      if (revision === profileRevision.current) {
        setSession((current) => (current?.token === session.token ? { ...current, admin } : current));
      }
      return true;
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        logout();
        return false;
      }
      return true;
    }
  }, [logout, session?.token]);

  useEffect(() => {
    if (!session?.token) return undefined;
    const interval = window.setInterval(() => {
      void verifySession();
    }, 60_000);
    const handleFocus = () => {
      void verifySession();
    };
    window.addEventListener('focus', handleFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [session?.token, verifySession]);

  const login = useCallback(async (email, password) => {
    const result = await loginAdmin(email, password);
    if (typeof result.token !== 'string' || !result.token) {
      throw new ApiError('The server returned an invalid authentication response.', {
        code: 'INVALID_AUTH_RESPONSE',
      });
    }
    const current = await getCurrentAdmin(result.token);
    if (!current.admin || !['admin', 'superadmin'].includes(current.admin.role)) {
      throw new ApiError('This account is not authorized to access the admin dashboard.', {
        status: 403,
        code: 'FORBIDDEN',
      });
    }
    setSession({ token: result.token, admin: current.admin });
    setPasswordChanged(false);
    return current.admin;
  }, []);

  const updateProfileName = useCallback(async (name) => {
    if (!session?.token) throw new ApiError('Please sign in again.', { status: 401 });
    profileRevision.current++;
    try {
      const { admin } = await updateAdminName(name, session.token);
      if (!admin || admin.id !== session.admin.id || typeof admin.name !== 'string'
        || typeof admin.email !== 'string' || !['admin', 'superadmin'].includes(admin.role)) {
        throw new ApiError('The server returned an invalid profile response.', { code: 'INVALID_AUTH_RESPONSE' });
      }
      // Ignore profile reads started before this successful write.
      profileRevision.current++;
      setSession((current) => current?.token === session.token ? { ...current, admin } : current);
      return admin;
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        setSession((current) => current?.token === session.token ? null : current);
      }
      throw error;
    }
  }, [session?.token, session?.admin.id]);

  const value = useMemo(
    () => ({
      admin: session?.admin ?? null,
      token: session?.token ?? null,
      isAuthenticated: Boolean(session?.token && session?.admin),
      passwordChanged,
      login,
      logout,
      verifySession,
      updateProfileName,
    }),
    [login, logout, session, verifySession, updateProfileName, passwordChanged],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error('Admin authentication context is missing.');
  return context;
}
