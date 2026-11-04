import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { authApi, profileApi } from '../api';
import { onSessionEnded, setAuthToken } from '../api/client';
import { useToast } from './ToastContext';

const STORAGE_KEY = 'booktracker.session';

const AuthContext = createContext(null);

function readStoredSession() {
  try {
    const session = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!session?.token || !session?.user) return null;
    if (session.expiresAt && new Date(session.expiresAt) <= new Date()) return null;
    return session;
  } catch {
    return null;
  }
}

function storeSession(session) {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private browsing); the session then lasts for this tab only.
  }
}

export function homePathFor(user) {
  return user?.role === 'admin' ? '/admin' : '/app';
}

export function AuthProvider({ children }) {
  const toast = useToast();
  const [session, setSession] = useState(() => {
    const stored = readStoredSession();
    setAuthToken(stored?.token ?? null);
    return stored;
  });
  const expiryTimer = useRef(null);

  const applySession = useCallback((next) => {
    setAuthToken(next?.token ?? null);
    setSession(next);
  }, []);

  useEffect(() => {
    storeSession(session);
  }, [session]);

  const logout = useCallback(
    (message) => {
      applySession(null);
      if (message) toast.info(message);
    },
    [applySession, toast]
  );

  // Any API call answered with "session expired / invalid" signs the user out.
  useEffect(() => {
    onSessionEnded((error) => logout(error.message));
    return () => onSessionEnded(null);
  }, [logout]);

  // Sign out automatically when the token expires.
  useEffect(() => {
    clearTimeout(expiryTimer.current);
    if (!session?.expiresAt) return undefined;
    const delay = new Date(session.expiresAt).getTime() - Date.now();
    expiryTimer.current = setTimeout(
      () => logout('Your session has expired. Please log in again.'),
      Math.max(0, Math.min(delay, 2 ** 31 - 1))
    );
    return () => clearTimeout(expiryTimer.current);
  }, [session?.expiresAt, logout]);

  // Refresh the stored user once on load (role or name may have changed).
  const hasTokenOnLoad = useRef(Boolean(session?.token));
  useEffect(() => {
    if (!hasTokenOnLoad.current) return undefined;
    const controller = new AbortController();
    profileApi
      .get(controller.signal)
      .then(({ user }) => setSession((current) => (current ? { ...current, user } : current)))
      .catch(() => {
        // A 401 already signed the user out; other errors keep the stored user.
      });
    return () => controller.abort();
  }, []);

  // Keep several open tabs in sync: logging out in one logs out everywhere.
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key !== STORAGE_KEY) return;
      const next = readStoredSession();
      setAuthToken(next?.token ?? null);
      setSession(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const login = useCallback(
    async (credentials) => {
      const { token, expiresAt, user } = await authApi.login(credentials);
      applySession({ token, expiresAt, user });
      return user;
    },
    [applySession]
  );

  const updateUser = useCallback((user) => {
    setSession((current) => (current ? { ...current, user } : current));
  }, []);

  // After a password change the server issues a new token.
  const replaceToken = useCallback(
    ({ token, expiresAt, user }) => {
      applySession({ token, expiresAt, user });
    },
    [applySession]
  );

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      isAuthenticated: Boolean(session?.token),
      login,
      logout,
      updateUser,
      replaceToken,
    }),
    [session, login, logout, updateUser, replaceToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
