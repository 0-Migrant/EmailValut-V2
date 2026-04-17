import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVaultStore } from '@/lib/store';
import { useModal } from '@/context/ModalContext';
import { fmt, isLoyaltyMilestone } from '@/lib/utils';
import type { OrderItem } from '@/lib/types';

export default function NewOrder() {
  const navigate      = useNavigate();
  const { showLoyalty } = useModal();
  const storeItems  = useVaultStore((s) => s.items);
  const deliveryMen = useVaultStore((s) => s.deliveryMen);
  const orders      = useVaultStore((s) => s.orders);
  const addOrder    = useVaultStore((s) => s.addOrder);

  const [dmId,        setDmId]        = useState('');
  const [customerId,  setCustomerId]  = useState('');
  const [orderItems,  setOrderItems]  = useState<OrderItem[]>([]);
  const [customPrice, setCustomPrice] = useState('');

  // Derived totals
  const itemsTotal = orderItems.reduce((a, oi) => a + oi.price * oi.qty, 0);
  const cp = customPrice !== '' ? parseFloat(customPrice) : NaN;
  const finalTotal = !isNaN(cp) && cp >= 0 ? cp : itemsTotal;

  const showDiscount  = !isNaN(cp) && cp >= 0 && itemsTotal > 0 && cp < itemsTotal;
  const showSurcharge = !isNaN(cp) && cp >= 0 && itemsTotal > 0 && cp > itemsTotal;
  const discountPct   = showDiscount  ? ((itemsTotal - cp) / itemsTotal * 100).toFixed(1) : '';
  const surchargePct  = showSurcharge ? ((cp - itemsTotal) / itemsTotal * 100).toFixed(1) : '';

  function addItem(itemId: string) {
    if (!itemId) return;
    const item = storeItems.find((i) => i.id === itemId);
    if (!item) return;
    setOrderItems((prev) => {
      const ex = prev.find((oi) => oi.itemId === itemId);
      return ex
        ? prev.map((oi) => oi.itemId === itemId ? { ...oi, qty: oi.qty + 1 } : oi)
        : [...prev, { itemId, qty: 0, price: item.price }];
    });
  }

  function changeQty(itemId: string, val: string) {
    const qty = val === '' ? 0 : Math.max(0, parseInt(val) || 0);
    setOrderItems((prev) => prev.map((oi) => oi.itemId === itemId ? { ...oi, qty } : oi));
  }

  function removeItem(itemId: string) {
    setOrderItems((prev) => prev.filter((oi) => oi.itemId !== itemId));
  }

  function submit() {
    if (!dmId) { alert('Please select a delivery man.'); return; }
    const validItems = orderItems.filter((oi) => oi.qty > 0);
    if (!validItems.length) { alert('Please add at least one item with quantity > 0.'); return; }
    const cp2 = customPrice !== '' && !isNaN(parseFloat(customPrice)) ? parseFloat(customPrice) : null;
    addOrder({ deliveryManId: dmId, customerId, items: validItems, status: 'waiting', customPrice: cp2 });
    if (customerId) {
      const prevCount = orders.filter((o) => o.customerId === customerId).length; // after add, length is +1
      if (isLoyaltyMilestone(prevCount)) {
        showLoyalty(customerId, prevCount);
      }
    }
    navigate('/orders');
  }

  const cats = [...new Set(storeItems.map((i) => i.category || 'Other'))].sort();

  return (
    <>
      <div className="section-title">➕ New Order</div>
      <div style={{ maxWidth: 720, display:'flex', flexDirection:'column', gap:16 }}>

        {/* Delivery Details */}
        <div className="card">
          <div className="card-title">Delivery Details</div>
          <div className="new-order-fields">
            <div className="field">
              <label>Delivery Man</label>
              <select className="inp" value={dmId} onChange={(e) => setDmId(e.target.value)}>
                <option value="">— Select delivery man —</option>
                {deliveryMen.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Customer ID <span style={{ fontSize:11, color:'var(--text-hint)' }}>(optional — loyalty tracking)</span></label>
              <input className="inp" value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder="e.g. CUST-001" />
            </div>
          </div>
        </div>

        {/* Order Items */}
        <div className="card">
          <div className="card-title">Order Items</div>

          <div className="order-items-list">
            {!orderItems.length
              ? <div style={{ fontSize:13, color:'var(--text-hint)', textAlign:'center', padding:16 }}>Use the dropdown to add items.</div>
              : orderItems.map((oi) => {
                  const item = storeItems.find((i) => i.id === oi.itemId);
                  return (
                    <div key={oi.itemId} className="order-item-row">
                      <div className="item-label">{item?.name ?? '?'}</div>
                      <input className="inp" type="number" min={0} value={oi.qty || ''}
                        style={{ height:28, fontSize:12 }}
                        onChange={(e) => changeQty(oi.itemId, e.target.value)} />
                      <div>
                        <div style={{ fontSize:10, color:'var(--text-hint)' }}>@ {fmt(oi.price)}</div>
                        <div className="item-subtotal">{fmt(oi.price * oi.qty)} $ USD</div>
                      </div>
                      <button className="btn btn-danger btn-xs btn-icon" onClick={() => removeItem(oi.itemId)}>✕</button>
                    </div>
                  );
                })
            }
          </div>

          <div style={{ marginBottom:12 }}>
            <select className="inp" style={{ width:'100%' }} value="" onChange={(e) => { addItem(e.target.value); e.target.value=''; }}>
              <option value="">+ Add item to order...</option>
              {cats.map((cat) => (
                <optgroup key={cat} label={cat}>
                  {storeItems.filter((it) => (it.category || 'Other') === cat).map((it) => (
                    <option key={it.id} value={it.id}>{it.name} — {fmt(it.price)} $ USD</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <hr className="divider" />

          {/* Totals */}
          <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 0' }}>
            <span style={{ fontSize:13, color:'var(--text-muted)' }}>Items Total</span>
            <span style={{ fontSize:15, fontWeight:600 }}>{fmt(itemsTotal)} $ USD</span>
          </div>

          <div className="field" style={{ margin:'10px 0' }}>
            <label>Custom Price <span style={{ fontSize:11, color:'var(--text-hint)' }}>(optional — overrides items total)</span></label>
            <input className="inp" type="number" min={0} step={0.01} placeholder="0.00"
              value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} />
          </div>

          {showDiscount && (
            <div style={{ background:'var(--green-bg)', border:'1px solid var(--green-border)', borderRadius:8, padding:10, marginBottom:8 }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontSize:13, color:'var(--green)', fontWeight:600 }}>🏷 Discount Applied</span>
                <span style={{ fontSize:13, fontWeight:700, color:'var(--green)' }}>-{discountPct}%</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:6, fontSize:12, color:'var(--text-muted)' }}>
                <span>Customer saves:</span>
                <span style={{ fontWeight:600, color:'var(--green)' }}>{fmt(itemsTotal - cp)} $ USD</span>
              </div>
            </div>
          )}

          {showSurcharge && (
            <div style={{ background:'var(--orange-bg)', border:'1px solid var(--orange-border)', borderRadius:8, padding:10, marginBottom:8 }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontSize:13, color:'var(--orange)', fontWeight:600 }}>📈 Custom Price (Above Items Total)</span>
                <span style={{ fontSize:13, fontWeight:700, color:'var(--orange)' }}>+{surchargePct}%</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:6, fontSize:12, color:'var(--text-muted)' }}>
                <span>Extra above items:</span>
                <span style={{ fontWeight:600, color:'var(--orange)' }}>{fmt(cp - itemsTotal)} $ USD</span>
              </div>
            </div>
          )}

          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:4 }}>
            <span style={{ fontSize:14, fontWeight:600, color:'var(--text-muted)' }}>Order Total</span>
            <span style={{ fontSize:20, fontWeight:700, color:'var(--accent)' }}>{fmt(finalTotal)} $ USD</span>
          </div>

          <button className="btn btn-primary" style={{ width:'100%', marginTop:14, height:42, fontSize:15 }} onClick={submit}>
            🚀 Place Order
          </button>
        </div>
      </div>
    </>
  );
}
