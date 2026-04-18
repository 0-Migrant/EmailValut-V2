import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import type {
  Item, DeliveryMan, Order, OrderStatus,
  Credential, Stock, HistoryEntry, Settings, Bundle,
} from './types';
import { uid } from './utils';
import { supabase, isSupabaseEnabled } from './supabase';

// ─── State shape ──────────────────────────────────────────────────────────────

interface AppState {
  items: Item[];
  categories: string[];
  deliveryMen: DeliveryMan[];
  orders: Order[];
  bundles: Bundle[];
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

  // Bundles
  addBundle: (data: Omit<Bundle, 'id'>) => void;
  updateBundle: (id: string, data: Partial<Omit<Bundle, 'id'>>) => void;
  deleteBundle: (id: string) => void;

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
  consumeStock: (credId: string, stockId: string, qty: number) => void;

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

const DEFAULT_CATEGORIES = [''];

const DEFAULT_ITEMS: Item[] = [];

const DEFAULT_DELIVERY_MEN: DeliveryMan[] = [];

const DEFAULT_SETTINGS: Settings = {
  showpass: false,
  confirmdelete: true,
  rowsperpage: 25,
  historyretention: 7,
  historylimit: 50,
  theme: 'light',
};

// ─── Helper: add history entry ────────────────────────────────────────────────

function pushHistory(
  state: AppState,
  type: HistoryEntry['type'],
  msg: string,
): HistoryEntry[] {
  const entry: HistoryEntry = {
    id: uid(),
    type,
    msg,
    time: new Date().toISOString(),
    snapshot: JSON.stringify({ ...state, history: [] }),
  };
  const list = [entry, ...state.history].slice(0, state.settings.historylimit);
  return list;
}

// ─── Custom Server Storage ───────────────────────────────────────────────────

let _saveTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedSupabaseSave(value: string) {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(async () => {
    try {
      const { state } = JSON.parse(value);
      const { error } = await supabase!.from('vault').upsert({ id: 1, data: state });
      if (error) {
        console.warn('Supabase setItem failed, falling back to localStorage:', error);
        window.localStorage.setItem('vault_state', value);
      }
    } catch (err) {
      console.warn('Failed to save vault data to Supabase, falling back to localStorage:', err);
      window.localStorage.setItem('vault_state', value);
    }
  }, 1000);
}

const supabaseStorage: StateStorage = {
  getItem: async (): Promise<string | null> => {
    if (typeof window === 'undefined') return null;
    try {
      const { data, error } = await supabase!
        .from('vault')
        .select('data')
        .eq('id', 1)
        .single();

      if (error) {
        if (error.code !== 'PGRST116') {
          console.warn('Supabase getItem failed, falling back to localStorage:', error);
        }
        // Fallback to localStorage
        return window.localStorage.getItem('vault_state');
      }

      return JSON.stringify({ state: data?.data ?? null, version: 0 });
    } catch (err) {
      console.warn('Failed to fetch vault data from Supabase, falling back to localStorage:', err);
      return window.localStorage.getItem('vault_state');
    }
  },
  setItem: async (_name: string, value: string): Promise<void> => {
    if (typeof window === 'undefined') return;
    debouncedSupabaseSave(value);
  },
  removeItem: async (): Promise<void> => {
    if (typeof window === 'undefined') return;
    try {
      const { error } = await supabase!.from('vault').delete().eq('id', 1);
      if (error) {
        console.warn('Supabase removeItem failed, falling back to localStorage:', error);
        window.localStorage.removeItem('vault_state');
      }
    } catch (err) {
      console.warn('Failed to remove vault data from Supabase, falling back to localStorage:', err);
      window.localStorage.removeItem('vault_state');
    }
  },
};

if (typeof window !== 'undefined') {
  console.debug('[VaultStore] storage=', isSupabaseEnabled ? 'supabase' : 'localStorage');
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useVaultStore = create<VaultStore>()(
  persist(
    (set, get) => ({
      // ── Initial state ──────────────────────────────────────────────────────
      items:        DEFAULT_ITEMS,
      categories:   DEFAULT_CATEGORIES,
      deliveryMen:  DEFAULT_DELIVERY_MEN,
      orders:       [],
      bundles:      [],
      credentials:  [],
      history:      [],
      settings:     DEFAULT_SETTINGS,

      // ── Items ──────────────────────────────────────────────────────────────
      addItem(data) {
        set((s) => {
          const item: Item = { id: uid(), ...data };
          return {
            items: [...s.items, item],
            history: pushHistory(s, 'add', `Added item: ${data.name} @ ${data.price}`),
          };
        });
      },
      updateItem(id, data) {
        set((s) => {
          return {
            items: s.items.map((it) => (it.id === id ? { ...it, ...data } : it)),
            history: pushHistory(s, 'edit', `Updated item: ${data.name ?? id}`),
          };
        });
      },
      deleteItem(id) {
        set((s) => {
          const it = s.items.find((i) => i.id === id);
          return {
            items: s.items.filter((i) => i.id !== id),
            history: pushHistory(s, 'del', `Deleted item: ${it?.name ?? id}`),
          };
        });
      },

      // ── Categories ────────────────────────────────────────────────────────
      addCategory(name) {
        set((s) => {
          if (s.categories.includes(name)) return s;
          return {
            categories: [...s.categories, name],
            history: pushHistory(s, 'add', `Added category: ${name}`),
          };
        });
      },
      renameCategory(oldName, newName) {
        set((s) => {
          return {
            categories: s.categories.map((c) => (c === oldName ? newName : c)),
            items: s.items.map((it) =>
              it.category === oldName ? { ...it, category: newName } : it,
            ),
            history: pushHistory(s, 'edit', `Renamed category: ${oldName} → ${newName}`),
          };
        });
      },
      deleteCategory(name) {
        set((s) => {
          return {
            categories: s.categories.filter((c) => c !== name),
            items: s.items.map((it) =>
              it.category === name ? { ...it, category: 'Uncategorized' } : it,
            ),
            history: pushHistory(s, 'del', `Deleted category: ${name}`),
          };
        });
      },

      // ── Delivery Men ──────────────────────────────────────────────────────
      addDeliveryMan(data) {
        set((s) => {
          return {
            deliveryMen: [...s.deliveryMen, { id: uid(), ...data }],
            history: pushHistory(s, 'add', `Added delivery man: ${data.name}`),
          };
        });
      },
      updateDeliveryMan(id, data) {
        set((s) => {
          return {
            deliveryMen: s.deliveryMen.map((d) => (d.id === id ? { ...d, ...data } : d)),
            history: pushHistory(s, 'edit', `Updated delivery man: ${data.name ?? id}`),
          };
        });
      },
      deleteDeliveryMan(id) {
        set((s) => {
          const dm = s.deliveryMen.find((d) => d.id === id);
          return {
            deliveryMen: s.deliveryMen.filter((d) => d.id !== id),
            history: pushHistory(s, 'del', `Deleted delivery man: ${dm?.name ?? id}`),
          };
        });
      },

      // ── Orders ────────────────────────────────────────────────────────────
      addOrder(data) {
        const order: Order = {
          ...data,
          id: uid(),
          createdAt: new Date().toISOString(),
        };
        set((s) => ({
          orders: [order, ...s.orders],
          history: pushHistory(s, 'add',
            `New order #${order.id.slice(-5)} — ${order.items.length} items`),
        }));
        return order;
      },
      setOrderStatus(id, status) {
        set((s) => {
          return {
            orders: s.orders.map((o) => (o.id === id ? { ...o, status } : o)),
            history: pushHistory(s, 'edit', `Order ${id.slice(-5)} → ${status}`),
          };
        });
      },
      deleteOrder(id) {
        set((s) => {
          return {
            orders: s.orders.filter((o) => o.id !== id),
            history: pushHistory(s, 'del', `Deleted order ${id.slice(-5)}`),
          };
        });
      },

      // ── Credentials ───────────────────────────────────────────────────────
      addCredential(data) {
        set((s) => {
          const cred: Credential = {
            id: uid(),
            stocks: [],
            added: new Date().toISOString(),
            ...data,
          };
          return {
            credentials: [cred, ...s.credentials],
            history: pushHistory(s, 'add', `Added credential: ${data.name} (${data.email})`),
          };
        });
      },
      updateCredential(id, data) {
        set((s) => {
          return {
            credentials: s.credentials.map((c) => (c.id === id ? { ...c, ...data } : c)),
            history: pushHistory(s, 'edit', `Edited credential: ${data.name ?? id}`),
          };
        });
      },
      deleteCredential(id) {
        set((s) => {
          const cred = s.credentials.find((c) => c.id === id);
          return {
            credentials: s.credentials.filter((c) => c.id !== id),
            history: pushHistory(s, 'del', `Deleted credential: ${cred?.name ?? id}`),
          };
        });
      },
      addStock(credId, stock) {
        set((s) => {
          const newStock: Stock = { id: uid(), ...stock };
          return {
            credentials: s.credentials.map((c) =>
              c.id === credId ? { ...c, stocks: [...c.stocks, newStock] } : c,
            ),
            history: pushHistory(s, 'edit', `Added stock ${stock.name} to credential`),
          };
        });
      },
      updateStock(credId, stockId, data) {
        set((s) => {
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
            history: pushHistory(s, 'edit', `Updated stock`),
          };
        });
      },
      deleteStock(credId, stockId) {
        set((s) => {
          return {
            credentials: s.credentials.map((c) =>
              c.id === credId
                ? { ...c, stocks: c.stocks.filter((stk) => stk.id !== stockId) }
                : c,
            ),
            history: pushHistory(s, 'del', `Removed stock`),
          };
        });
      },
      consumeStock(credId, stockId, qty) {
        set((s) => ({
          credentials: s.credentials.map((c) =>
            c.id === credId
              ? { ...c, stocks: c.stocks.map((stk) => stk.id === stockId ? { ...stk, qty: Math.max(0, stk.qty - qty) } : stk) }
              : c,
          ),
          history: pushHistory(s, 'edit', `Consumed ${qty} from stock`),
        }));
      },

      // ── Bundles ───────────────────────────────────────────────────────────
      addBundle(data) {
        set((s) => {
          const bundle: Bundle = { id: uid(), ...data };
          return {
            bundles: [...s.bundles, bundle],
            history: pushHistory(s, 'add', `Added bundle: ${data.name}`),
          };
        });
      },
      updateBundle(id, data) {
        set((s) => ({
          bundles: s.bundles.map((b) => (b.id === id ? { ...b, ...data } : b)),
          history: pushHistory(s, 'edit', `Updated bundle: ${data.name ?? id}`),
        }));
      },
      deleteBundle(id) {
        set((s) => {
          const b = s.bundles.find((x) => x.id === id);
          return {
            bundles: s.bundles.filter((x) => x.id !== id),
            history: pushHistory(s, 'del', `Deleted bundle: ${b?.name ?? id}`),
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
          const restored = JSON.parse(entry.snapshot) as Omit<AppState, 'history'>;
          const index = get().history.findIndex((h) => h.id === historyId);
          set({
            ...restored,
            credentials: (restored.credentials ?? []).map((c) => ({
              ...c,
              stocks: c.stocks ?? [],
            })),
            categories: restored.categories ?? DEFAULT_CATEGORIES,
            history: get().history.slice(0, index + 1),
          });
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
          bundles: [],
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
          bundles: data.bundles
            ? [...s.bundles, ...data.bundles.filter((x) => !s.bundles.find((b) => b.id === x.id))]
            : s.bundles,
          history: pushHistory(s, 'add', 'Imported data from JSON backup'),
        }));
      },
    }),
    {
      name: 'vault_state',
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') return supabaseStorage;
        return isSupabaseEnabled ? supabaseStorage : window.localStorage;
      }),
    },
  ),
);
