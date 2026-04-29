import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useState, useEffect } from 'react';
import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import ConfirmModal from './components/modals/ConfirmModal';
import OrderDetailModal from './components/modals/OrderDetailModal';
import LoyaltyModal from './components/modals/LoyaltyModal';
import { ModalProvider } from './context/ModalContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useVaultStore } from './lib/store';
import * as StoreModule from './lib/store';
import { supabase, isSupabaseEnabled } from './lib/supabase';

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

function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pruneHistory = useVaultStore((s) => s.pruneHistory);

  useEffect(() => {
    pruneHistory();
  }, [pruneHistory]);

  useEffect(() => {
    if (!isSupabaseEnabled) return;

    const channel = supabase!
      .channel('vault-broadcast')
      .on('broadcast', { event: 'data_updated' }, () => {
        useVaultStore.persist.rehydrate();
      })
      .subscribe();

    StoreModule.onSaveSuccess = () => {
      channel.send({ type: 'broadcast', event: 'data_updated', payload: {} });
    };

    return () => {
      StoreModule.onSaveSuccess = null;
      supabase!.removeChannel(channel);
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
  if (!storeReady) return null;

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

function App() {
  return (
    <Router>
      <AuthProvider>
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
