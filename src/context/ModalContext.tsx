'use client';
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { ConfirmState, LoyaltyState } from '@/lib/types';

interface ModalContextValue {
  confirm: ConfirmState;
  loyalty: LoyaltyState;
  viewOrderId: string | null;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
  closeConfirm: () => void;
  showLoyalty: (customerId: string, orderNum: number) => void;
  closeLoyalty: () => void;
  openOrderDetail: (id: string) => void;
  closeOrderDetail: () => void;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [confirm, setConfirm] = useState<ConfirmState>({
    open: false, title: '', message: '', onConfirm: null,
  });
  const [loyalty, setLoyalty] = useState<LoyaltyState>({
    open: false, customerId: '', orderNum: 0,
  });
  const [viewOrderId, setViewOrderId] = useState<string | null>(null);

  const showConfirm = useCallback((title: string, message: string, onConfirm: () => void) => {
    setConfirm({ open: true, title, message, onConfirm });
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirm((s) => ({ ...s, open: false, onConfirm: null }));
  }, []);

  const showLoyalty = useCallback((customerId: string, orderNum: number) => {
    setLoyalty({ open: true, customerId, orderNum });
  }, []);

  const closeLoyalty = useCallback(() => {
    setLoyalty((s) => ({ ...s, open: false }));
  }, []);

  const openOrderDetail = useCallback((id: string) => setViewOrderId(id), []);
  const closeOrderDetail = useCallback(() => setViewOrderId(null), []);

  return (
    <ModalContext.Provider value={{
      confirm, loyalty, viewOrderId,
      showConfirm, closeConfirm,
      showLoyalty, closeLoyalty,
      openOrderDetail, closeOrderDetail,
    }}>
      {children}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal must be used within ModalProvider');
  return ctx;
}
