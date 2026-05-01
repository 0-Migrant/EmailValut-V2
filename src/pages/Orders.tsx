import { useState } from 'react';
import { useVaultStore } from '@/lib/store';
import { useModal } from '@/context/ModalContext';
import { fmt, fmtDateTime, orderTotal, getPriceInfo, calcFee, statusBadgeClass, statusLabel, getLoyaltyTier } from '@/lib/utils';
import type { OrderStatus } from '@/lib/types';
import Icon from '@/components/Icon';
import SelectDropdown from '@/components/SelectDropdown';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all',             label: 'All Orders' },
  { value: 'waiting',         label: 'Waiting' },
  { value: 'accepted',        label: 'Accepted' },
  { value: 'delivering',      label: 'Delivering' },
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

  const [search, setSearch]           = useState('');
  const [filter, setFilter]           = useState('all');
  const [dmFilter, setDmFilter]       = useState('');
  const [editingPm, setEditingPm]   = useState<string | null>(null);
  const [pricePopup, setPricePopup] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState('');

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

  function savePrice() {
    if (!pricePopup) return;
    const val = parseFloat(priceInput);
    if (!isNaN(val) && val >= 0) updateOrder(pricePopup, { customPrice: val });
    setPricePopup(null);
  }

  function openPricePopup(o: typeof filtered[number]) {
    setPricePopup(o.id);
    setPriceInput(String(orderTotal(o)));
  }

  const pricePopupOrder = pricePopup ? filtered.find((o) => o.id === pricePopup) ?? orders.find((o) => o.id === pricePopup) : null;

  return (
    <>
      <div className="section-title"><Icon name="orders" size={18} style={{ marginRight: 8 }} />Manage Orders</div>

      <div className="filter-bar orders-filter-bar">
        <input className="search-box" placeholder="Search by customer, worker..."
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <SelectDropdown
          value={filter}
          onChange={setFilter}
          options={STATUS_OPTIONS}
          style={{ width: 160 }}
        />
        <SelectDropdown
          value={dmFilter}
          onChange={setDmFilter}
          placeholder="All Workers"
          options={deliveryMen.map((d) => ({ value: d.id, label: d.name }))}
          style={{ width: 160 }}
        />
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
                    const clientOrderCount = o.customerId
                      ? orders.filter((x) => x.customerId === o.customerId).length
                      : 0;
                    const tier = o.customerId ? getLoyaltyTier(clientOrderCount) : null;
                    return (
                      <tr key={o.id}>
                        <td><span className="tag">{o.id.slice(-5)}</span></td>
                        <td style={{ fontSize:12 }}>
                          {o.customerId
                            ? <span style={{ display:'flex', alignItems:'center', gap:5 }}>
                                <span title={`${tier!.label} — ${clientOrderCount} orders`}>{tier!.emoji}</span>
                                <span style={{ color:'var(--text-muted)' }}>{o.customerId}</span>
                              </span>
                            : <span style={{ color:'var(--text-hint)' }}>—</span>
                          }
                        </td>
                        <td style={{ fontWeight:500 }}>{dm?.name ?? 'Unknown'}</td>
                        <td style={{ color:'var(--text-muted)', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {o.items.map((oi) => items.find((i) => i.id === oi.itemId)?.name ?? '?').join(', ')}
                        </td>
                        <td>
                          {o.customPrice != null && (
                            <div style={{ fontSize:10, color:'var(--text-hint)', textDecoration:'line-through' }}>{fmt(info.itemsTotal)} $</div>
                          )}
                          <span
                            style={{ fontWeight:700, color:'var(--accent)', fontSize:13, cursor:'pointer' }}
                            onClick={() => openPricePopup(o)}
                          >
                            {fmt(orderTotal(o))} $
                          </span>
                          {(() => {
                            const fee = calcFee(o, settings.paymentMethodFees ?? []);
                            if (!fee) return null;
                            return (
                              <div style={{ fontSize:10, color:'var(--text-hint)', marginTop:2 }}>
                                -{fmt(fee)} fee → <strong style={{ color:'var(--text-muted)' }}>{fmt(orderTotal(o) - fee)} $</strong>
                              </div>
                            );
                          })()}
                        </td>
                        <td>
                          {editingPm === o.id
                            ? (
                              <SelectDropdown
                                size="sm"
                                autoFocus
                                value={o.paymentMethod}
                                onChange={(val) => {
                                  const pm = (settings.paymentMethods ?? []).find((m) => m.label === val);
                                  updateOrder(o.id, { paymentMethod: pm?.label ?? val, paymentDetail: pm?.detail ?? '' });
                                  setEditingPm(null);
                                }}
                                onBlur={() => setEditingPm(null)}
                                options={(settings.paymentMethods ?? []).map((m) => ({ value: m.label, label: m.label }))}
                              />
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

      {/* Price edit popup */}
      {pricePopup && pricePopupOrder && (
        <div className="modal-bg" onClick={() => setPricePopup(null)}>
          <div className="modal" style={{ width:360 }} onClick={(e) => e.stopPropagation()}>
            <h3>Edit Order Price</h3>
            <p>Order #{pricePopupOrder.id.slice(-5)} &nbsp;·&nbsp; Items total: <strong>{fmt(pricePopupOrder.items.reduce((a, oi) => a + oi.price * oi.qty, 0))} $</strong></p>
            <label style={{ fontSize:12, color:'var(--text-hint)', fontWeight:600, display:'block', marginBottom:6 }}>Custom Price ($)</label>
            <input
              type="number"
              className="inp"
              style={{ width:'100%', marginBottom:20 }}
              autoFocus
              min={0}
              step={0.01}
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') savePrice(); if (e.key === 'Escape') setPricePopup(null); }}
            />
            <div className="modal-actions">
              {pricePopupOrder.customPrice != null && (
                <button className="btn btn-ghost btn-sm" onClick={() => { updateOrder(pricePopup, { customPrice: null }); setPricePopup(null); }}>
                  Reset to Default
                </button>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => setPricePopup(null)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={savePrice}>Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
