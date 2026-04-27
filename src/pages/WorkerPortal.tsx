import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useVaultStore } from '@/lib/store';
import { statusLabel, statusBadgeClass, fmt, fmtDateTime, orderTotal } from '@/lib/utils';
import type { WorkerStatus, OrderStatus } from '@/lib/types';
import Icon from '@/components/Icon';
import StatusPicker from '@/components/StatusPicker';

const ORDER_STATUSES: { value: OrderStatus; label: string }[] = [
  { value: 'waiting',          label: 'Waiting' },
  { value: 'accepted',         label: 'Accepted' },
  { value: 'delivering',       label: 'Delivering' },
  { value: 'delivered',        label: 'Delivered' },
  { value: 'waiting_payment',  label: 'Waiting for Payment' },
  { value: 'payment_complete', label: 'Payment Complete' },
  { value: 'done',             label: 'Done' },
];

export default function WorkerPortal() {
  const { session, logout } = useAuth();
  const deliveryMen     = useVaultStore((s) => s.deliveryMen);
  const orders          = useVaultStore((s) => s.orders);
  const items           = useVaultStore((s) => s.items);
  const setWorkerStatus = useVaultStore((s) => s.setWorkerStatus);
  const setOrderStatus  = useVaultStore((s) => s.setOrderStatus);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const workerId = session?.type === 'worker' ? session.workerId : null;
  const worker   = deliveryMen.find((d) => d.id === workerId);

  if (!worker || worker.frozen) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-page)',
      }}>
        <div className="card" style={{ width: 360, padding: 36, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Account Frozen</div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24 }}>
            Your account has been frozen by the admin. Please contact the admin to restore access.
          </div>
          <button className="btn btn-ghost" onClick={logout}>Sign Out</button>
        </div>
      </div>
    );
  }

  const myOrders     = orders.filter((o) => o.deliveryManId === worker.id);
  const activeOrders = myOrders.filter((o) => !['done', 'delivered'].includes(o.status));
  const doneOrders   = myOrders.filter((o) => o.status === 'done');

  const workerStatus: WorkerStatus = worker.status ?? 'offline';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{
        maxWidth: 820, margin: '0 auto 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="workers" size={22} />
          <span style={{ fontWeight: 700, fontSize: 18 }}>Worker Portal</span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={logout}>Sign Out</button>
      </div>

      <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Status Card */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 4 }}>{worker.name}</div>
          <div style={{ marginBottom: 4 }}>
            <StatusPicker
              value={workerStatus}
              onChange={(s) => setWorkerStatus(worker.id, s)}
            />
          </div>
        </div>

        {/* Active Orders */}
        <div className="card">
          <div className="card-title">
            My Orders
            <span className="badge badge-info" style={{ marginLeft: 8, fontSize: 12 }}>
              {myOrders.length} total
            </span>
          </div>

          {activeOrders.length === 0 ? (
            <div className="empty-state" style={{ padding: '20px 0' }}>
              <div className="empty-icon"><Icon name="orders" size={28} /></div>
              No active orders assigned to you.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activeOrders.map((o) => {
                const isOpen = expanded.has(o.id);
                return (
                  <div
                    key={o.id}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      overflow: 'hidden',
                      background: 'var(--bg-card)',
                    }}
                  >
                    {/* Order header row */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 14px',
                      flexWrap: 'wrap',
                    }}>
                      {/* Expand toggle */}
                      <button
                        onClick={() => toggleExpand(o.id)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--text-hint)', padding: 0, fontSize: 13,
                          display: 'flex', alignItems: 'center', gap: 4,
                          flexShrink: 0,
                        }}
                        title={isOpen ? 'Hide items' : 'Show items'}
                      >
                        <span style={{
                          display: 'inline-block',
                          transition: 'transform .15s',
                          transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                          fontSize: 10,
                        }}>▶</span>
                      </button>

                      <span style={{ fontWeight: 600, fontSize: 12, fontFamily: 'monospace', minWidth: 80 }}>
                        #{o.id.slice(-6).toUpperCase()}
                      </span>

                      <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1, minWidth: 100 }}>
                        {fmtDateTime(o.createdAt)}
                      </span>

                      <span style={{ fontWeight: 700, color: 'var(--green)', fontSize: 13, minWidth: 70, textAlign: 'right' }}>
                        {fmt(orderTotal(o))} $
                      </span>

                      <span className={`badge ${statusBadgeClass(o.status)}`}>
                        {statusLabel(o.status)}
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                        {o.status === 'accepted' && (
                          <button
                            className="btn btn-success btn-xs"
                            onClick={() => setOrderStatus(o.id, 'delivering')}
                          >
                            <Icon name="check" size={11} style={{ marginRight: 3 }} />
                            Delivering
                          </button>
                        )}
                        <select
                          className="inp inp-sm"
                          style={{ fontSize: 12, width: 'auto' }}
                          value={o.status}
                          onChange={(e) => setOrderStatus(o.id, e.target.value as OrderStatus)}
                        >
                          {ORDER_STATUSES.map((st) => (
                            <option key={st.value} value={st.value}>{st.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Expandable items */}
                    {isOpen && (
                      <div style={{
                        borderTop: '1px solid var(--border)',
                        background: 'var(--bg-subtle)',
                        padding: '10px 14px',
                      }}>
                        <div style={{
                          fontSize: 10, fontWeight: 700, color: 'var(--text-hint)',
                          textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8,
                        }}>
                          Items
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {o.items.map((oi, idx) => {
                            const item = items.find((i) => i.id === oi.itemId);
                            return (
                              <div
                                key={idx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 10,
                                  fontSize: 13,
                                }}
                              >
                                <span style={{
                                  background: 'var(--accent)',
                                  color: '#fff',
                                  borderRadius: 5,
                                  padding: '1px 7px',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  minWidth: 24,
                                  textAlign: 'center',
                                }}>
                                  ×{oi.qty}
                                </span>
                                <span style={{ flex: 1, fontWeight: 500 }}>
                                  {item?.name ?? `Item #${oi.itemId.slice(-4)}`}
                                </span>
                                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                                  {fmt(oi.price)} $ each
                                </span>
                                <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 12 }}>
                                  {fmt(oi.price * oi.qty)} $
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        {o.customerId && (
                          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                            Customer: <strong style={{ color: 'var(--text-main)' }}>{o.customerId}</strong>
                          </div>
                        )}
                        {o.paymentMethod && (
                          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                            Payment: <strong style={{ color: 'var(--text-main)' }}>{o.paymentMethod}</strong>
                            {o.paymentDetail && <span style={{ color: 'var(--text-hint)' }}> — {o.paymentDetail}</span>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Completed summary */}
        {doneOrders.length > 0 && (
          <div className="card">
            <div className="card-title">Completed Orders</div>
            <div style={{ display: 'flex', gap: 24 }}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Total Done</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{doneOrders.length}</div>
              </div>
              <div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Revenue</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--green)' }}>
                  {fmt(doneOrders.reduce((a, o) => a + orderTotal(o), 0))} $
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
