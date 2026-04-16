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

export function orderTotal(order: Pick<Order, 'items' | 'customPrice'>): number {
  if (order.customPrice !== null && order.customPrice !== undefined && order.customPrice >= 0) {
    return order.customPrice;
  }
  return orderItemsTotal(order);
}

export function getPriceInfo(order: Pick<Order, 'items' | 'customPrice'>): PriceInfo {
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
  return { type: 'normal', total: itemsTotal, itemsTotal };
}

// ─── Status badge CSS class ────────────────────────────────────────────────────

export function statusBadgeClass(status: string): string {
  switch (status) {
    case 'done':      return 'badge-done';
    case 'cancelled': return 'badge-cancelled';
    case 'waiting':   return 'badge-waiting';
    default:          return 'badge-pending';
  }
}

// ─── Loyalty check ────────────────────────────────────────────────────────────

export function isLoyaltyMilestone(count: number): boolean {
  return count > 0 && count % 10 === 0;
}