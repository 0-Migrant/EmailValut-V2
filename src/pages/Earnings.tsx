import { useState } from 'react';
import { useVaultStore } from '@/lib/store';
import { useModal } from '@/context/ModalContext';
import { fmt, fmtDateTime, orderTotal, calcFee } from '@/lib/utils';

const POOL_ID = '__pool__';

export default function Earnings() {
  const orders       = useVaultStore((s) => s.orders);
  const deliveryMen  = useVaultStore((s) => s.deliveryMen);
  const payouts      = useVaultStore((s) => s.payouts);
  const settings     = useVaultStore((s) => s.settings);
  const addPayout    = useVaultStore((s) => s.addPayout);
  const deletePayout = useVaultStore((s) => s.deletePayout);
  const { showConfirm } = useModal();

  const [selectedWorker, setSelectedWorker] = useState('all');
  const [pmWorker,  setPmWorker]  = useState('');
  const [pmAmount,  setPmAmount]  = useState('');
  const [pmType,    setPmType]    = useState<'debit' | 'credit'>('debit');
  const [pmNote,    setPmNote]    = useState('');

  const platformFees = settings.platformFees ?? [];

  function workerStats(workerId: string) {
    const wo = orders.filter((o) =>
      o.status === 'done' && (workerId === 'all' || workerId === POOL_ID || o.deliveryManId === workerId)
    );
    const gross = wo.reduce((a, o) => a + orderTotal(o), 0);
    const fees  = wo.reduce((a, o) => a + calcFee(o, platformFees), 0);
    const net   = gross - fees;

    // Pool adjustments always included in 'all', otherwise only for pool tab or specific worker
    const wp = payouts.filter((p) => {
      if (workerId === 'all')   return true;
      if (workerId === POOL_ID) return p.workerId === POOL_ID;
      return p.workerId === workerId;
    });

    // Pool credit/debit adjusts the net total available
    const poolAdj = payouts
      .filter((p) => p.workerId === POOL_ID && (workerId === 'all' || workerId === POOL_ID))
      .reduce((a, p) => a + (p.type === 'credit' ? p.amount : -p.amount), 0);

    const workerPayouts = wp.filter((p) => p.workerId !== POOL_ID);
    const paidOut  = workerPayouts.filter((p) => p.type === 'debit').reduce((a, p) => a + p.amount, 0);
    const credits  = workerPayouts.filter((p) => p.type === 'credit').reduce((a, p) => a + p.amount, 0);

    const balance = net + poolAdj - paidOut + credits;
    return { gross, fees, net, poolAdj, paidOut, credits, balance, orderCount: wo.length };
  }

  function handleAddPayout() {
    const amount = parseFloat(pmAmount);
    if (!pmWorker || isNaN(amount) || amount <= 0) return;
    addPayout({ workerId: pmWorker, amount, type: pmType, note: pmNote.trim() });
    setPmAmount(''); setPmNote('');
  }

  function handleDelete(id: string) {
    if (settings.confirmdelete) {
      showConfirm('Delete entry', 'Remove this transaction?', () => deletePayout(id));
    } else {
      deletePayout(id);
    }
  }

  const stats = workerStats(selectedWorker);

  const visiblePayouts = (() => {
    if (selectedWorker === 'all')   return payouts;
    if (selectedWorker === POOL_ID) return payouts.filter((p) => p.workerId === POOL_ID);
    return payouts.filter((p) => p.workerId === selectedWorker);
  })();

  const workerLabel = (wid: string) => {
    if (wid === 'all')    return 'All Workers';
    if (wid === POOL_ID)  return 'Total Pool';
    return deliveryMen.find((d) => d.id === wid)?.name ?? wid;
  };

  const isPoolView = selectedWorker === POOL_ID;

  return (
    <>
      <div className="section-title">💰 Earnings</div>

      {/* Worker / pool tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {(['all', POOL_ID, ...deliveryMen.map((d) => d.id)] as string[]).map((wid) => (
          <button
            key={wid}
            className={`btn btn-sm ${selectedWorker === wid ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setSelectedWorker(wid)}
          >
            {workerLabel(wid)}
          </button>
        ))}
      </div>

      {/* Summary stats */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {!isPoolView && <>
          <div className="stat-card">
            <div className="stat-label">Gross Revenue</div>
            <div className="stat-value" style={{ fontSize: 18 }}>{fmt(stats.gross)} <span style={{ fontSize: 12, fontWeight: 500 }}>$</span></div>
            <div className="stat-sub">{stats.orderCount} orders</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Platform Fees</div>
            <div className="stat-value" style={{ color: 'var(--red)', fontSize: 18 }}>-{fmt(stats.fees)} <span style={{ fontSize: 12, fontWeight: 500 }}>$</span></div>
            <div className="stat-sub">deducted</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Net Earnings</div>
            <div className="stat-value" style={{ color: 'var(--accent)', fontSize: 18 }}>{fmt(stats.net)} <span style={{ fontSize: 12, fontWeight: 500 }}>$</span></div>
            <div className="stat-sub">after fees</div>
          </div>
        </>}
        {(selectedWorker === 'all' || isPoolView) && stats.poolAdj !== 0 && (
          <div className="stat-card">
            <div className="stat-label">Pool Adjustments</div>
            <div className="stat-value" style={{ color: stats.poolAdj >= 0 ? 'var(--green)' : 'var(--red)', fontSize: 18 }}>
              {stats.poolAdj >= 0 ? '+' : ''}{fmt(stats.poolAdj)} <span style={{ fontSize: 12, fontWeight: 500 }}>$</span>
            </div>
            <div className="stat-sub">manual total adj.</div>
          </div>
        )}
        {!isPoolView && <>
          <div className="stat-card">
            <div className="stat-label">Total Paid Out</div>
            <div className="stat-value" style={{ color: 'var(--orange)', fontSize: 18 }}>-{fmt(stats.paidOut)} <span style={{ fontSize: 12, fontWeight: 500 }}>$</span></div>
            <div className="stat-sub">disbursed</div>
          </div>
          {stats.credits > 0 && (
            <div className="stat-card">
              <div className="stat-label">Credits</div>
              <div className="stat-value" style={{ color: 'var(--purple)', fontSize: 18 }}>+{fmt(stats.credits)} <span style={{ fontSize: 12, fontWeight: 500 }}>$</span></div>
              <div className="stat-sub">adjustments added</div>
            </div>
          )}
        </>}
        <div className="stat-card">
          <div className="stat-label">Balance Remaining</div>
          <div className="stat-value" style={{ color: stats.balance >= 0 ? 'var(--green)' : 'var(--red)', fontSize: 18 }}>
            {fmt(stats.balance)} <span style={{ fontSize: 12, fontWeight: 500 }}>$</span>
          </div>
          <div className="stat-sub">{stats.balance >= 0 ? 'available' : 'overpaid'}</div>
        </div>
      </div>

      {/* Record transaction form */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Record Transaction</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
          Use <strong>Total Pool</strong> to add income or deduct expenses from the overall total. Use a specific worker to record payouts or adjustments for that person.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>Target</div>
            <select className="inp" style={{ minWidth: 150 }} value={pmWorker} onChange={(e) => setPmWorker(e.target.value)}>
              <option value="">Select target...</option>
              <option value={POOL_ID}>💼 Total Pool</option>
              <optgroup label="Workers">
                {deliveryMen.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </optgroup>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>
              {pmWorker === POOL_ID ? 'Operation' : 'Type'}
            </div>
            <select className="inp" style={{ width: 160 }} value={pmType} onChange={(e) => setPmType(e.target.value as 'debit' | 'credit')}>
              {pmWorker === POOL_ID ? <>
                <option value="credit">Add to Pool (+)</option>
                <option value="debit">Remove from Pool (−)</option>
              </> : <>
                <option value="debit">Paid Out (−)</option>
                <option value="credit">Credit / Bonus (+)</option>
              </>}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>Amount ($)</div>
            <input
              className="inp"
              type="number"
              min="0"
              step="0.01"
              style={{ width: 110 }}
              placeholder="0.00"
              value={pmAmount}
              onChange={(e) => setPmAmount(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddPayout()}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>Note</div>
            <input
              className="inp"
              placeholder="Optional note..."
              value={pmNote}
              onChange={(e) => setPmNote(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddPayout()}
            />
          </div>
          <button className="btn btn-primary" onClick={handleAddPayout}>Add</button>
        </div>
      </div>

      {/* Transaction log */}
      <div className="card">
        <div className="card-title">
          Transaction Log
          {selectedWorker !== 'all' && <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>— {workerLabel(selectedWorker)}</span>}
        </div>
        {visiblePayouts.length === 0
          ? <div className="empty-state"><div className="empty-icon">💸</div>No transactions recorded.</div>
          : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Target</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Note</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePayouts.map((p) => {
                    const isPool = p.workerId === POOL_ID;
                    const dm = deliveryMen.find((d) => d.id === p.workerId);
                    const label = isPool ? '💼 Total Pool' : (dm?.name ?? p.workerId);
                    const isAdd = p.type === 'credit';
                    return (
                      <tr key={p.id}>
                        <td><span className="tag">{fmtDateTime(p.createdAt)}</span></td>
                        <td style={{ fontWeight: 500 }}>{label}</td>
                        <td>
                          <span className={`badge ${isAdd ? 'badge-done' : 'badge-cancelled'}`}>
                            {isPool
                              ? (isAdd ? 'Pool Add' : 'Pool Remove')
                              : (isAdd ? 'Credit' : 'Paid Out')}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700, color: isAdd ? 'var(--green)' : 'var(--red)' }}>
                          {isAdd ? '+' : '-'}{fmt(p.amount)} $
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{p.note || '—'}</td>
                        <td>
                          <button className="btn btn-danger btn-xs" onClick={() => handleDelete(p.id)}>🗑</button>
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
