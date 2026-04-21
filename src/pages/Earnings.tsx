import { useState } from 'react';
import { useVaultStore } from '@/lib/store';
import { useModal } from '@/context/ModalContext';
import { fmt, fmtDateTime, orderTotal, calcFee } from '@/lib/utils';
import { uid } from '@/lib/utils';

const POOL_ID = '__pool__';

interface DistRow {
  id: string;
  workerId: string;
  value: string;
}

export default function Earnings() {
  const orders       = useVaultStore((s) => s.orders);
  const deliveryMen  = useVaultStore((s) => s.deliveryMen);
  const payouts      = useVaultStore((s) => s.payouts);
  const settings     = useVaultStore((s) => s.settings);
  const addPayout    = useVaultStore((s) => s.addPayout);
  const addPayouts   = useVaultStore((s) => s.addPayouts);
  const deletePayout = useVaultStore((s) => s.deletePayout);
  const { showConfirm } = useModal();

  const [selectedWorker, setSelectedWorker] = useState('all');

  // Distribute panel state
  const [distAmount, setDistAmount] = useState('');
  const [distMode,   setDistMode]   = useState<'pct' | 'amount'>('pct');
  const [distNote,   setDistNote]   = useState('');
  const [distRows,   setDistRows]   = useState<DistRow[]>([]);

  // Pool adjustment state
  const [poolAmount, setPoolAmount] = useState('');
  const [poolNote,   setPoolNote]   = useState('');

  const platformFees = settings.platformFees ?? [];

  // ── Pool total (global, not per-worker) ─────────────────────────────────────
  const doneOrders = orders.filter((o) => o.status === 'done');
  const gross      = doneOrders.reduce((a, o) => a + orderTotal(o), 0);
  const fees       = doneOrders.reduce((a, o) => a + calcFee(o, platformFees), 0);
  const net        = gross - fees;
  const poolAdj    = payouts
    .filter((p) => p.workerId === POOL_ID)
    .reduce((a, p) => a + (p.type === 'credit' ? p.amount : -p.amount), 0);
  const poolTotal  = net + poolAdj;

  const totalDistributed = payouts
    .filter((p) => p.workerId !== POOL_ID && p.type === 'debit')
    .reduce((a, p) => a + p.amount, 0);
  const totalCredits = payouts
    .filter((p) => p.workerId !== POOL_ID && p.type === 'credit')
    .reduce((a, p) => a + p.amount, 0);

  const remaining = poolTotal - totalDistributed + totalCredits;

  // ── Per-worker stats (for worker tab) ────────────────────────────────────────
  function workerPayout(workerId: string) {
    const wp = payouts.filter((p) => p.workerId === workerId);
    const paid    = wp.filter((p) => p.type === 'debit').reduce((a, p) => a + p.amount, 0);
    const credits = wp.filter((p) => p.type === 'credit').reduce((a, p) => a + p.amount, 0);
    return { paid, credits };
  }

  // ── Distribute helpers ───────────────────────────────────────────────────────
  function rowComputed(value: string): number {
    const v     = parseFloat(value);
    const total = parseFloat(distAmount);
    if (isNaN(v) || isNaN(total) || total <= 0) return 0;
    return distMode === 'pct' ? total * (v / 100) : v;
  }

  const allocated   = distRows.reduce((a, r) => a + rowComputed(r.value), 0);
  const unallocated = (parseFloat(distAmount) || 0) - allocated;

  function addDistRow() {
    setDistRows((prev) => [...prev, { id: uid(), workerId: '', value: '' }]);
  }

  function updateDistRow(id: string, patch: Partial<DistRow>) {
    setDistRows((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r));
  }

  function removeDistRow(id: string) {
    setDistRows((prev) => prev.filter((r) => r.id !== id));
  }

  function confirmDistribution() {
    const total = parseFloat(distAmount);
    if (isNaN(total) || total <= 0) return;
    const valid = distRows.filter((r) => r.workerId && rowComputed(r.value) > 0);
    if (!valid.length) return;
    const date  = new Date().toLocaleDateString();
    const note  = distNote.trim() || `Distribution ${date}`;
    addPayouts(valid.map((r) => ({
      workerId: r.workerId,
      amount:   rowComputed(r.value),
      type:     'debit' as const,
      note,
    })));
    setDistAmount(''); setDistNote(''); setDistRows([]);
  }

  function handlePoolAdjust(type: 'credit' | 'debit') {
    const amount = parseFloat(poolAmount);
    if (isNaN(amount) || amount <= 0) return;
    addPayout({ workerId: POOL_ID, amount, type, note: poolNote.trim() });
    setPoolAmount(''); setPoolNote('');
  }

  function handleDelete(id: string) {
    if (settings.confirmdelete) {
      showConfirm('Delete entry', 'Remove this transaction?', () => deletePayout(id));
    } else {
      deletePayout(id);
    }
  }

  const workerLabel = (wid: string) => {
    if (wid === 'all')   return 'All Workers';
    if (wid === POOL_ID) return 'Pool';
    return deliveryMen.find((d) => d.id === wid)?.name ?? wid;
  };

  const visiblePayouts = (() => {
    if (selectedWorker === 'all')   return payouts;
    if (selectedWorker === POOL_ID) return payouts.filter((p) => p.workerId === POOL_ID);
    return payouts.filter((p) => p.workerId === selectedWorker);
  })();

  const isSpecificWorker = selectedWorker !== 'all' && selectedWorker !== POOL_ID;
  const workerView = isSpecificWorker ? workerPayout(selectedWorker) : null;

  return (
    <>
      <div className="section-title">💰 Earnings</div>

      {/* Worker tabs */}
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

      {/* Pool Overview */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label">Pool Total</div>
          <div className="stat-value" style={{ color: 'var(--accent)', fontSize: 18 }}>{fmt(poolTotal)} <span style={{ fontSize: 12, fontWeight: 500 }}>$</span></div>
          <div className="stat-sub">net orders + adj.</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Distributed</div>
          <div className="stat-value" style={{ color: 'var(--orange)', fontSize: 18 }}>-{fmt(totalDistributed)} <span style={{ fontSize: 12, fontWeight: 500 }}>$</span></div>
          <div className="stat-sub">paid to workers</div>
        </div>
        {totalCredits > 0 && (
          <div className="stat-card">
            <div className="stat-label">Worker Credits</div>
            <div className="stat-value" style={{ color: 'var(--purple)', fontSize: 18 }}>+{fmt(totalCredits)} <span style={{ fontSize: 12, fontWeight: 500 }}>$</span></div>
            <div className="stat-sub">bonuses added</div>
          </div>
        )}
        <div className="stat-card">
          <div className="stat-label">Remaining</div>
          <div className="stat-value" style={{ color: remaining >= 0 ? 'var(--green)' : 'var(--red)', fontSize: 18 }}>{fmt(remaining)} <span style={{ fontSize: 12, fontWeight: 500 }}>$</span></div>
          <div className="stat-sub">{remaining >= 0 ? 'in pool' : 'over-distributed'}</div>
        </div>
      </div>

      {/* Per-worker stats strip */}
      {isSpecificWorker && workerView && (
        <div className="grid-4" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">Paid Out</div>
            <div className="stat-value" style={{ color: 'var(--red)', fontSize: 18 }}>{fmt(workerView.paid)} <span style={{ fontSize: 12, fontWeight: 500 }}>$</span></div>
            <div className="stat-sub">total received</div>
          </div>
          {workerView.credits > 0 && (
            <div className="stat-card">
              <div className="stat-label">Credits</div>
              <div className="stat-value" style={{ color: 'var(--green)', fontSize: 18 }}>+{fmt(workerView.credits)} <span style={{ fontSize: 12, fontWeight: 500 }}>$</span></div>
              <div className="stat-sub">bonuses</div>
            </div>
          )}
        </div>
      )}

      {/* Distribute card */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Distribute to Workers</div>

        {/* Top row: amount + mode + note */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>Amount to Distribute ($)</div>
            <input
              className="inp"
              type="number"
              min="0"
              step="0.01"
              style={{ width: 140 }}
              placeholder={`of ${fmt(remaining)} available`}
              value={distAmount}
              onChange={(e) => setDistAmount(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>Mode</div>
            <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border-inp)', borderRadius: 6, overflow: 'hidden' }}>
              <button
                className={`btn btn-sm ${distMode === 'pct' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ borderRadius: 0, border: 'none' }}
                onClick={() => setDistMode('pct')}
              >% Percent</button>
              <button
                className={`btn btn-sm ${distMode === 'amount' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ borderRadius: 0, border: 'none' }}
                onClick={() => setDistMode('amount')}
              >$ Amount</button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>Note (optional)</div>
            <input
              className="inp"
              placeholder="e.g. Weekly payout"
              value={distNote}
              onChange={(e) => setDistNote(e.target.value)}
            />
          </div>
        </div>

        {/* Worker rows */}
        {distRows.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {distRows.map((row) => {
              const computed = rowComputed(row.value);
              return (
                <div key={row.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    className="inp"
                    style={{ minWidth: 140 }}
                    value={row.workerId}
                    onChange={(e) => updateDistRow(row.id, { workerId: e.target.value })}
                  >
                    <option value="">Select worker...</option>
                    {deliveryMen.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      className="inp"
                      type="number"
                      min="0"
                      step="0.01"
                      style={{ width: 90 }}
                      placeholder={distMode === 'pct' ? '0%' : '0.00'}
                      value={row.value}
                      onChange={(e) => updateDistRow(row.id, { value: e.target.value })}
                    />
                    <span style={{ fontSize: 12, color: 'var(--text-hint)' }}>{distMode === 'pct' ? '%' : '$'}</span>
                  </div>
                  {row.value && row.workerId && (
                    <span style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600, minWidth: 70 }}>
                      = {fmt(computed)} $
                    </span>
                  )}
                  <button className="btn btn-ghost btn-xs" onClick={() => removeDistRow(row.id)}>×</button>
                </div>
              );
            })}
          </div>
        )}

        {/* Add worker + summary + confirm */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={addDistRow}>+ Add Worker</button>
          {distRows.length > 0 && parseFloat(distAmount) > 0 && (
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Allocated: <strong style={{ color: 'var(--orange)' }}>{fmt(allocated)} $</strong>
              &nbsp;|&nbsp;
              Unallocated: <strong style={{ color: unallocated >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(Math.abs(unallocated))} $</strong>
              {unallocated < 0 && <span style={{ color: 'var(--red)', marginLeft: 4 }}>over</span>}
            </span>
          )}
          {distRows.length > 0 && (
            <button
              className="btn btn-primary btn-sm"
              style={{ marginLeft: 'auto' }}
              onClick={confirmDistribution}
            >
              Confirm Distribution
            </button>
          )}
        </div>
      </div>

      {/* Pool Adjustments */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Pool Adjustments</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
          Manually add income or remove expenses from the total pool.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>Amount ($)</div>
            <input
              className="inp"
              type="number"
              min="0"
              step="0.01"
              style={{ width: 120 }}
              placeholder="0.00"
              value={poolAmount}
              onChange={(e) => setPoolAmount(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>Note</div>
            <input
              className="inp"
              placeholder="Optional note..."
              value={poolNote}
              onChange={(e) => setPoolNote(e.target.value)}
            />
          </div>
          <button className="btn btn-success btn-sm" onClick={() => handlePoolAdjust('credit')}>+ Add to Pool</button>
          <button className="btn btn-danger btn-sm" onClick={() => handlePoolAdjust('debit')}>− Remove from Pool</button>
        </div>
      </div>

      {/* Transaction Log */}
      <div className="card">
        <div className="card-title">
          Transaction Log
          {selectedWorker !== 'all' && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>— {workerLabel(selectedWorker)}</span>
          )}
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
                    const dm     = deliveryMen.find((d) => d.id === p.workerId);
                    const label  = isPool ? '💼 Pool' : (dm?.name ?? p.workerId);
                    const isAdd  = p.type === 'credit';
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
                          {isAdd ? '+' : '−'}{fmt(p.amount)} $
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
