import { useState } from 'react';
import { useModal } from '@/context/ModalContext';
import { useVaultStore } from '@/lib/store';
import { fmt, fmtDateTime, orderTotal, orderItemsTotal, getPriceInfo, statusBadgeClass, statusLabel } from '@/lib/utils';
import { generateOrderPDF, generateVIPOrderPDF } from '@/lib/pdf';
import Icon from '@/components/Icon';


export default function OrderDetailModal() {
  const { viewOrderId, closeOrderDetail } = useModal();
  const orders      = useVaultStore((s) => s.orders);
  const deliveryMen = useVaultStore((s) => s.deliveryMen);
  const items       = useVaultStore((s) => s.items);
  const setStatus     = useVaultStore((s) => s.setOrderStatus);
  const updateOrder   = useVaultStore((s) => s.updateOrder);
  const settings      = useVaultStore((s) => s.settings);
  const [showUnitPrice,  setShowUnitPrice]  = useState(false);
  const [showDiscount,   setShowDiscount]   = useState(true);
  const [editingSource,  setEditingSource]  = useState(false);
  const [pdfTemplate,    setPdfTemplate]    = useState<'standard' | 'vip'>('standard');
  const [vipImage,       setVipImage]       = useState<string | null>(null);

  function handleVipImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setVipImage(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleDownloadPDF() {
    if (pdfTemplate === 'vip') {
      void generateVIPOrderPDF(order!, items, dm, showUnitPrice, showDiscount, vipImage);
    } else {
      void generateOrderPDF(order!, items, dm, showUnitPrice, showDiscount);
    }
  }

  if (!viewOrderId) return null;
  const order = orders.find((o) => o.id === viewOrderId);
  if (!order) return null;

  const dm   = deliveryMen.find((d) => d.id === order.deliveryManId);
  const info = getPriceInfo(order);

  function handleStatus(status: 'waiting' | 'accepted' | 'delivered' | 'waiting_payment' | 'payment_complete' | 'done') {
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

        <div className="order-info-grid">
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-hint)', marginBottom: 4 }}>Worker</div>
            <div style={{ fontWeight: 600 }}>{dm?.name ?? 'Unknown'}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-hint)', marginBottom: 4 }}>Customer ID</div>
            <div style={{ fontWeight: 600 }}>{order.customerId || '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-hint)', marginBottom: 4 }}>Payment Method</div>
            <div style={{ fontWeight: 600 }}>{order.paymentMethod || '—'}</div>
            {order.paymentDetail && <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 2 }}>{order.paymentDetail}</div>}
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-hint)', marginBottom: 4 }}>Order Source</div>
            {editingSource ? (
              <select
                className="inp"
                defaultValue={order.source}
                autoFocus
                style={{ padding: '2px 6px', fontSize: 13 }}
                onChange={(e) => { updateOrder(order.id, { source: e.target.value }); setEditingSource(false); }}
                onBlur={() => setEditingSource(false)}
              >
                {(settings.platforms ?? []).map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            ) : (
              <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                {order.source || '—'}
                <button className="btn btn-ghost btn-xs" onClick={() => setEditingSource(true)} title="Edit platform"><Icon name="edit" size={11} /></button>
              </div>
            )}
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
          <span className={`badge ${statusBadgeClass(order.status)}`}>{statusLabel(order.status)}</span>
        </div>

        {/* PDF Options */}
        <div style={{ background: 'var(--bg-subtle)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
          {/* Template toggle */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text-hint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Invoice Template</div>
            <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border-inp)', borderRadius: 7, overflow: 'hidden', width: 'fit-content' }}>
              <button
                className={`btn btn-sm ${pdfTemplate === 'standard' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ borderRadius: 0, border: 'none' }}
                onClick={() => setPdfTemplate('standard')}
              >
                <Icon name="pdf" size={12} style={{ marginRight: 4 }} />Standard
              </button>
              <button
                className={`btn btn-sm ${pdfTemplate === 'vip' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ borderRadius: 0, border: 'none', background: pdfTemplate === 'vip' ? 'linear-gradient(135deg,#b48c3c,#d4af5a)' : undefined, borderColor: 'transparent' }}
                onClick={() => setPdfTemplate('vip')}
              >
                ✦ VIP
              </button>
            </div>
          </div>

          {/* VIP image uploader */}
          {pdfTemplate === 'vip' && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-hint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Customer Photo (optional)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {vipImage && (
                  <img src={vipImage} alt="preview" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, border: '2px solid #b48c3c' }} />
                )}
                <label style={{ cursor: 'pointer' }}>
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleVipImageUpload} />
                  <span className="btn btn-ghost btn-sm" style={{ pointerEvents: 'none' }}>
                    <Icon name="plus" size={12} style={{ marginRight: 4 }} />{vipImage ? 'Change Photo' : 'Upload Photo'}
                  </span>
                </label>
                {vipImage && (
                  <button className="btn btn-ghost btn-xs" onClick={() => setVipImage(null)}>
                    <Icon name="x" size={11} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Checkboxes */}
          <div className="pdf-options" style={{ gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={showUnitPrice} onChange={(e) => setShowUnitPrice(e.target.checked)} />
              Show unit price
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={showDiscount} onChange={(e) => setShowDiscount(e.target.checked)} />
              Show discount
            </label>
          </div>
        </div>

        <div className="modal-actions">
          <button
            className="btn btn-sm"
            style={pdfTemplate === 'vip'
              ? { background: 'linear-gradient(135deg,#b48c3c,#d4af5a)', color: '#fff', border: 'none' }
              : { background: 'var(--accent)', color: '#fff', border: 'none' }}
            onClick={handleDownloadPDF}
          >
            <Icon name="download" size={13} style={{ marginRight: 5 }} />
            {pdfTemplate === 'vip' ? '✦ Download VIP Invoice' : 'Download PDF'}
          </button>
          {order.status === 'waiting' && <>
            <button className="btn btn-success btn-sm" onClick={() => handleStatus('accepted')}><Icon name="check" size={13} style={{ marginRight: 4 }} />Accept</button>
          </>}
          {order.status === 'accepted' && <>
            <button className="btn btn-success btn-sm" onClick={() => handleStatus('waiting_payment')}><Icon name="check" size={13} style={{ marginRight: 4 }} />Mark Delivered</button>
            <button className="btn btn-ghost btn-sm"   onClick={() => handleStatus('waiting')}><Icon name="arrowLeft" size={13} style={{ marginRight: 4 }} />Back to Waiting</button>
          </>}
          {order.status === 'delivered' && <>
            <button className="btn btn-success btn-sm" onClick={() => handleStatus('waiting_payment')}><Icon name="check" size={13} style={{ marginRight: 4 }} />Awaiting Payment</button>
            <button className="btn btn-ghost btn-sm"   onClick={() => handleStatus('accepted')}><Icon name="arrowLeft" size={13} style={{ marginRight: 4 }} />Back to Accepted</button>
          </>}
          {order.status === 'waiting_payment' && <>
            <button className="btn btn-success btn-sm" onClick={() => handleStatus('done')}><Icon name="check" size={13} style={{ marginRight: 4 }} />Payment Complete</button>
            <button className="btn btn-ghost btn-sm"   onClick={() => handleStatus('accepted')}><Icon name="arrowLeft" size={13} style={{ marginRight: 4 }} />Back to Accepted</button>
          </>}
          {order.status === 'payment_complete' && <>
            <button className="btn btn-success btn-sm" onClick={() => handleStatus('done')}><Icon name="check" size={13} style={{ marginRight: 4 }} />Done</button>
            <button className="btn btn-ghost btn-sm"   onClick={() => handleStatus('waiting_payment')}><Icon name="arrowLeft" size={13} style={{ marginRight: 4 }} />Back to Waiting for Payment</button>
          </>}
          {order.status === 'done' && <>
            <button className="btn btn-ghost btn-sm" onClick={() => handleStatus('waiting')}><Icon name="arrowLeft" size={13} style={{ marginRight: 4 }} />Reset to Beginning</button>
          </>}
          <button className="btn btn-ghost btn-sm" onClick={closeOrderDetail}>Close</button>
        </div>
      </div>
    </div>
  );
}
