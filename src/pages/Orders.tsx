import { useState } from 'react';
import { useVaultStore } from '@/lib/store';
import { useModal } from '@/context/ModalContext';
import { fmt, fmtDateTime, orderTotal, getPriceInfo, statusBadgeClass, statusLabel } from '@/lib/utils';
import type { OrderStatus } from '@/lib/types';
import Icon from '@/components/Icon';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all',             label: 'All Orders' },
  { value: 'waiting',         label: 'Waiting' },
  { value: 'accepted',        label: 'Accepted' },
  { value: 'delivered',       label: 'Delivered' },
  { value: 'waiting_payment', label: 'Waiting for Payment' },
  { value: 'payment_complete',label: 'Payment Complete' },
  { value: 'done',            label: 'Done' },
];

export default function Orders() {
  const orders      = useVaultStore((s) => s.orders);
  const deliveryMen = useVaultStore((s) => s.deliveryMen);
  const items       = useVaultStore((s) => s.items);
  const settings    = useVaultStore((s) => s.settings);
  const setStatus     = useVaultStore((s) => s.setOrderStatus);
  const delOrder      = useVaultStore((s) => s.deleteOrder);
  const updateOrder   = useVaultStore((s) => s.updateOrder);
  const { showConfirm, openOrderDetail } = useModal();

  const [search, setSearch]         = useState('');
  const [filter, setFilter]         = useState('all');
  const [dmFilter, setDmFilter]     = useState('');
  const [editingPm, setEditingPm]   = useState<string | null>(null); // orderId being edited

  const filtered = orders.filter((o) => {
    const dm = deliveryMen.find((d) => d.id === o.deliveryManId);
    const q = search.toLowerCase();
    const matchQ = !q || (dm?.name.toLowerCase().includes(q)) || o.customerId?.toLowerCase().includes(q) || o.id.toLowerCase().includes(q);
    const matchS = filter === 'all' || o.status === filter;
    const matchDm = !dmFilter || o.deliveryManId === dmFilter;
    return matchQ && matchS && matchDm;
  });

  function handleDelete(id: string) {
    if (settings.confirmdelete) {
      showConfirm('Delete order', 'Permanently delete this order?', () => delOrder(id));
    } else {
      delOrder(id);
    }
  }

  function handleStatus(id: string, status: OrderStatus) {
    setStatus(id, status);
  }

  return (
    <>
      <div className="section-title"><Icon name="orders" size={18} style={{ marginRight: 8 }} />Manage Orders</div>

      <div className="filter-bar orders-filter-bar">
        <input className="search-box" placeholder="Search by customer, worker..."
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="inp" value={filter} onChange={(e) => setFilter(e.target.value)}>
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="inp" value={dmFilter} onChange={(e) => setDmFilter(e.target.value)}>
          <option value="">All Workers</option>
          {deliveryMen.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      <div className="card">
        {!filtered.length
          ? <div className="empty-state"><div className="empty-icon">📋</div>No orders found.</div>
          : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Customer</th><th>Worker</th>
                    <th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th>Date</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o) => {
                    const dm   = deliveryMen.find((d) => d.id === o.deliveryManId);
                    const info = getPriceInfo(o);
                    return (
                      <tr key={o.id}>
                        <td><span className="tag">{o.id.slice(-5)}</span></td>
                        <td style={{ fontSize:12, color:'var(--text-muted)' }}>{o.customerId || '—'}</td>
                        <td style={{ fontWeight:500 }}>{dm?.name ?? 'Unknown'}</td>
                        <td style={{ color:'var(--text-muted)', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {o.items.map((oi) => items.find((i) => i.id === oi.itemId)?.name ?? '?').join(', ')}
                        </td>
                        <td>
                          {info.type === 'discount' && (
                            <div style={{ fontSize:11, textDecoration:'line-through', color:'var(--text-hint)' }}>{fmt(info.itemsTotal)}</div>
                          )}
                          <div style={{ fontWeight:700, color:'var(--accent)' }}>{fmt(orderTotal(o))} $ USD</div>
                          {info.type === 'discount'  && <span className="discount-badge">🏷 -{info.pct}%</span>}
                          {info.type === 'surcharge' && <span className="discount-badge" style={{ background:'var(--orange-bg)', color:'var(--orange)', borderColor:'var(--orange-border)' }}>📈 +{info.pct}%</span>}
                        </td>
                        <td>
                          {editingPm === o.id
                            ? (
                              <select
                                className="inp inp-sm"
                                autoFocus
                                value={o.paymentMethod}
                                onChange={(e) => {
                                  const pm = (settings.paymentMethods ?? []).find((m) => m.label === e.target.value);
                                  updateOrder(o.id, { paymentMethod: pm?.label ?? e.target.value, paymentDetail: pm?.detail ?? '' });
                                  setEditingPm(null);
                                }}
                                onBlur={() => setEditingPm(null)}
                              >
                                {(settings.paymentMethods ?? []).map((m) => (
                                  <option key={m.id} value={m.label}>{m.label}</option>
                                ))}
                              </select>
                            )
                            : (
                              <button
                                className="btn btn-ghost btn-xs"
                                style={{ fontSize: 12 }}
                                onClick={() => setEditingPm(o.id)}
                                title="Click to change payment method"
                              >
                                {o.paymentMethod || '—'} <Icon name="edit" size={10} style={{ marginLeft: 3, opacity: 0.5 }} />
                              </button>
                            )
                          }
                        </td>
                        <td><span className={`badge ${statusBadgeClass(o.status)}`}>{statusLabel(o.status)}</span></td>
                        <td><span className="tag">{fmtDateTime(o.createdAt)}</span></td>
                        <td>
                          <div className="action-group">
                            {o.status === 'waiting' && <>
                              <button className="btn btn-success btn-xs" onClick={() => handleStatus(o.id,'accepted')}><Icon name="check" size={11} style={{ marginRight: 3 }} />Accept</button>
                            </>}
                            {o.status === 'accepted' && <>
                              <button className="btn btn-success btn-xs" onClick={() => handleStatus(o.id,'waiting_payment')}><Icon name="check" size={11} style={{ marginRight: 3 }} />Delivered</button>
                              <button className="btn btn-ghost btn-xs"   onClick={() => handleStatus(o.id,'waiting')}><Icon name="arrowLeft" size={11} style={{ marginRight: 3 }} />Back</button>
                            </>}
                            {o.status === 'delivered' && <>
                              <button className="btn btn-success btn-xs" onClick={() => handleStatus(o.id,'waiting_payment')}><Icon name="check" size={11} style={{ marginRight: 3 }} />Awaiting Payment</button>
                              <button className="btn btn-ghost btn-xs"   onClick={() => handleStatus(o.id,'accepted')}><Icon name="arrowLeft" size={11} style={{ marginRight: 3 }} />Back</button>
                            </>}
                            {o.status === 'waiting_payment' && <>
                              <button className="btn btn-success btn-xs" onClick={() => handleStatus(o.id,'done')}><Icon name="check" size={11} style={{ marginRight: 3 }} />Payment Complete</button>
                              <button className="btn btn-ghost btn-xs"   onClick={() => handleStatus(o.id,'accepted')}><Icon name="arrowLeft" size={11} style={{ marginRight: 3 }} />Back</button>
                            </>}
                            {o.status === 'payment_complete' && <>
                              <button className="btn btn-success btn-xs" onClick={() => handleStatus(o.id,'done')}><Icon name="check" size={11} style={{ marginRight: 3 }} />Done</button>
                              <button className="btn btn-ghost btn-xs"   onClick={() => handleStatus(o.id,'waiting_payment')}><Icon name="arrowLeft" size={11} style={{ marginRight: 3 }} />Back</button>
                            </>}
                            {o.status === 'done' &&
                              <button className="btn btn-ghost btn-xs" onClick={() => handleStatus(o.id,'waiting')}><Icon name="arrowLeft" size={11} style={{ marginRight: 3 }} />Reset</button>
                            }
                            <button className="btn btn-ghost btn-xs" onClick={() => openOrderDetail(o.id)}>View</button>
                            <button className="btn btn-danger btn-xs" onClick={() => handleDelete(o.id)}><Icon name="trash" size={11} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        }
      </div>
    </>
  );
}
