import type { Order, OrderItem, PriceInfo } from './types';

// ─── ID generator ─────────────────────────────────────────────────────────────

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ─── HTML escape ─────────────────────────────────────────────────────────────

export function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Number formatting ────────────────────────────────────────────────────────

export function fmt(n: number): string {
  return Number(n ?? 0).toLocaleString('en-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ─── Date formatting ──────────────────────────────────────────────────────────

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function fmtDateTime(iso: string): string {
  return `${fmtDate(iso)} ${fmtTime(iso)}`;
}

// ─── Order total helpers ──────────────────────────────────────────────────────

export function orderItemsTotal(order: Pick<Order, 'items'>): number {
  return (order.items ?? []).reduce((a: number, oi: OrderItem) => a + oi.price * oi.qty, 0);
}

export function orderTotal(order: Pick<Order, 'items' | 'customPrice' | 'discountPct'>): number {
  const itemsTotal = orderItemsTotal(order);
  if (order.customPrice !== null && order.customPrice !== undefined && order.customPrice >= 0) {
    return order.customPrice;
  }
  if (order.discountPct !== null && order.discountPct !== undefined && order.discountPct > 0) {
    return itemsTotal * (1 - order.discountPct / 100);
  }
  return itemsTotal;
}

export function getPriceInfo(order: Pick<Order, 'items' | 'customPrice' | 'discountPct'>): PriceInfo {
  const itemsTotal = orderItemsTotal(order);
  const cp = order.customPrice;

  if (cp !== null && cp !== undefined && cp >= 0) {
    if (cp < itemsTotal && itemsTotal > 0) {
      const saved = itemsTotal - cp;
      const pct = ((saved / itemsTotal) * 100).toFixed(1);
      return { type: 'discount', total: cp, saved, pct, itemsTotal };
    }
    if (cp > itemsTotal && itemsTotal > 0) {
      const extra = cp - itemsTotal;
      const pct = ((extra / itemsTotal) * 100).toFixed(1);
      return { type: 'surcharge', total: cp, extra, pct, itemsTotal };
    }
    return { type: 'normal', total: cp, itemsTotal };
  }

  const dp = order.discountPct;
  if (dp !== null && dp !== undefined && dp > 0) {
    const total = itemsTotal * (1 - dp / 100);
    const saved = itemsTotal - total;
    return { type: 'discount', total, saved, pct: dp.toFixed(1), itemsTotal };
  }

  return { type: 'normal', total: itemsTotal, itemsTotal };
}

// ─── Status badge CSS class ────────────────────────────────────────────────────

export function statusBadgeClass(status: string): string {
  switch (status) {
    case 'done':             return 'badge-done';
    case 'accepted':         return 'badge-accepted';
    case 'delivering':       return 'badge-accepted';
    case 'delivered':        return 'badge-delivered';
    case 'waiting_payment':  return 'badge-waiting-payment';
    case 'payment_complete': return 'badge-payment-complete';
    default:                 return 'badge-waiting';
  }
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'waiting':          return 'Waiting';
    case 'accepted':         return 'Accepted';
    case 'delivering':       return 'Delivering';
    case 'delivered':        return 'Delivered';
    case 'waiting_payment':  return 'Waiting for Payment';
    case 'payment_complete': return 'Payment Complete';
    case 'done':             return 'Done';
    default:                 return status;
  }
}

// ─── Platform fee helper ──────────────────────────────────────────────────────

export function calcFee(
  order: Pick<Order, 'items' | 'customPrice' | 'discountPct' | 'paymentMethod'>,
  paymentMethodFees: import('./types').PaymentMethodFee[],
): number {
  const fee = paymentMethodFees.find((f) => f.paymentMethod === order.paymentMethod);
  if (!fee) return 0;
  const total = orderTotal(order);
  const pctPart = fee.pct != null ? total * (fee.pct / 100) : 0;
  const amtPart = fee.amount ?? 0;
  return pctPart + amtPart;
}

// ─── Loyalty tiers ────────────────────────────────────────────────────────────

export const LOYALTY_TIERS = [
  { label: 'VIP',     emoji: '💎', color: '#a855f7', bg: 'rgba(168,85,247,0.15)', min: 100 },
  { label: 'Gold',    emoji: '🥇', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', min: 50  },
  { label: 'Silver',  emoji: '🥈', color: '#94a3b8', bg: 'rgba(148,163,184,0.18)', min: 20  },
  { label: 'Regular', emoji: '⭐', color: '#3b82f6', bg: 'rgba(59,130,246,0.13)', min: 10  },
  { label: 'New',     emoji: '🌱', color: '#22c55e', bg: 'rgba(34,197,94,0.13)',  min: 0   },
] as const;

export type LoyaltyTier = typeof LOYALTY_TIERS[number];

export function getLoyaltyTier(orderCount: number): LoyaltyTier {
  return LOYALTY_TIERS.find((t) => orderCount >= t.min) ?? LOYALTY_TIERS[LOYALTY_TIERS.length - 1];
}

// Fires exactly when a client reaches a tier boundary
const TIER_MILESTONES = new Set([10, 20, 50, 100]);

export function isLoyaltyMilestone(count: number): boolean {
  return TIER_MILESTONES.has(count);
}

// ─── Date filter helpers ──────────────────────────────────────────────────────

export function toDateInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function inDateRange(createdAt: string, from: string, to: string): boolean {
  if (!from && !to) return true;
  if (from && createdAt < from) return false;
  if (to && createdAt > to + 'T23:59:59') return false;
  return true;
}