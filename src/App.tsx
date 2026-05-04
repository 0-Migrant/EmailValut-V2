import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useState, useEffect, useRef } from 'react';
import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import ConfirmModal from './components/modals/ConfirmModal';
import OrderDetailModal from './components/modals/OrderDetailModal';
import LoyaltyModal from './components/modals/LoyaltyModal';
import { ModalProvider } from './context/ModalContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useVaultStore, refreshFromServer, saveCallbacks } from './lib/store';
import { isCloudEnabled } from './lib/api';

// Page imports
import Dashboard from './pages/Dashboard';
import NewOrder from './pages/NewOrder';
import Orders from './pages/Orders';
import Items from './pages/Items';
import Bundles from './pages/Bundles';
import Delivery from './pages/Delivery';
import Credentials from './pages/Credentials';
import History from './pages/History';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Earnings from './pages/Earnings';
import Clients from './pages/Clients';
import WorkerPortal from './pages/WorkerPortal';
import AdminWorkers from './pages/AdminWorkers';
import LoginPage from './pages/LoginPage';

function AppLoader() {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 20, background: 'var(--bg-page)',
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 16, background: 'var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 24px rgba(24,95,165,.30)',
      }}>
        <img src="/logo.png?v=2" alt="" style={{ width: 42, height: 42, objectFit: 'contain' }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.3px' }}>Instant-Play</div>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        border: '3px solid var(--border)', borderTopColor: 'var(--accent)',
        animation: 'spin .7s linear infinite',
      }} />
    </div>
  );
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pruneHistory = useVaultStore((s) => s.pruneHistory);

  useEffect(() => {
    pruneHistory();
  }, [pruneHistory]);

  useEffect(() => {
    const tabId = Math.random().toString(36).slice(2);
    const bc = new BroadcastChannel('vault-broadcast');

    bc.onmessage = (e) => {
      if ((e.data as { tabId?: string })?.tabId === tabId) return;
      refreshFromServer();
    };

    saveCallbacks.onSaveSuccess = () => bc.postMessage({ tabId });

    return () => {
      saveCallbacks.onSaveSuccess = null;
      bc.close();
    };
  }, []);

  return (
    <ModalProvider>
      <Topbar onMenuClick={() => setSidebarOpen(true)} />
      <div className="app-shell">
        <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="page-content">{children}</div>
      </div>
      <ConfirmModal />
      <OrderDetailModal />
      <LoyaltyModal />
    </ModalProvider>
  );
}

function AppRoutes() {
  const { session, storeReady } = useAuth();
  const settings = useVaultStore((s) => s.settings);

  // Wait for store hydration before rendering — avoids false logout while
  // deliveryMen is still empty during async Supabase hydration.
  if (!storeReady) return <AppLoader />;

  // No session → login page for every route
  if (!session) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  // Worker session — full access or portal-only depending on setting
  if (session.type === 'worker') {
    if (!settings.workerFullAccess) {
      return (
        <Routes>
          <Route path="/worker" element={<WorkerPortal />} />
          <Route path="*" element={<Navigate to="/worker" replace />} />
        </Routes>
      );
    }
    return (
      <AppLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/new-order" element={<NewOrder />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/items" element={<Items />} />
          <Route path="/bundles" element={<Bundles />} />
          <Route path="/delivery" element={<Delivery />} />
          <Route path="/credentials" element={<Credentials />} />
          <Route path="/history" element={<History />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/earnings" element={<Earnings />} />
          <Route path="/settings" element={<Navigate to="/" replace />} />
          <Route path="/worker" element={<WorkerPortal />} />
          <Route path="/admin" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
    );
  }

  // Admin session → full app
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/new-order" element={<NewOrder />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/items" element={<Items />} />
        <Route path="/bundles" element={<Bundles />} />
        <Route path="/delivery" element={<Delivery />} />
        <Route path="/credentials" element={<Credentials />} />
        <Route path="/history" element={<History />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/earnings" element={<Earnings />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/admin" element={<AdminWorkers />} />
        <Route path="/worker" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}

// Tracks worker presence via Supabase Realtime. The Supabase server detects
// dropped WebSocket connections and fires presence events to all subscribers.
// A configurable grace period prevents a page refresh from triggering offline.
function PresenceManager() {
  const { session } = useAuth();
  const workerId = session?.type === 'worker' ? session.workerId : null;
  const delayMs = useVaultStore((s) => (s.settings?.workerOfflineDelay ?? 8) * 1000);
  const delayRef = useRef(delayMs);
  delayRef.current = delayMs;

  useEffect(() => {
    if (!isCloudEnabled) return;

    const pending = new Map<string, ReturnType<typeof setTimeout>>();
    const wsUrl = window.location.origin.replace(/^http/, 'ws') + '/ws';
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      if (workerId) ws.send(JSON.stringify({ type: 'join', workerId }));
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string) as { type: string; workerId?: string };

        // Realtime data sync — any device saving triggers a refresh for all others
        if (msg.type === 'vault_changed') {
          refreshFromServer();
          return;
        }

        if (!msg.workerId) return;
        const id = msg.workerId;

        if (msg.type === 'join') {
          if (pending.has(id)) {
            clearTimeout(pending.get(id)!);
            pending.delete(id);
          }
        } else if (msg.type === 'leave') {
          if (pending.has(id)) clearTimeout(pending.get(id)!);
          pending.set(id, setTimeout(() => {
            useVaultStore.getState().setWorkerStatus(id, 'offline');
            pending.delete(id);
          }, delayRef.current));
        }
      } catch { /* ignore malformed messages */ }
    };

    return () => {
      pending.forEach(clearTimeout);
      ws.close();
    };
  }, [workerId]);

  return null;
}

function App() {
  useEffect(() => {
    refreshFromServer();
  }, []);

  return (
    <Router>
      <AuthProvider>
        <PresenceManager />
        <Helmet>
          <title>Instant-Play</title>
          <meta name="description" content="Secure email credentials and order management system" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Helmet>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;
