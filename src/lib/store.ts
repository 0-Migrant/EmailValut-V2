import { create } from 'zustand';
import type {
  Item, DeliveryMan, Order, OrderStatus, WorkerStatus,
  Credential, Stock, HistoryEntry, Settings, Bundle, PayoutEntry, Wallet, Client,
} from './types';
import { uid } from './utils';
import { isCloudEnabled, saveVault, getVault } from './api';

// ─── State shape ──────────────────────────────────────────────────────────────

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'error';

// Separate non-persisted store for save status so status updates never trigger
// the cloudStorage.setItem → debouncedSave cascade in the main vault store.
interface SaveStatusState {
  saveStatus: SaveStatus;
  saveError: string | null;
}
export const useSaveStatusStore = create<SaveStatusState>()(() => ({
  saveStatus: 'idle' as SaveStatus,
  saveError: null,
}));

interface AppState {
  items: Item[];
  categories: string[];
  deliveryMen: DeliveryMan[];
  orders: Order[];
  bundles: Bundle[];
  credentials: Credential[];
  history: HistoryEntry[];
  settings: Settings;
  payouts: PayoutEntry[];
  clients: Client[];
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

  // Clients
  addClient: (data: Omit<Client, 'id' | 'createdAt'>) => void;
  updateClient: (id: string, data: Partial<Omit<Client, 'id' | 'createdAt'>>) => void;
  deleteClient: (id: string) => void;
  ensureClient: (name: string) => void;

  // Delivery Men
  addDeliveryMan: (data: Omit<DeliveryMan, 'id'>) => void;
  updateDeliveryMan: (id: string, data: Partial<Omit<DeliveryMan, 'id'>>) => void;
  deleteDeliveryMan: (id: string) => void;
  setWorkerStatus: (id: string, status: WorkerStatus) => void;
  freezeWorker: (id: string) => void;
  unfreezeWorker: (id: string) => void;

  // Orders
  addOrder: (data: Omit<Order, 'id' | 'createdAt'>) => Order;
  setOrderStatus: (id: string, status: OrderStatus) => void;
  updateOrder: (id: string, patch: Partial<Omit<Order, 'id' | 'createdAt'>>) => void;
  deleteOrder: (id: string) => void;

  // Clients sync
  syncClientsFromDoneOrders: () => number;

  // Payouts
  addPayout: (data: Omit<PayoutEntry, 'id' | 'createdAt'>) => void;
  addPayouts: (entries: Omit<PayoutEntry, 'id' | 'createdAt'>[]) => void;
  markPayoutPaid: (id: string) => void;
  partialOutPayout: (id: string, outAmount: number) => void;
  deletePayout: (id: string) => void;
  restorePayoutToPending: (id: string) => void;

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

  // Wallets
  addWallet: (data: Omit<Wallet, 'id'>) => void;
  removeWallet: (id: string) => void;
  updateWallet: (id: string, patch: Partial<Omit<Wallet, 'id'>>) => void;

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
  paymentMethods: [
    { id: 'pm-1', label: 'Cash', detail: '' },
    { id: 'pm-2', label: 'PayPal', detail: '' },
    { id: 'pm-3', label: 'Binance', detail: '' },
  ],
  platforms: ['WhatsApp', 'Instagram', 'Phone Call', 'Walk-in', 'Discord'],
  paymentMethodFees: [],
  wallets: [],
  hideResourceAccounts: false,
  workerFullAccess: false,
  workerOfflineDelay: 8,
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

// ─── DB-only save layer ───────────────────────────────────────────────────────
// DB is the single source of truth. localStorage is never used for persistence.

let _saveTimer: ReturnType<typeof setTimeout> | null = null;
let _saveInFlight = false;
let _pendingState: AppState | null = null;
let _refreshing = false; // true while refreshFromServer is applying server state
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [2000, 5000, 15000];
export const saveCallbacks = { onSaveSuccess: null as (() => void) | null };

function _setStoreStatus(status: SaveStatus, err?: string | null) {
  useSaveStatusStore.setState({
    saveStatus: status,
    saveError: err !== undefined ? err : useSaveStatusStore.getState().saveError,
  });
}

// Extract only data fields (no actions) from the full store for saving
function getAppState(store: VaultStore): AppState {
  const { items, categories, deliveryMen, orders, bundles, credentials,
          history, settings, payouts, clients } = store;
  return { items, categories, deliveryMen, orders, bundles, credentials,
           history, settings, payouts, clients };
}

function debouncedSave(state: AppState) {
  if (!isCloudEnabled) return;
  if (_saveInFlight) {
    _pendingState = state;
    return;
  }
  if (_saveTimer) clearTimeout(_saveTimer);
  _setStoreStatus('pending');
  _saveTimer = setTimeout(() => executeSave(state, 0), 1000);
}

async function executeSave(state: AppState, attempt: number): Promise<void> {
  _saveTimer = null;
  _saveInFlight = true;
  _pendingState = null;
  _setStoreStatus('saving');
  try {
    await saveVault(state);
    _setStoreStatus('idle', null);
    saveCallbacks.onSaveSuccess?.();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Vault] Save failed (attempt ${attempt + 1}):`, err);
    if (attempt < MAX_RETRIES - 1) {
      const delay = RETRY_DELAYS_MS[attempt] ?? 15000;
      _setStoreStatus('pending');
      _saveTimer = setTimeout(() => executeSave(state, attempt + 1), delay);
    } else {
      _setStoreStatus('error', msg);
    }
  } finally {
    _saveInFlight = false;
    if (_pendingState && !_saveTimer) {
      const pending = _pendingState;
      _pendingState = null;
      debouncedSave(pending);
    }
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useVaultStore = create<VaultStore>()(
  (set, get) => ({
    // ── Initial state (shown while loading from DB on first render) ───────────
    items:        DEFAULT_ITEMS,
    categories:   DEFAULT_CATEGORIES,
    deliveryMen:  DEFAULT_DELIVERY_MEN,
    orders:       [],
    bundles:      [],
    credentials:  [],
    history:      [],
    settings:     DEFAULT_SETTINGS,
    payouts:      [],
    clients:      [],

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

      // ── Clients ───────────────────────────────────────────────────────────
      addClient(data) {
        set((s) => {
          const client: Client = { id: uid(), createdAt: new Date().toISOString(), ...data };
          return { clients: [...s.clients, client] };
        });
      },
      updateClient(id, data) {
        set((s) => ({
          clients: s.clients.map((c) => (c.id === id ? { ...c, ...data } : c)),
        }));
      },
      deleteClient(id) {
        set((s) => ({ clients: s.clients.filter((c) => c.id !== id) }));
      },
      ensureClient(name) {
        if (!name.trim()) return;
        set((s) => {
          const exists = s.clients.some((c) => c.name.toLowerCase() === name.trim().toLowerCase());
          if (exists) return s;
          const client: Client = { id: uid(), name: name.trim(), createdAt: new Date().toISOString() };
          return { clients: [...s.clients, client] };
        });
      },
      syncClientsFromDoneOrders() {
        let added = 0;
        set((s) => {
          const names = [
            ...new Set(
              s.orders
                .filter((o) => o.status === 'done' && o.customerId?.trim())
                .map((o) => o.customerId.trim()),
            ),
          ];
          const newClients: Client[] = [];
          for (const name of names) {
            const exists = s.clients.some((c) => c.name.toLowerCase() === name.toLowerCase());
            if (!exists) {
              newClients.push({ id: uid(), name, createdAt: new Date().toISOString() });
            }
          }
          added = newClients.length;
          if (!newClients.length) return s;
          return { clients: [...s.clients, ...newClients] };
        });
        return added;
      },

      // ── Delivery Men ──────────────────────────────────────────────────────
      addDeliveryMan(data) {
        set((s) => {
          const dm: DeliveryMan = { id: uid(), ...data };
          return {
            deliveryMen: [...s.deliveryMen, dm],
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
      setWorkerStatus(id, status) {
        set((s) => ({
          deliveryMen: s.deliveryMen.map((d) => (d.id === id ? { ...d, status } : d)),
        }));
      },
      freezeWorker(id) {
        set((s) => ({
          deliveryMen: s.deliveryMen.map((d) => (d.id === id ? { ...d, frozen: true, status: 'offline' } : d)),
        }));
      },
      unfreezeWorker(id) {
        set((s) => ({
          deliveryMen: s.deliveryMen.map((d) => (d.id === id ? { ...d, frozen: false } : d)),
        }));
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
          const order = s.orders.find((o) => o.id === id);
          let clients = s.clients;
          if (status === 'done' && order?.customerId?.trim()) {
            const name = order.customerId.trim();
            const exists = clients.some((c) => c.name.toLowerCase() === name.toLowerCase());
            if (!exists) {
              clients = [...clients, { id: uid(), name, createdAt: new Date().toISOString() }];
            }
          }

          // Auto-manage worker availability based on order status
          let deliveryMen = s.deliveryMen;
          const workerId = order?.deliveryManId;
          if (workerId) {
            if (status === 'accepted') {
              deliveryMen = deliveryMen.map((d) =>
                d.id === workerId ? { ...d, status: 'busy' as const } : d
              );
            } else if (status === 'delivered' || status === 'waiting_payment' || status === 'done') {
              deliveryMen = deliveryMen.map((d) =>
                d.id === workerId ? { ...d, status: 'available' as const } : d
              );
            }
          }

          return {
            orders: s.orders.map((o) => (o.id === id ? { ...o, status } : o)),
            deliveryMen,
            clients,
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
      updateOrder(id, patch) {
        set((s) => ({
          orders: s.orders.map((o) => (o.id === id ? { ...o, ...patch } : o)),
          history: pushHistory(s, 'edit', `Updated order ${id.slice(-5)}`),
        }));
      },

      // ── Payouts ───────────────────────────────────────────────────────────
      addPayout(data) {
        set((s) => {
          const entry: PayoutEntry = { id: uid(), createdAt: new Date().toISOString(), ...data };
          return { payouts: [entry, ...s.payouts] };
        });
      },
      addPayouts(entries) {
        set((s) => {
          const now = new Date().toISOString();
          const newEntries = entries.map((e) => ({ ...e, id: uid(), createdAt: now }));
          return { payouts: [...newEntries, ...s.payouts] };
        });
      },
      markPayoutPaid(id) {
        set((s) => ({ payouts: s.payouts.map((p) => p.id === id ? { ...p, status: 'paid' as const } : p) }));
      },
      partialOutPayout(id, outAmount) {
        set((s) => {
          const entry = s.payouts.find((p) => p.id === id);
          if (!entry || entry.status !== 'pending') return s;
          const remainder = entry.amount - outAmount;
          const paidEntry: PayoutEntry = { ...entry, id: uid(), amount: outAmount, status: 'paid', createdAt: new Date().toISOString() };
          if (remainder <= 0) {
            return { payouts: s.payouts.map((p) => p.id === id ? { ...p, status: 'paid' as const } : p) };
          }
          const updatedPayouts = s.payouts.map((p) => p.id === id ? { ...p, amount: remainder } : p);
          return { payouts: [paidEntry, ...updatedPayouts] };
        });
      },
      deletePayout(id) {
        set((s) => ({ payouts: s.payouts.filter((p) => p.id !== id) }));
      },
      restorePayoutToPending(id) {
        set((s) => {
          const entry = s.payouts.find((p) => p.id === id);
          if (!entry) return s;
          // Find an existing pending entry for the same worker/wallet/note to merge into
          const sibling = s.payouts.find(
            (p) =>
              p.id !== id &&
              p.workerId === entry.workerId &&
              p.walletId === entry.walletId &&
              p.note === entry.note &&
              p.type === 'debit' &&
              p.status === 'pending',
          );
          if (sibling) {
            // Merge: add amount back to the sibling pending entry and remove the paid entry
            return {
              payouts: s.payouts
                .filter((p) => p.id !== id)
                .map((p) => p.id === sibling.id ? { ...p, amount: p.amount + entry.amount } : p),
            };
          }
          // No sibling — just flip status back to pending
          return { payouts: s.payouts.map((p) => p.id === id ? { ...p, status: 'pending' as const } : p) };
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

      // ── Wallets ───────────────────────────────────────────────────────────
      addWallet(data) {
        set((s) => ({
          settings: {
            ...s.settings,
            wallets: [...(s.settings.wallets ?? []), { id: uid(), ...data }],
          },
        }));
      },
      removeWallet(id) {
        set((s) => ({
          settings: {
            ...s.settings,
            wallets: (s.settings.wallets ?? []).filter((w) => w.id !== id),
          },
        }));
      },
      updateWallet(id, patch) {
        set((s) => ({
          settings: {
            ...s.settings,
            wallets: (s.settings.wallets ?? []).map((w) => w.id === id ? { ...w, ...patch } : w),
          },
        }));
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
          payouts: [],
          clients: [],
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
          payouts: data.payouts
            ? [...s.payouts, ...data.payouts.filter((x) => !s.payouts.find((p) => p.id === x.id))]
            : s.payouts,
          clients: data.clients
            ? [...s.clients, ...data.clients.filter((x) => !s.clients.find((c) => c.id === x.id))]
            : s.clients,
          settings: data.settings
            ? { ...s.settings, ...data.settings }
            : s.settings,
          history: pushHistory(s, 'add', 'Imported data from JSON backup'),
        }));
      },
  }),
);

// Subscribe to every state change and debounce-save to DB.
// _refreshing guard prevents saving while we're loading from server.
useVaultStore.subscribe((state) => {
  if (!isCloudEnabled || _refreshing) return;
  debouncedSave(getAppState(state));
});

// Immediately flush any pending debounced save (e.g. after import).
export async function flushSave(): Promise<void> {
  if (!isCloudEnabled) return;
  if (_saveTimer) {
    clearTimeout(_saveTimer);
    _saveTimer = null;
  }
  if (_saveInFlight) return;
  executeSave(getAppState(useVaultStore.getState()), 0);
}

// Load data from DB into the store. Called once on App mount.
// One-time migration: if old localStorage data exists and DB is empty, push it up then clear it.
export async function refreshFromServer(): Promise<void> {
  if (!isCloudEnabled) return;
  if (_saveTimer !== null || _saveInFlight) return;
  try {
    const data = await getVault() as Record<string, unknown> | null;
    if (!data) return;

    const serverCollections = [
      data.deliveryMen, data.orders, data.items,
      data.credentials, data.clients, data.bundles, data.payouts,
    ];
    const serverIsEmpty = !serverCollections.some(
      (col) => Array.isArray(col) && (col as unknown[]).length > 0,
    );

    // One-time migration: old localStorage data → push to DB, then wipe localStorage
    if (typeof window !== 'undefined') {
      const localRaw = window.localStorage.getItem('vault_state');
      if (localRaw) {
        try {
          const { state: localState } = JSON.parse(localRaw) as { state: Record<string, unknown> };
          if (localState && serverIsEmpty) {
            // Server empty — push local data up immediately
            _setStoreStatus('saving');
            await saveVault(localState);
            _setStoreStatus('idle', null);
          }
        } catch { /* corrupt local data — ignore */ }
        // Always remove old localStorage after migration attempt
        window.localStorage.removeItem('vault_state');
        // Re-fetch so we apply whatever is now in DB
        const fresh = await getVault() as Record<string, unknown> | null;
        if (fresh) {
          if (!fresh.settings) delete fresh.settings;
          _refreshing = true;
          useVaultStore.setState(fresh as unknown as Partial<AppState>);
          _refreshing = false;
        }
        return;
      }
    }

    // Normal path: load DB data into store
    if (!data.settings) delete data.settings;
    _refreshing = true;
    useVaultStore.setState(data as unknown as Partial<AppState>);
    _refreshing = false;
  } catch (err) {
    _refreshing = false;
    console.warn('[Vault] refreshFromServer error:', err);
  }
}
