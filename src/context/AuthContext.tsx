import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useVaultStore, useSaveStatusStore } from '@/lib/store';

export const ADMIN_USERNAME = 'Migrant';
export const ADMIN_PASSWORD = 'Alhoranysh8..';
const SESSION_KEY = 'worker_session';

export type Session =
  | { type: 'admin' }
  | { type: 'worker'; workerId: string };

export type LoginResult =
  | 'admin'
  | 'worker'
  | 'frozen'   // worker account is frozen
  | 'invalid';

interface AuthCtx {
  session: Session | null;
  storeReady: boolean;
  login: (username: string, password: string) => LoginResult;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  });

  // True after refreshFromServer loads DB data — prevents worker eviction on empty default state
  const storeReady = useSaveStatusStore((s) => s.storeReady);

  const deliveryMen = useVaultStore((s) => s.deliveryMen);

  // Keep session valid — if the worker was deleted or frozen while logged in,
  // evict the session on next render. Guard with storeReady so we don't evict
  // while deliveryMen is still empty during async Supabase hydration.
  useEffect(() => {
    if (!storeReady) return;
    if (session?.type === 'worker') {
      const worker = deliveryMen.find((d) => d.id === session.workerId);
      if (!worker || worker.frozen) {
        setSession(null);
      }
    }
  }, [deliveryMen, session, storeReady]);

  useEffect(() => {
    if (session) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }, [session]);

  function login(username: string, password: string): LoginResult {
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      setSession({ type: 'admin' });
      return 'admin';
    }
    const worker = deliveryMen.find(
      (d) => d.username === username && d.password === password,
    );
    if (!worker) return 'invalid';
    if (worker.frozen) return 'frozen';
    setSession({ type: 'worker', workerId: worker.id });
    return 'worker';
  }

  function logout() {
    setSession(null);
  }

  return (
    <AuthContext.Provider value={{ session, storeReady, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
