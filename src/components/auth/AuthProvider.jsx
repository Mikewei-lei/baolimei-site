'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import AuthDialog from './AuthDialog';

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [dialog, setDialog] = useState(null);

  const loadMe = useCallback(async () => {
    try {
      const data = await apiFetch('/api/auth/me');
      setUser(data?.user || null);
    } catch {
      setUser(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    loadMe();
    const onUnauthorized = () => setUser(null);
    window.addEventListener('blm:unauthorized', onUnauthorized);
    return () => window.removeEventListener('blm:unauthorized', onUnauthorized);
  }, [loadMe]);

  useEffect(() => {
    if (!user) return;
    const timer = setInterval(() => {
      apiFetch('/api/auth/refresh', { method: 'POST' }).catch(() => undefined);
    }, 6 * 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, [user]);

  const openAuth = useCallback((mode = 'login') => setDialog(mode), []);
  const closeAuth = useCallback(() => setDialog(null), []);
  const changeMode = useCallback((mode) => setDialog(mode), []);

  const signIn = useCallback((nextUser) => {
    setUser(nextUser);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Clear local identity even if the session already expired.
    }
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, ready, openAuth, signOut, signIn, refreshUser: loadMe }),
    [user, ready, openAuth, signOut, signIn, loadMe]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthDialog
        open={Boolean(dialog)}
        mode={dialog || 'login'}
        onClose={closeAuth}
        onModeChange={changeMode}
        onSuccess={signIn}
      />
    </AuthContext.Provider>
  );
}
