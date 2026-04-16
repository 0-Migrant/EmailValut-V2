'use client';
import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import type {
  Item, DeliveryMan, Order, OrderStatus,
  Credential, Stock, HistoryEntry, Settings,
} from './types';
import { uid } from './utils';

// ─── State shape ──────────────────────────────────────────────────────────────

interface AppState {
  items: Item[];
  categories: string[];
  deliveryMen: DeliveryMan[];
  orders: Order[];
  credentials: Credential[];
  history: HistoryEntry[];
  settings: Settings;
}

// ─── Actions shape ────────────────────────────────────────────────────────────

interface AppActions {
  // Items
  addItem: (data: Omit<Item, 'id'>) => void;
  updateItem: (id: string, data: Partial<Omit<Item, 'id'>>) => void;
  deleteItem: (id: string) => void;

  // Categories
  addCategory: (name: string) => void;
  renameCategory: (oldName: string, newName: string) => void;
  deleteCategory: (name: string) => void;

  // Delivery Men
  addDeliveryMan: (data: Omit<DeliveryMan, 'id'>) => void;
  updateDeliveryMan: (id: string, data: Partial<Omit<DeliveryMan, 'id'>>) => void;
  deleteDeliveryMan: (id: string) => void;

  // Orders
  addOrder: (data: Omit<Order, 'id' | 'createdAt'>) => Order;
  setOrderStatus: (id: string, status: OrderStatus) => void;
  deleteOrder: (id: string) => void;

  // Credentials
  addCredential: (data: Omit<Credential, 'id' | 'stocks' | 'added'>) => void;
  updateCredential: (id: string, data: Partial<Pick<Credential, 'name' | 'email' | 'pass'>>) => void;
  deleteCredential: (id: string) => void;
  addStock: (credId: string, stock: Omit<Stock, 'id'>) => void;
  updateStock: (credId: string, stockId: string, data: Partial<Omit<Stock, 'id'>>) => void;
  deleteStock: (credId: string, stockId: string) => void;

  // History
  deleteHistoryEntry: (id: string) => void;
  clearHistory: () => void;
  restoreSnapshot: (historyId: string) => boolean;
  pruneHistory: () => void;

  // Settings
  updateSettings: (data: Partial<Settings>) => void;

  // Data management
  nukeAll: () => void;
  importData: (data: Partial<AppState>) => void;
}

export type VaultStore = AppState & AppActions;

// ─── Default seed data ────────────────────────────────────────────────────────

const DEFAULT_CATEGORIES = ['Food', 'Drinks', 'Sides'];

const DEFAULT_ITEMS: Item[] = [
  { id: uid(), name: 'Burger',   price: 45, category: 'Food' },
  { id: uid(), name: 'Pizza',    price: 80, category: 'Food' },
  { id: uid(), name: 'Shawarma', price: 35, category: 'Food' },
  { id: uid(), name: 'Fries',    price: 20, category: 'Sides' },
  { id: uid(), name: 'Cola',     price: 15, category: 'Drinks' },
  { id: uid(), name: 'Water',    price: 8,  category: 'Drinks' },
  { id: uid(), name: 'Juice',    price: 18, category: 'Drinks' },
];

const DEFAULT_DELIVERY_MEN: DeliveryMan[] = [
  { id: uid(), name: 'Ahmed Hassan' },
  { id: uid(), name: 'Mohamed Ali' },
];

const DEFAULT_SETTINGS: Settings = {
  showpass: false,
  confirmdelete: true,
  rowsperpage: 25,
  historyretention: 30,
  historylimit: 200,
  theme: 'light',
};

// ─── Helper: add history entry ────────────────────────────────────────────────

function pushHistory(
  state: AppState,
  type: HistoryEntry['type'],
  msg: string,
  snapshot?: string,
): HistoryEntry[] {
  const entry: HistoryEntry = {
    id: uid(),
    type,
    msg,
    time: new Date().toISOString(),
    snapshot,
  };
  const list = [entry, ...state.history].slice(0, state.settings.historylimit);
  return list;
}

// ─── Custom Server Storage ───────────────────────────────────────────────────

const customServerStorage: StateStorage = {
  getItem: async (): Promise<string | null> => {
    // We only want to fetch from the server if we are in the browser
    if (typeof window === 'undefined') return null;
    const res = await fetch('/api/vault');
    if (!res.ok) return null;
    const data = await res.json();
    return JSON.stringify({ state: data, version: 0 });
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (typeof window === 'undefined') return;
    const { state } = JSON.parse(value);
    await fetch('/api/vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });
  },
  removeItem: async (): Promise<void> => {},
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useVaultStore = create<VaultStore>()(
  persist(
    (set, get) => ({
      // ── Initial state ──────────────────────────────────────────────────────
      items:        DEFAULT_ITEMS,
      categories:   DEFAULT_CATEGORIES,
      deliveryMen:  DEFAULT_DELIVERY_MEN,
      orders:       [],
      credentials:  [],
      history:      [],
      settings:     DEFAULT_SETTINGS,

      // ── Items ──────────────────────────────────────────────────────────────
      addItem(data) {
        set((s) => {
          const snap = JSON.stringify(s);
          const item: Item = { id: uid(), ...data };
          return {
            items: [...s.items, item],
            history: pushHistory(s, 'add', `Added item: ${data.name} @ ${data.price}`, snap),
          };
        });
      },
      updateItem(id, data) {
        set((s) => {
          const snap = JSON.stringify(s);
          return {
            items: s.items.map((it) => (it.id === id ? { ...it, ...data } : it)),
            history: pushHistory(s, 'edit', `Updated item: ${data.name ?? id}`, snap),
          };
        });
      },
      deleteItem(id) {
        set((s) => {
          const snap = JSON.stringify(s);
          const it = s.items.find((i) => i.id === id);
          return {
            items: s.items.filter((i) => i.id !== id),
            history: pushHistory(s, 'del', `Deleted item: ${it?.name ?? id}`, snap),
          };
        });
      },

      // ── Categories ────────────────────────────────────────────────────────
      addCategory(name) {
        set((s) => {
          if (s.categories.includes(name)) return s;
          const snap = JSON.stringify(s);
          return {
            categories: [...s.categories, name],
            history: pushHistory(s, 'add', `Added category: ${name}`, snap),
          };
        });
      },
      renameCategory(oldName, newName) {
        set((s) => {
          const snap = JSON.stringify(s);
          return {
            categories: s.categories.map((c) => (c === oldName ? newName : c)),
            items: s.items.map((it) =>
              it.category === oldName ? { ...it, category: newName } : it,
            ),
            history: pushHistory(s, 'edit', `Renamed category: ${oldName} → ${newName}`, snap),
          };
        });
      },
      deleteCategory(name) {
        set((s) => {
          const snap = JSON.stringify(s);
          return {
            categories: s.categories.filter((c) => c !== name),
            items: s.items.map((it) =>
              it.category === name ? { ...it, category: 'Uncategorized' } : it,
            ),
            history: pushHistory(s, 'del', `Deleted category: ${name}`, snap),
          };
        });
      },

      // ── Delivery Men ──────────────────────────────────────────────────────
      addDeliveryMan(data) {
        set((s) => {
          const snap = JSON.stringify(s);
          return {
            deliveryMen: [...s.deliveryMen, { id: uid(), ...data }],
            history: pushHistory(s, 'add', `Added delivery man: ${data.name}`, snap),
          };
        });
      },
      updateDeliveryMan(id, data) {
        set((s) => {
          const snap = JSON.stringify(s);
          return {
            deliveryMen: s.deliveryMen.map((d) => (d.id === id ? { ...d, ...data } : d)),
            history: pushHistory(s, 'edit', `Updated delivery man: ${data.name ?? id}`, snap),
          };
        });
      },
      deleteDeliveryMan(id) {
        set((s) => {
          const snap = JSON.stringify(s);
          const dm = s.deliveryMen.find((d) => d.id === id);
          return {
            deliveryMen: s.deliveryMen.filter((d) => d.id !== id),
            history: pushHistory(s, 'del', `Deleted delivery man: ${dm?.name ?? id}`, snap),
          };
        });
      },

      // ── Orders ────────────────────────────────────────────────────────────
      addOrder(data) {
        const snap = JSON.stringify(get());
        const order: Order = {
          id: uid(),
          createdAt: new Date().toISOString(),
          ...data,
        };
        set((s) => ({
          orders: [order, ...s.orders],
          history: pushHistory(s, 'add',
            `New order #${order.id.slice(-5)} — ${order.items.length} items`, snap),
        }));
        return order;
      },
      setOrderStatus(id, status) {
        set((s) => {
          const snap = JSON.stringify(s);
          return {
            orders: s.orders.map((o) => (o.id === id ? { ...o, status } : o)),
            history: pushHistory(s, 'edit', `Order ${id.slice(-5)} → ${status}`, snap),
          };
        });
      },
      deleteOrder(id) {
        set((s) => {
          const snap = JSON.stringify(s);
          return {
            orders: s.orders.filter((o) => o.id !== id),
            history: pushHistory(s, 'del', `Deleted order ${id.slice(-5)}`, snap),
          };
        });
      },

      // ── Credentials ───────────────────────────────────────────────────────
      addCredential(data) {
        set((s) => {
          const snap = JSON.stringify(s);
          const cred: Credential = {
            id: uid(),
            stocks: [],
            added: new Date().toISOString(),
            ...data,
          };
          return {
            credentials: [cred, ...s.credentials],
            history: pushHistory(s, 'add', `Added credential: ${data.name} (${data.email})`, snap),
          };
        });
      },
      updateCredential(id, data) {
        set((s) => {
          const snap = JSON.stringify(s);
          return {
            credentials: s.credentials.map((c) => (c.id === id ? { ...c, ...data } : c)),
            history: pushHistory(s, 'edit', `Edited credential: ${data.name ?? id}`, snap),
          };
        });
      },
      deleteCredential(id) {
        set((s) => {
          const snap = JSON.stringify(s);
          const cred = s.credentials.find((c) => c.id === id);
          return {
            credentials: s.credentials.filter((c) => c.id !== id),
            history: pushHistory(s, 'del', `Deleted credential: ${cred?.name ?? id}`, snap),
          };
        });
      },
      addStock(credId, stock) {
        set((s) => {
          const snap = JSON.stringify(s);
          const newStock: Stock = { id: uid(), ...stock };
          return {
            credentials: s.credentials.map((c) =>
              c.id === credId ? { ...c, stocks: [...c.stocks, newStock] } : c,
            ),
            history: pushHistory(s, 'edit', `Added stock ${stock.name} to credential`, snap),
          };
        });
      },
      updateStock(credId, stockId, data) {
        set((s) => {
          const snap = JSON.stringify(s);
          return {
            credentials: s.credentials.map((c) =>
              c.id === credId
                ? {
                    ...c,
                    stocks: c.stocks.map((stk) =>
                      stk.id === stockId ? { ...stk, ...data } : stk,
                    ),
                  }
                : c,
            ),
            history: pushHistory(s, 'edit', `Updated stock`, snap),
          };
        });
      },
      deleteStock(credId, stockId) {
        set((s) => {
          const snap = JSON.stringify(s);
          return {
            credentials: s.credentials.map((c) =>
              c.id === credId
                ? { ...c, stocks: c.stocks.filter((stk) => stk.id !== stockId) }
                : c,
            ),
            history: pushHistory(s, 'del', `Removed stock`, snap),
          };
        });
      },

      // ── History ───────────────────────────────────────────────────────────
      deleteHistoryEntry(id) {
        set((s) => ({ history: s.history.filter((h) => h.id !== id) }));
      },
      clearHistory() {
        set({ history: [] });
      },
      restoreSnapshot(historyId) {
        const entry = get().history.find((h) => h.id === historyId);
        if (!entry?.snapshot) return false;
        try {
          const restored = JSON.parse(entry.snapshot) as Partial<AppState>;
          set((s) => ({
            ...restored,
            credentials: (restored.credentials ?? []).map((c) => ({
              ...c,
              stocks: c.stocks ?? [],
            })),
            categories: restored.categories ?? DEFAULT_CATEGORIES,
            history: pushHistory(
              { ...s, ...restored },
              'edit',
              `Restored snapshot from ${new Date(entry.time).toLocaleString()}`,
            ),
          }));
          return true;
        } catch {
          return false;
        }
      },
      pruneHistory() {
        set((s) => {
          const ret = s.settings.historyretention;
          if (!ret) return s;
          const cutoff = Date.now() - ret * 86_400_000;
          return {
            history: s.history.filter((h) => new Date(h.time).getTime() > cutoff),
          };
        });
      },

      // ── Settings ──────────────────────────────────────────────────────────
      updateSettings(data) {
        set((s) => ({ settings: { ...s.settings, ...data } }));
      },

      // ── Data management ───────────────────────────────────────────────────
      nukeAll() {
        set({
          items: [],
          categories: DEFAULT_CATEGORIES,
          deliveryMen: [],
          orders: [],
          credentials: [],
          history: [],
        });
      },
      importData(data) {
        set((s) => ({
          items: data.items
            ? [...s.items, ...data.items.filter((x) => !s.items.find((i) => i.id === x.id))]
            : s.items,
          categories: data.categories
            ? [...new Set([...s.categories, ...data.categories])]
            : s.categories,
          deliveryMen: data.deliveryMen
            ? [...s.deliveryMen, ...data.deliveryMen.filter((x) => !s.deliveryMen.find((i) => i.id === x.id))]
            : s.deliveryMen,
          orders: data.orders
            ? [...s.orders, ...data.orders.filter((x) => !s.orders.find((i) => i.id === x.id))]
            : s.orders,
          credentials: data.credentials
            ? [
                ...s.credentials,
                ...data.credentials
                  .filter((x) => !s.credentials.find((i) => i.id === x.id))
                  .map((c) => ({ ...c, stocks: c.stocks ?? [] })),
              ]
            : s.credentials,
          history: pushHistory(s, 'add', 'Imported data from JSON backup'),
        }));
      },
    }),
    {
      name: 'vault_state',
      storage: createJSONStorage(() => customServerStorage),
    },
  ),
);
