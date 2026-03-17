import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { User } from '@/services/api';
import { offlineCache, CacheKeys } from '@/services/cache';

// ============================================
// Auth Context — Centralized auth state
// ============================================

type AuthState = {
  /** True while checking stored session */
  isBootstrapping: boolean;
  /** Currently authenticated user (null when logged out) */
  user: User | null;
  /** Whether we have a valid token */
  isLoggedIn: boolean;
  /** Whether user profile needs completion */
  profileIncomplete: boolean;

  /** Call after a successful login/register */
  login: (token: string, user?: User | null, isNewUser?: boolean) => void;
  /** Clear session and navigate to login */
  logout: () => Promise<void>;
  /** Update the in-memory user after profile edit */
  setUser: (user: User) => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

// ============================================
// Provider
// ============================================

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);

  const profileIncomplete = useMemo(() => {
    if (!user) return false;
    return user.full_name === 'Người dùng mới' || !user.email;
  }, [user]);

  // ------ Restore session on mount ------
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const session = await api.restoreSession();
      if (cancelled) return;

      if (!session) {
        setIsBootstrapping(false);
        return;
      }

      setTokenState(session.token);

      // Try cached user first (instant UI)
      const cached = await offlineCache.get<User>(CacheKeys.USER_PROFILE);
      if (!cancelled && cached) {
        setUser(cached);
      }

      // Then fetch fresh from server
      const res = await api.getMe();
      if (cancelled) return;

      if (res.success && res.data) {
        const freshUser = (res.data as any).user || res.data;
        setUser(freshUser);
        await offlineCache.set(CacheKeys.USER_PROFILE, freshUser, 30 * 60 * 1000);
      } else if (!cached) {
        // No cached user AND server failed → session is invalid
        await api.clearSession();
        setTokenState(null);
        setUser(null);
      }

      setIsBootstrapping(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ------ Listen for 401s ------
  useEffect(
    () =>
      api.onAuthFailure(() => {
        setTokenState(null);
        setUser(null);
        void offlineCache.clear();
      }),
    [],
  );

  // ------ Actions ------
  const login = useCallback((t: string, u?: User | null, _isNew?: boolean) => {
    setTokenState(t);
    setUser(u || null);
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    await api.clearSession();
    setTokenState(null);
    setUser(null);
    await offlineCache.clear();
  }, []);

  const updateUser = useCallback((u: User) => {
    setUser(u);
    void offlineCache.set(CacheKeys.USER_PROFILE, u, 30 * 60 * 1000);
  }, []);

  // ------ Context value (stable reference) ------
  const value = useMemo<AuthState>(
    () => ({
      isBootstrapping,
      user,
      isLoggedIn: !!token,
      profileIncomplete,
      login,
      logout,
      setUser: updateUser,
    }),
    [isBootstrapping, user, token, profileIncomplete, login, logout, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
