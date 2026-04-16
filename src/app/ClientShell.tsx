'use client';
import { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import ConfirmModal from '@/components/modals/ConfirmModal';
import OrderDetailModal from '@/components/modals/OrderDetailModal';
import LoyaltyModal from '@/components/modals/LoyaltyModal';
import { ModalProvider } from '@/context/ModalContext';
import { useVaultStore } from '@/lib/store';
import { useEffect } from 'react';

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pruneHistory = useVaultStore((s) => s.pruneHistory);

  useEffect(() => {
    // Prune old logs on load based on user settings
    pruneHistory();
  }, [pruneHistory]);

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
