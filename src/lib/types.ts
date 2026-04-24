// ─── Core entities ────────────────────────────────────────────────────────────

export interface Item {
  id: string;
  name: string;
  price: number;
  category: string;
}

export interface BundleItem {
  itemId: string;
  qty: number;
}

export interface Bundle {
  id: string;
  name: string;
  items: BundleItem[];
}

export interface DeliveryMan {
  id: string;
  name: string;
}

export interface OrderItem {
  itemId: string;
  qty: number;
  price: number;
  credentialId?: string;
  stockId?: string;
}

export type OrderStatus = 'waiting' | 'accepted' | 'delivered' | 'waiting_payment' | 'payment_complete' | 'done';

export interface Order {
  id: string;
  deliveryManId: string;
  customerId: string;
  items: OrderItem[];
  status: OrderStatus;
  customPrice: number | null;
  discountPct: number | null;
  paymentMethod: string;
  paymentDetail: string;
  source: string;
  createdAt: string;
}

export interface Stock {
  id: string;
  name: string;
  qty: number;
  itemId?: string;
  price?: number;
}

export interface Credential {
  id: string;
  name: string;
  email: string;
  pass: string;
  stocks: Stock[];
  added: string;
}

export type HistoryType = 'add' | 'edit' | 'del';

export interface HistoryEntry {
  id: string;
  type: HistoryType;
  msg: string;
  time: string;
  snapshot?: string;
}

export interface PaymentMethod {
  id: string;
  label: string;
  detail: string;
}

export interface PlatformFee {
  platform: string;
  feeType: 'pct' | 'amount';
  value: number;
}

export interface Wallet {
  id: string;
  name: string;
  paymentMethods: string[]; // payment method labels whose order revenue flows into this wallet
}

export interface PayoutEntry {
  id: string;
  workerId: string;
  walletId?: string; // which wallet a distribution came from
  amount: number;
  type: 'debit' | 'credit';
  status?: 'pending' | 'paid'; // only relevant for worker debit entries
  note: string;
  createdAt: string;
}

export interface Settings {
  showpass: boolean;
  confirmdelete: boolean;
  rowsperpage: number;
  historyretention: number;
  historylimit: number;
  theme: 'light' | 'dark';
  paymentMethods: PaymentMethod[];
  platforms: string[];
  platformFees: PlatformFee[];
  wallets: Wallet[];
}

export interface BundleItem {
  itemId: string;
  qty: number;
}

export interface Bundle {
  id: string;
  name: string;
  items: BundleItem[];
}

// ─── Order Builder ────────────────────────────────────────────────────────────

export interface OrderBuilder {
  deliveryManId: string;
  customerId: string;
  items: OrderItem[];
  customPrice: string;
}

// ─── Computed helpers ─────────────────────────────────────────────────────────

export interface DiscountInfo {
  hasDiscount: true;
  saved: number;
  pct: string;
  itemsTotal: number;
  customPrice: number;
}

export interface SurchargeInfo {
  hasSurcharge: true;
  extra: number;
  pct: string;
  itemsTotal: number;
  customPrice: number;
}

export type PriceInfo =
  | { type: 'normal'; total: number; itemsTotal: number }
  | { type: 'discount'; total: number; saved: number; pct: string; itemsTotal: number }
  | { type: 'surcharge'; total: number; extra: number; pct: string; itemsTotal: number };

// ─── Modal state ──────────────────────────────────────────────────────────────

export interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  onConfirm: (() => void) | null;
}

export interface LoyaltyState {
  open: boolean;
  customerId: string;
  orderNum: number;
}
