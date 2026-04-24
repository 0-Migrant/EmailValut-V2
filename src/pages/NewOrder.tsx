import { useState } from 'react';
import Icon from '@/components/Icon';
import { useNavigate } from 'react-router-dom';
import { useVaultStore } from '@/lib/store';
import { useModal } from '@/context/ModalContext';
import { fmt, isLoyaltyMilestone } from '@/lib/utils';
import type { OrderItem } from '@/lib/types';

export default function NewOrder() {
  const navigate        = useNavigate();
  const { showLoyalty } = useModal();
  const storeItems    = useVaultStore((s) => s.items);
  const deliveryMen   = useVaultStore((s) => s.deliveryMen);
  const orders        = useVaultStore((s) => s.orders);
  const bundles       = useVaultStore((s) => s.bundles);
  const credentials   = useVaultStore((s) => s.credentials);
  const addOrder      = useVaultStore((s) => s.addOrder);
  const consumeStock  = useVaultStore((s) => s.consumeStock);
  const settings      = useVaultStore((s) => s.settings);

  const [dmId,           setDmId]           = useState('');
  const [customerId,     setCustomerId]     = useState('');
  const [orderItems,     setOrderItems]     = useState<OrderItem[]>([]);
  const [customPrice,    setCustomPrice]    = useState('');
  const [discountPctStr, setDiscountPctStr] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [source,          setSource]          = useState('');

  // Selected credential IDs for resource accounts
  const [selectedCredIds, setSelectedCredIds] = useState<Set<string>>(new Set());
  const [credSearch, setCredSearch] = useState('');

  // Derived totals
  const itemsTotal = orderItems.reduce((a, oi) => a + oi.price * oi.qty, 0);
  const cp  = customPrice !== '' ? parseFloat(customPrice) : NaN;
  const dp  = discountPctStr !== '' ? parseFloat(discountPctStr) : NaN;
  const cpActive = !isNaN(cp) && cp >= 0;
  const dpActive = !cpActive && !isNaN(dp) && dp > 0 && dp <= 100;
  const finalTotal = cpActive ? cp : dpActive ? itemsTotal * (1 - dp / 100) : itemsTotal;

  const showDiscount  = cpActive && itemsTotal > 0 && cp < itemsTotal;
  const showSurcharge = cpActive && itemsTotal > 0 && cp > itemsTotal;
  const discountPct   = showDiscount  ? ((itemsTotal - cp) / itemsTotal * 100).toFixed(1) : '';
  const surchargePct  = showSurcharge ? ((cp - itemsTotal) / itemsTotal * 100).toFixed(1) : '';

  function addItem(itemId: string) {
    if (!itemId) return;
    const item = storeItems.find((i) => i.id === itemId);
    if (!item) return;
    setOrderItems((prev) => {
      const ex = prev.find((oi) => oi.itemId === itemId && !oi.credentialId);
      return ex
        ? prev.map((oi) => oi.itemId === itemId && !oi.credentialId ? { ...oi, qty: oi.qty + 1 } : oi)
        : [...prev, { itemId, qty: 1, price: item.price }];
    });
  }

  function changeQty(itemId: string, val: string, credentialId?: string) {
    const qty = val === '' ? 0 : Math.max(0, parseInt(val) || 0);
    setOrderItems((prev) =>
      prev.map((oi) =>
        oi.itemId === itemId && oi.credentialId === credentialId ? { ...oi, qty } : oi
      )
    );
  }

  function removeItem(itemId: string, credentialId?: string) {
    setOrderItems((prev) =>
      prev.filter((oi) => !(oi.itemId === itemId && oi.credentialId === credentialId))
    );
  }

  function addBundleToOrder(bundleId: string) {
    if (!bundleId) return;
    const bundle = bundles.find((b) => b.id === bundleId);
    if (!bundle) return;
    setOrderItems((prev) => {
      let next = [...prev];
      bundle.items.forEach((bi) => {
        const item = storeItems.find((i) => i.id === bi.itemId);
        if (!item) return;
        const ex = next.find((oi) => oi.itemId === bi.itemId && !oi.credentialId);
        if (ex) {
          next = next.map((oi) => oi.itemId === bi.itemId && !oi.credentialId ? { ...oi, qty: oi.qty + bi.qty } : oi);
        } else {
          next = [...next, { itemId: bi.itemId, qty: bi.qty, price: item.price }];
        }
      });
      return next;
    });
  }

  // Toggle a credential account in/out of the selected set
  function toggleCred(credId: string) {
    setSelectedCredIds((prev) => {
      const next = new Set(prev);
      if (next.has(credId)) {
        next.delete(credId);
        // Remove any order items tied to this credential
        setOrderItems((oi) => oi.filter((x) => x.credentialId !== credId));
      } else {
        next.add(credId);
      }
      return next;
    });
  }

  // Add a stock line from a credential as an order item
  function addStockToOrder(credId: string, stockId: string) {
    const cred = credentials.find((c) => c.id === credId);
    const stock = cred?.stocks.find((s) => s.id === stockId);
    if (!stock) return;

    // Find a matching item by name (case-insensitive) for price
    const item = storeItems.find((i) => i.name.toLowerCase() === stock.name.toLowerCase());
    const price = item?.price ?? 0;
    const itemId = item?.id ?? stockId; // fallback to stockId if no item match

    setOrderItems((prev) => {
      const ex = prev.find((oi) => oi.credentialId === credId && oi.stockId === stockId);
      if (ex) return prev; // already added
      return [...prev, { itemId, qty: stock.qty, price, credentialId: credId, stockId }];
    });
  }

  function removeStockFromOrder(credId: string, stockId: string) {
    setOrderItems((prev) => prev.filter((oi) => !(oi.credentialId === credId && oi.stockId === stockId)));
  }

  function isStockInOrder(credId: string, stockId: string) {
    return orderItems.some((oi) => oi.credentialId === credId && oi.stockId === stockId);
  }

  function submit() {
    if (!dmId) { alert('Please select a worker.'); return; }
    const validItems = orderItems.filter((oi) => oi.qty > 0);
    if (!validItems.length) { alert('Please add at least one item with quantity > 0.'); return; }
    const cp2 = customPrice !== '' && !isNaN(parseFloat(customPrice)) ? parseFloat(customPrice) : null;
    const dp2 = discountPctStr !== '' && !isNaN(parseFloat(discountPctStr)) ? parseFloat(discountPctStr) : null;
    // Count BEFORE adding so we can check if this new order hits a milestone
    const prevCount = customerId ? orders.filter((o) => o.customerId === customerId).length : 0;

    const selectedPm = (settings.paymentMethods ?? []).find((m) => m.id === paymentMethodId);
    addOrder({ deliveryManId: dmId, customerId, items: validItems, status: 'waiting', customPrice: cp2, discountPct: dp2, paymentMethod: selectedPm?.label ?? '', paymentDetail: selectedPm?.detail ?? '', source });

    // Decrement stock for every consumed stock item
    validItems.forEach((oi) => {
      if (oi.credentialId && oi.stockId) {
        consumeStock(oi.credentialId, oi.stockId, oi.qty);
      }
    });

    if (customerId) {
      const newCount = prevCount + 1;
      if (isLoyaltyMilestone(newCount)) {
        showLoyalty(customerId, newCount);
      }
    }
    navigate('/orders');
  }

  const cats = [...new Set(storeItems.map((i) => i.category || 'Other'))].sort();

  const filteredCreds = credentials.filter((c) =>
    c.name.toLowerCase().includes(credSearch.toLowerCase()) ||
    c.email.toLowerCase().includes(credSearch.toLowerCase())
  );

  const selectedCreds = credentials.filter((c) => selectedCredIds.has(c.id));

  return (
    <>
      <div className="section-title"><Icon name="newOrder" size={18} style={{ marginRight: 8 }} />New Order</div>
      <div style={{ maxWidth: 720, display:'flex', flexDirection:'column', gap:16 }}>

        {/* Delivery Details */}
        <div className="card">
          <div className="card-title">Delivery Details</div>
          <div className="new-order-fields">
            <div className="field">
              <label>Worker</label>
              <select className="inp" value={dmId} onChange={(e) => setDmId(e.target.value)}>
                <option value="">— Select worker —</option>
                {deliveryMen.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Customer ID <span style={{ fontSize:11, color:'var(--text-hint)' }}>(optional — loyalty tracking)</span></label>
              <input className="inp" value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder="e.g. CUST-001" />
            </div>
            <div className="field">
              <label>Payment Method <span style={{ fontSize:11, color:'var(--text-hint)' }}>(optional)</span></label>
              <select className="inp" value={paymentMethodId} onChange={(e) => setPaymentMethodId(e.target.value)}>
                <option value="">— Select method —</option>
                {(settings.paymentMethods ?? []).map((m) => (
                  <option key={m.id} value={m.id}>{m.label}{m.detail ? ` — ${m.detail}` : ''}</option>
                ))}
              </select>
              {paymentMethodId && (() => { const pm = (settings.paymentMethods ?? []).find((m) => m.id === paymentMethodId); return pm?.detail ? <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 3 }}>{pm.detail}</div> : null; })()}
            </div>
            <div className="field">
              <label>Order Source <span style={{ fontSize:11, color:'var(--text-hint)' }}>(optional)</span></label>
              <select className="inp" value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="">— Select source —</option>
                {(settings.platforms ?? []).map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Resource Accounts */}
        {credentials.length > 0 && !settings.hideResourceAccounts && (
          <div className="card">
            <div className="card-title">Resource Accounts</div>
            <p style={{ fontSize:12, color:'var(--text-hint)', marginBottom:10 }}>
              Select one or more accounts to pull stocks from. Selected stocks are added to the order automatically.
            </p>

            {/* Account search + list */}
            <input
              className="inp"
              style={{ marginBottom:10 }}
              placeholder="Search accounts..."
              value={credSearch}
              onChange={(e) => setCredSearch(e.target.value)}
            />
            <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:180, overflowY:'auto', marginBottom:12 }}>
              {filteredCreds.map((c) => (
                <label key={c.id} style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', padding:'6px 8px', borderRadius:6, background: selectedCredIds.has(c.id) ? 'var(--accent-bg, rgba(59,130,246,0.08))' : 'transparent', border: selectedCredIds.has(c.id) ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
                  <input
                    type="checkbox"
                    checked={selectedCredIds.has(c.id)}
                    onChange={() => toggleCred(c.id)}
                  />
                  <span style={{ fontWeight:600, fontSize:13 }}>{c.name}</span>
                  <span style={{ fontSize:12, color:'var(--text-hint)' }}>{c.email}</span>
                  {c.stocks.length > 0 && (
                    <span className="tag" style={{ marginLeft:'auto' }}>{c.stocks.length} stock{c.stocks.length !== 1 ? 's' : ''}</span>
                  )}
                </label>
              ))}
              {!filteredCreds.length && (
                <div style={{ fontSize:13, color:'var(--text-hint)', padding:'8px 0' }}>No accounts match.</div>
              )}
            </div>

            {/* Stocks for selected accounts */}
            {selectedCreds.map((cred) => (
              <div key={cred.id} style={{ marginBottom:12, border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
                <div style={{ padding:'8px 12px', background:'var(--surface-alt, var(--surface))', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontWeight:700, fontSize:13 }}>{cred.name}</span>
                  <span style={{ fontSize:12, color:'var(--text-hint)' }}>{cred.email}</span>
                </div>
                {!cred.stocks.length ? (
                  <div style={{ padding:'10px 12px', fontSize:13, color:'var(--text-hint)' }}>No stocks on this account.</div>
                ) : (
                  <div style={{ padding:'8px 12px', display:'flex', flexDirection:'column', gap:6 }}>
                    {cred.stocks.map((s) => {
                      const inOrder = isStockInOrder(cred.id, s.id);
                      const oi = orderItems.find((x) => x.credentialId === cred.id && x.stockId === s.id);
                      const matchedItem = storeItems.find((i) => i.name.toLowerCase() === s.name.toLowerCase());
                      return (
                        <div key={s.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 0' }}>
                          <input
                            type="checkbox"
                            checked={inOrder}
                            onChange={() => inOrder ? removeStockFromOrder(cred.id, s.id) : addStockToOrder(cred.id, s.id)}
                          />
                          <span style={{ flex:1, fontSize:13, fontWeight:500 }}>{s.name}</span>
                          <span style={{ fontSize:12, color:'var(--text-hint)' }}>avail: {s.qty}</span>
                          {matchedItem && <span style={{ fontSize:12, color:'var(--accent)' }}>{fmt(matchedItem.price)} $</span>}
                          {!matchedItem && <span style={{ fontSize:11, color:'var(--text-hint)', fontStyle:'italic' }}>no price match</span>}
                          {inOrder && oi && (
                            <input
                              className="inp"
                              type="number"
                              min={0}
                              max={s.qty}
                              value={oi.qty || ''}
                              style={{ width:60, height:28, fontSize:12 }}
                              onChange={(e) => changeQty(oi.itemId, e.target.value, cred.id)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Order Items */}
        <div className="card">
          <div className="card-title">Order Items</div>

          <div className="order-items-list">
            {!orderItems.length
              ? <div style={{ fontSize:13, color:'var(--text-hint)', textAlign:'center', padding:16 }}>Use the dropdown or select accounts above to add items.</div>
              : orderItems.map((oi) => {
                  const item = storeItems.find((i) => i.id === oi.itemId);
                  const cred = oi.credentialId ? credentials.find((c) => c.id === oi.credentialId) : null;
                  const stock = oi.stockId && cred ? cred.stocks.find((s) => s.id === oi.stockId) : null;
                  return (
                    <div key={`${oi.itemId}-${oi.credentialId ?? ''}`} className="order-item-row">
                      <div className="item-label">
                        <div>{stock ? stock.name : (item?.name ?? '?')}</div>
                        {cred && <div style={{ fontSize:11, color:'var(--text-hint)' }}>📧 {cred.email}</div>}
                      </div>
                      <input className="inp" type="number" min={0} value={oi.qty || ''}
                        style={{ height:28, fontSize:12 }}
                        onChange={(e) => changeQty(oi.itemId, e.target.value, oi.credentialId)} />
                      <div>
                        <div style={{ fontSize:10, color:'var(--text-hint)' }}>@ {fmt(oi.price)}</div>
                        <div className="item-subtotal">{fmt(oi.price * oi.qty)} $ USD</div>
                      </div>
                      <button className="btn btn-danger btn-xs btn-icon" onClick={() => removeItem(oi.itemId, oi.credentialId)}>✕</button>
                    </div>
                  );
                })
            }
          </div>

          <div style={{ marginBottom: 8 }}>
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

          {bundles.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <select className="inp" style={{ width:'100%' }} value="" onChange={(e) => { addBundleToOrder(e.target.value); e.target.value=''; }}>
                <option value="">📦 Add bundle to order...</option>
                {bundles.map((b) => (
                  <option key={b.id} value={b.id}>{b.name} ({b.items.length} items)</option>
                ))}
              </select>
            </div>
          )}

          <hr className="divider" />

          {/* Totals */}
          <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 0' }}>
            <span style={{ fontSize:13, color:'var(--text-muted)' }}>Items Total</span>
            <span style={{ fontSize:15, fontWeight:600 }}>{fmt(itemsTotal)} $ USD</span>
          </div>

          <div style={{ display:'flex', gap:10, margin:'10px 0' }}>
            <div className="field" style={{ flex:1 }}>
              <label>Custom Price <span style={{ fontSize:11, color:'var(--text-hint)' }}>(overrides total)</span></label>
              <input className="inp" type="number" min={0} step={0.01} placeholder="0.00"
                value={customPrice} onChange={(e) => { setCustomPrice(e.target.value); if (e.target.value) setDiscountPctStr(''); }} />
            </div>
            <div className="field" style={{ flex:1 }}>
              <label>Discount % <span style={{ fontSize:11, color:'var(--text-hint)' }}>(applied on subtotal)</span></label>
              <input className="inp" type="number" min={0} max={100} step={0.1} placeholder="0"
                value={discountPctStr} onChange={(e) => { setDiscountPctStr(e.target.value); if (e.target.value) setCustomPrice(''); }} />
            </div>
          </div>

          {dpActive && (
            <div style={{ background:'var(--green-bg)', border:'1px solid var(--green-border)', borderRadius:8, padding:10, marginBottom:8 }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontSize:13, color:'var(--green)', fontWeight:600 }}>🏷 Discount Applied</span>
                <span style={{ fontSize:13, fontWeight:700, color:'var(--green)' }}>-{dp.toFixed(1)}%</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:6, fontSize:12, color:'var(--text-muted)' }}>
                <span>Customer saves:</span>
                <span style={{ fontWeight:600, color:'var(--green)' }}>{fmt(itemsTotal - finalTotal)} $ USD</span>
              </div>
            </div>
          )}

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
