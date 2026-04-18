import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useState, useEffect } from 'react';
import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import ConfirmModal from './components/modals/ConfirmModal';
import OrderDetailModal from './components/modals/OrderDetailModal';
import LoyaltyModal from './components/modals/LoyaltyModal';
import { ModalProvider } from './context/ModalContext';
import { useVaultStore, _pendingWrite } from './lib/store';
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

function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pruneHistory = useVaultStore((s) => s.pruneHistory);

  useEffect(() => {
    pruneHistory();
  }, [pruneHistory]);

  useEffect(() => {
    if (!isSupabaseEnabled) return;

    const channel = supabase!
      .channel('vault-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vault', filter: 'id=eq.1' },
        (payload) => {
          if (_pendingWrite) return;
          const remote = (payload.new as { data?: Record<string, unknown> })?.data;
          if (!remote) return;
          const { items, categories, deliveryMen, orders, bundles, credentials, history, settings } = remote;
          useVaultStore.setState({ items, categories, deliveryMen, orders, bundles, credentials, history, settings } as object);
        },
      )
      .subscribe();

    return () => { supabase!.removeChannel(channel); };
  }, []);

  return (
    <ModalProvider>
      <Topbar />
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

function App() {
  return (
    <Router>
      <Helmet>
        <title>Instant-Play</title>
        <meta name="description" content="Secure email credentials and order management system" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Helmet>
      
      <AppLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/new-order" element={<NewOrder />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/items" element={<Items />} />
          <Route path="/bundles" element={<Bundles />} />
          <Route path="/delivery" element={<Delivery />} />
          <Route path="/credentials" element={<Credentials />} />
          <Route path="/history" element={<History />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </AppLayout>
    </Router>
  );
}

export default App;
