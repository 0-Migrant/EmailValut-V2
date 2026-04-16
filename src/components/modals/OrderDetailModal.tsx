import { useModal } from '@/context/ModalContext';
import { useVaultStore } from '@/lib/store';
import { fmt, fmtDateTime, orderTotal, orderItemsTotal, getPriceInfo, statusBadgeClass } from '@/lib/utils';
import { generateOrderPDF } from '@/lib/pdf';

export default function OrderDetailModal() {
  const { viewOrderId, closeOrderDetail } = useModal();
  const orders      = useVaultStore((s) => s.orders);
  const deliveryMen = useVaultStore((s) => s.deliveryMen);
  const items       = useVaultStore((s) => s.items);
  const setStatus   = useVaultStore((s) => s.setOrderStatus);

  if (!viewOrderId) return null;
  const order = orders.find((o) => o.id === viewOrderId);
  if (!order) return null;

  const dm   = deliveryMen.find((d) => d.id === order.deliveryManId);
  const info = getPriceInfo(order);

  function handleStatus(status: 'pending' | 'done' | 'cancelled' | 'waiting') {
    setStatus(order!.id, status);
    closeOrderDetail();
  }

  return (
    <div className="modal-bg" onClick={closeOrderDetail}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginBottom: 4 }}>Order #{order.id.slice(-5)}</h3>
        <p style={{ marginBottom: 14, color: 'var(--text-muted)', fontSize: 13 }}>
          {fmtDateTime(order.createdAt)}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-hint)', marginBottom: 4 }}>Delivery Man</div>
            <div style={{ fontWeight: 600 }}>{dm?.name ?? 'Unknown'}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-hint)', marginBottom: 4 }}>Customer ID</div>
            <div style={{ fontWeight: 600 }}>{order.customerId || '—'}</div>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--text-hint)', marginBottom: 6 }}>Items</div>
          {order.items.map((oi) => {
            const it = items.find((i) => i.id === oi.itemId);
            return (
              <div key={oi.itemId} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '7px 0', borderBottom: '1px solid var(--border-row)',
              }}>
                <span>{it?.name ?? '?'} × {oi.qty}</span>
                <span style={{ fontWeight: 600 }}>{fmt(oi.price * oi.qty)} $ USD</span>
              </div>
            );
          })}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13, color: 'var(--text-muted)' }}>
            <span>Items Total</span><span>{fmt(orderItemsTotal(order))} $ USD</span>
          </div>
          {info.type === 'discount' && (
            <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green-border)', borderRadius: 8, padding: 10, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--green)', fontWeight: 600, fontSize: 13 }}>🏷 Discount</span>
                <span style={{ color: 'var(--green)', fontWeight: 700 }}>-{info.pct}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                <span>Customer saves:</span>
                <span style={{ color: 'var(--green)', fontWeight: 600 }}>{fmt(info.saved)} $ USD</span>
              </div>
            </div>
          )}
          {info.type === 'surcharge' && (
            <div style={{ background: 'var(--orange-bg)', border: '1px solid var(--orange-border)', borderRadius: 8, padding: 10, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--orange)', fontWeight: 600, fontSize: 13 }}>📈 Custom Price</span>
                <span style={{ color: 'var(--orange)', fontWeight: 700 }}>+{info.pct}%</span>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontWeight: 700, fontSize: 15 }}>
            <span>Total</span>
            <span style={{ color: 'var(--accent)' }}>{fmt(orderTotal(order))} $ USD</span>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <span className={`badge ${statusBadgeClass(order.status)}`}>{order.status}</span>
        </div>

        <div className="modal-actions">
          <button className="btn btn-primary btn-sm" onClick={() => generateOrderPDF(order!, items, dm)}>
            📥 Download PDF
          </button>
          {order.status === 'waiting' && <>
            <button className="btn btn-success btn-sm" onClick={() => handleStatus('pending')}>✓ Accept</button>
            <button className="btn btn-danger btn-sm" onClick={() => handleStatus('cancelled')}>✗ Cancel</button>
          </>}
          {order.status === 'pending' && <>
            <button className="btn btn-success btn-sm" onClick={() => handleStatus('done')}>✓ Mark Done</button>
            <button className="btn btn-danger btn-sm" onClick={() => handleStatus('cancelled')}>✗ Cancel</button>
          </>}
          <button className="btn btn-ghost btn-sm" onClick={closeOrderDetail}>Close</button>
        </div>
      </div>
    </div>
  );
}
