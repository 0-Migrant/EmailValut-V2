'use client';
import { useVaultStore } from '@/lib/store';
import { fmt, fmtTime, orderTotal, statusBadgeClass } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();
  const orders      = useVaultStore((s) => s.orders);
  const items       = useVaultStore((s) => s.items);
  const deliveryMen = useVaultStore((s) => s.deliveryMen);
  const credentials = useVaultStore((s) => s.credentials);

  const today       = new Date().toDateString();
  const todayOrders = orders.filter((o) => new Date(o.createdAt).toDateString() === today);
  const doneOrders  = orders.filter((o) => o.status === 'done');
  const pending     = orders.filter((o) => o.status === 'pending' || o.status === 'waiting');
  const weekOrders  = orders.filter((o) => Date.now() - new Date(o.createdAt).getTime() < 7 * 86400000);
  const todayRev    = todayOrders.filter((o) => o.status === 'done').reduce((a, o) => a + orderTotal(o), 0);
  const totalRev    = doneOrders.reduce((a, o) => a + orderTotal(o), 0);

  const itemCounts: Record<string, number> = {};
  doneOrders.forEach((o) => o.items.forEach((oi) => { itemCounts[oi.itemId] = (itemCounts[oi.itemId] || 0) + oi.qty; }));
  const topItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([id, qty]) => ({ item: items.find((i) => i.id === id), qty })).filter((x) => x.item);

  const dmRevenue: Record<string, number> = {};
  doneOrders.forEach((o) => { dmRevenue[o.deliveryManId] = (dmRevenue[o.deliveryManId] || 0) + orderTotal(o); });

  return (
    <>
      <div className="section-title">📊 Dashboard Overview</div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: 'Today Revenue',    value: `${fmt(todayRev)} $ USD`, sub: `${todayOrders.filter(o=>o.status==='done').length} delivered` },
          { label: 'Waiting / Pending',value: pending.length,           sub: 'Awaiting action', color: 'var(--orange)' },
          { label: 'This Week Orders', value: weekOrders.length,        sub: `${weekOrders.filter(o=>o.status==='done').length} completed` },
          { label: 'Total Revenue',    value: `${fmt(totalRev)} $ USD`, sub: 'All time', color: 'var(--green)' },
        ].map((c) => (
          <div key={c.label} className="stat-card">
            <div className="stat-label">{c.label}</div>
            <div className="stat-value" style={c.color ? { color: c.color } : {}}>{c.value}</div>
            <div className="stat-sub">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-title">🏆 Top Selling Items</div>
          {topItems.length ? topItems.map((x) => (
            <div key={x.item!.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--border-row)' }}>
              <span style={{ fontSize:13, fontWeight:500 }}>{x.item!.name}</span>
              <span className="badge badge-info">×{x.qty}</span>
            </div>
          )) : <div className="empty-state" style={{ padding:'20px 0' }}><div className="empty-icon">📦</div>No sales yet</div>}
        </div>
        <div className="card">
          <div className="card-title">🚚 Delivery Performance</div>
          {deliveryMen.length ? deliveryMen.map((dm) => {
            const rev = dmRevenue[dm.id] || 0;
            const cnt = doneOrders.filter((o) => o.deliveryManId === dm.id).length;
            return (
              <div key={dm.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--border-row)' }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:500 }}>{dm.name}</div>
                  <div style={{ fontSize:11, color:'var(--text-hint)' }}>{cnt} deliveries</div>
                </div>
                <span style={{ fontSize:13, fontWeight:700, color:'var(--green)' }}>{fmt(rev)} $ USD</span>
              </div>
            );
          }) : <div className="empty-state" style={{ padding:'20px 0' }}><div className="empty-icon">🚚</div>No delivery men added</div>}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <div className="card-title" style={{ margin:0 }}>⏳ Waiting / Pending — Quick View</div>
          <button className="btn btn-ghost btn-sm" onClick={() => router.push('/orders')}>Manage Orders →</button>
        </div>
        {pending.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th><th>Customer</th><th>Delivery Man</th><th>Items</th><th>Total</th><th>Status</th><th>Time</th></tr></thead>
              <tbody>
                {pending.slice(0, 8).map((o) => {
                  const dm = deliveryMen.find((d) => d.id === o.deliveryManId);
                  return (
                    <tr key={o.id}>
                      <td><span className="tag">{o.id.slice(-5)}</span></td>
                      <td style={{ fontSize:12, color:'var(--text-muted)' }}>{o.customerId || '—'}</td>
                      <td style={{ fontWeight:500 }}>{dm?.name ?? 'Unknown'}</td>
                      <td style={{ color:'var(--text-muted)' }}>{o.items.length} item(s)</td>
                      <td style={{ fontWeight:700, color:'var(--accent)' }}>{fmt(orderTotal(o))} $ USD</td>
                      <td><span className={`badge ${statusBadgeClass(o.status)}`}>{o.status}</span></td>
                      <td><span className="tag">{fmtTime(o.createdAt)}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <div className="empty-state" style={{ padding:'20px 0' }}><div className="empty-icon">✅</div>No pending orders</div>}
      </div>

      <div className="grid-3">
        {[
          { label:'Total Items',   value: items.length,       href:'/items' },
          { label:'Delivery Men',  value: deliveryMen.length, href:'/delivery' },
          { label:'Credentials',   value: credentials.length, href:'/credentials' },
        ].map((c) => (
          <div key={c.label} className="stat-card" style={{ cursor:'pointer' }} onClick={() => router.push(c.href)}>
            <div className="stat-label">{c.label}</div>
            <div className="stat-value">{c.value}</div>
            <div className="stat-sub" style={{ color:'var(--accent)' }}>Manage →</div>
          </div>
        ))}
      </div>
    </>
  );
}
