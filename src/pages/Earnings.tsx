import { useState } from 'react';
import { useVaultStore } from '@/lib/store';
import { fmt, fmtDateTime, orderTotal, calcFee } from '@/lib/utils';
import { uid } from '@/lib/utils';
import Icon from '@/components/Icon';

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
  const addPayouts      = useVaultStore((s) => s.addPayouts);
  const markPayoutPaid    = useVaultStore((s) => s.markPayoutPaid);
  const partialOutPayout  = useVaultStore((s) => s.partialOutPayout);
  const deletePayout      = useVaultStore((s) => s.deletePayout);

  const [selectedWorker, setSelectedWorker] = useState('all');

  // Partial-out state: payoutId → input string
  const [outAmounts, setOutAmounts] = useState<Record<string, string>>({});

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
    const wp      = payouts.filter((p) => p.workerId === workerId);
    const debits  = wp.filter((p) => p.type === 'debit');
    const pending = debits.filter((p) => p.status === 'pending').reduce((a, p) => a + p.amount, 0);
    const paid    = debits.filter((p) => p.status !== 'pending').reduce((a, p) => a + p.amount, 0);
    const credits = wp.filter((p) => p.type === 'credit').reduce((a, p) => a + p.amount, 0);
    return { pending, paid, credits };
  }

  // ── Distribute helpers ───────────────────────────────────────────────────────
  const distInput = Math.min(parseFloat(distAmount) || 0, distMode === 'pct' ? 100 : Infinity);
  const distTotal = distMode === 'pct' ? poolTotal * (distInput / 100) : distInput;

  function computeShare(value: string, mode: 'pct' | 'amount', base: number): number {
    const v = parseFloat(value);
    if (isNaN(v) || v <= 0 || base <= 0) return 0;
    return mode === 'pct' ? base * (v / 100) : v;
  }

  const workerPctSum  = distMode === 'pct'
    ? distRows.reduce((a, r) => a + (parseFloat(r.value) || 0), 0)
    : null;
  const workerPctOver = workerPctSum !== null && workerPctSum > 100;

  const allocated   = distRows.reduce((a, r) => a + computeShare(r.value, distMode, distTotal), 0);
  const unallocated = distTotal - allocated;
  const workerAmtOver = distMode === 'amount' && allocated > distTotal;

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
    if (distTotal <= 0) { alert('Enter the amount to distribute first.'); return; }
    if (workerPctOver) { alert('Worker percentages exceed 100%. Reduce them before confirming.'); return; }
    if (workerAmtOver) { alert('Worker amounts exceed the distribute total. Reduce them before confirming.'); return; }
    const valid = distRows.filter((r) => r.workerId && computeShare(r.value, distMode, distTotal) > 0);
    if (!valid.length) { alert('Add at least one worker with a valid value.'); return; }
    const date = new Date().toLocaleDateString();
    const note = distNote.trim() || `Distribution ${date}`;
    addPayouts(valid.map((r) => ({
      workerId: r.workerId,
      amount:   computeShare(r.value, distMode, distTotal),
      type:     'debit' as const,
      status:   'pending' as const,
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
    const pass = window.prompt('🔐 Enter admin password to delete this transaction:');
    if (pass === null) return;
    if (pass !== 'arerede2000.') {
      alert('❌ Incorrect password. Deletion cancelled.');
      return;
    }
    deletePayout(id);
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
      <div className="section-title"><Icon name="earnings" size={18} style={{ marginRight: 8 }} />Earnings</div>

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

      {/* Pool Overview — only on All Workers tab */}
      {selectedWorker === 'all' && <div className="grid-4" style={{ marginBottom: 20 }}>
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
      </div>}

      {/* Per-worker stats strip */}
      {isSpecificWorker && workerView && (
        <>
          <div className="grid-4" style={{ marginBottom: 20 }}>
            {workerView.pending > 0 && (
              <div className="stat-card" style={{ border: '1px solid var(--orange-border)', background: 'var(--orange-bg)' }}>
                <div className="stat-label" style={{ color: 'var(--orange)' }}>Pending Payout</div>
                <div className="stat-value" style={{ color: 'var(--orange)', fontSize: 18 }}>{fmt(workerView.pending)} <span style={{ fontSize: 12, fontWeight: 500 }}>$</span></div>
                <div className="stat-sub">allocated, not yet paid</div>
              </div>
            )}
            <div className="stat-card">
              <div className="stat-label">Paid Out</div>
              <div className="stat-value" style={{ color: 'var(--red)', fontSize: 18 }}>{fmt(workerView.paid)} <span style={{ fontSize: 12, fontWeight: 500 }}>$</span></div>
              <div className="stat-sub">confirmed received</div>
            </div>
            {workerView.credits > 0 && (
              <div className="stat-card">
                <div className="stat-label">Credits</div>
                <div className="stat-value" style={{ color: 'var(--green)', fontSize: 18 }}>+{fmt(workerView.credits)} <span style={{ fontSize: 12, fontWeight: 500 }}>$</span></div>
                <div className="stat-sub">bonuses</div>
              </div>
            )}
          </div>

          {/* Pending payouts — Out buttons */}
          {payouts.filter((p) => p.workerId === selectedWorker && p.type === 'debit' && p.status === 'pending').length > 0 && (
            <div className="card" style={{ marginBottom: 20, border: '1px solid var(--orange-border)' }}>
              <div className="card-title" style={{ color: 'var(--orange)', display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="pending" size={13} />Pending Payouts</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {payouts
                  .filter((p) => p.workerId === selectedWorker && p.type === 'debit' && p.status === 'pending')
                  .map((p) => {
                    const outVal = outAmounts[p.id] ?? '';
                    const outNum = parseFloat(outVal);
                    const isValid = !isNaN(outNum) && outNum > 0 && outNum <= p.amount;
                    const isFull  = isValid && outNum === p.amount;
                    return (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border-row)', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 120 }}>
                          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--orange)' }}>{fmt(p.amount)} $</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{p.note || '—'} · {fmtDateTime(p.createdAt)}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            className="inp"
                            type="number"
                            min="0.01"
                            max={p.amount}
                            step="0.01"
                            style={{ width: 90 }}
                            placeholder={fmt(p.amount)}
                            value={outVal}
                            onChange={(e) => setOutAmounts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                          />
                          <span style={{ fontSize: 12, color: 'var(--text-hint)' }}>/ {fmt(p.amount)} $</span>
                        </div>
                        <button
                          className="btn btn-success btn-sm"
                          disabled={outVal !== '' && !isValid}
                          onClick={() => {
                            const amount = outVal === '' ? p.amount : outNum;
                            if (outVal === '' || isFull) {
                              markPayoutPaid(p.id);
                            } else {
                              partialOutPayout(p.id, amount);
                            }
                            setOutAmounts((prev) => { const n = { ...prev }; delete n[p.id]; return n; });
                          }}
                        >
                          <Icon name="check" size={13} style={{ marginRight: 4 }} />Out {outVal !== '' && isValid && !isFull ? `${fmt(outNum)} $` : 'All'}
                        </button>
                        <button className="btn btn-danger btn-xs" onClick={() => handleDelete(p.id)}><Icon name="trash" size={11} /></button>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Distribute card — only on All Workers tab */}
      {selectedWorker === 'all' && <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="distribute" size={13} />Distribute to Workers
        </div>

        {/* Step 1 — Amount & Mode */}
        <div className="dist-step">
          <div className="dist-step-num">1</div>
          <div className="dist-step-body">
            <div className="dist-step-label">How much to distribute?</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border-inp)', borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
                <button
                  className={`btn btn-sm ${distMode === 'pct' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ borderRadius: 0, border: 'none', padding: '6px 12px' }}
                  onClick={() => setDistMode('pct')}
                >% of Pool</button>
                <button
                  className={`btn btn-sm ${distMode === 'amount' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ borderRadius: 0, border: 'none', padding: '6px 12px' }}
                  onClick={() => setDistMode('amount')}
                >$ Fixed</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  className="inp inp-sm"
                  type="number"
                  min="0"
                  max={distMode === 'pct' ? 100 : undefined}
                  step="0.01"
                  style={{ width: 110 }}
                  placeholder={distMode === 'pct' ? '0 – 100' : `max ${fmt(remaining)}`}
                  value={distAmount}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (distMode === 'pct' && !isNaN(v) && v > 100) { setDistAmount('100'); return; }
                    setDistAmount(e.target.value);
                  }}
                />
                <span style={{ fontSize: 13, color: 'var(--text-hint)', fontWeight: 600 }}>{distMode === 'pct' ? '%' : '$'}</span>
              </div>
              {distMode === 'pct' && distInput > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-subtle)', borderRadius: 6, padding: '0 10px', height: 28 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-hint)' }}>Pool amount:</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>{fmt(distTotal)} $</span>
                </div>
              )}
              <input
                className="inp inp-sm"
                style={{ flex: 1, minWidth: 140 }}
                placeholder="Note (optional)"
                value={distNote}
                onChange={(e) => setDistNote(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Step 2 — Worker shares */}
        <div className="dist-step">
          <div className="dist-step-num">2</div>
          <div className="dist-step-body">
            <div className="dist-step-label">Assign shares to workers</div>
            {distRows.map((row) => {
              const computed = computeShare(row.value, distMode, distTotal);
              const hasValue = parseFloat(row.value) > 0;
              return (
                <div key={row.id} className="dist-worker-row">
                  <select
                    className="inp"
                    style={{ width: 160, flexShrink: 0 }}
                    value={row.workerId}
                    onChange={(e) => updateDistRow(row.id, { workerId: e.target.value })}
                  >
                    <option value="">Select worker...</option>
                    {deliveryMen.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <input
                    className="inp"
                    type="number"
                    min="0"
                    step="0.01"
                    style={{ width: 90, flexShrink: 0 }}
                    placeholder={distMode === 'pct' ? 'e.g. 30' : 'e.g. 50'}
                    value={row.value}
                    onChange={(e) => updateDistRow(row.id, { value: e.target.value })}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-hint)', fontWeight: 600, flexShrink: 0 }}>{distMode === 'pct' ? '%' : '$'}</span>
                  {hasValue && distTotal > 0 && (
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)', flexShrink: 0 }}>= {fmt(computed)} $</span>
                  )}
                  <button className="btn btn-ghost btn-xs" style={{ marginLeft: 'auto', flexShrink: 0 }} onClick={() => removeDistRow(row.id)}>
                    <Icon name="x" size={11} />
                  </button>
                </div>
              );
            })}
            <button className="btn btn-ghost btn-sm" style={{ marginTop: distRows.length > 0 ? 8 : 0 }} onClick={addDistRow}>
              <Icon name="plus" size={13} style={{ marginRight: 4 }} />Add Worker
            </button>
          </div>
        </div>

        {/* Step 3 — Summary & Confirm */}
        {distRows.length > 0 && (
          <div className="dist-step">
            <div className="dist-step-num" style={{ background: workerPctOver || workerAmtOver ? 'var(--red)' : 'var(--green)' }}>3</div>
            <div className="dist-step-body">
              <div className="dist-step-label">Review & confirm</div>
              <div className="dist-summary">
                <div className="dist-summary-item">
                  <span className="dist-summary-label">Pool total</span>
                  <span className="dist-summary-value" style={{ color: 'var(--accent)' }}>{fmt(poolTotal)} $</span>
                </div>
                <div className="dist-summary-item">
                  <span className="dist-summary-label">Distributing</span>
                  <span className="dist-summary-value" style={{ color: 'var(--orange)' }}>{fmt(distTotal)} $</span>
                </div>
                <div className="dist-summary-item">
                  <span className="dist-summary-label">Allocated</span>
                  <span className="dist-summary-value" style={{ color: (workerPctOver || workerAmtOver) ? 'var(--red)' : 'var(--green)' }}>
                    {fmt(allocated)} $
                    {distMode === 'pct' && workerPctSum !== null && (
                      <span style={{ fontSize: 12, marginLeft: 4 }}>({workerPctSum.toFixed(1)}%)</span>
                    )}
                  </span>
                </div>
                <div className="dist-summary-item">
                  <span className="dist-summary-label">Unallocated</span>
                  <span className="dist-summary-value" style={{ color: unallocated >= 0 ? 'var(--text-muted)' : 'var(--red)' }}>{fmt(Math.abs(unallocated))} $</span>
                </div>
              </div>
              {(workerPctOver || workerAmtOver) && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--red)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Icon name="info" size={13} />
                  {workerPctOver ? 'Worker percentages exceed 100%.' : 'Worker amounts exceed the distribute total.'}
                </div>
              )}
              <button
                className={`btn btn-sm ${workerPctOver || workerAmtOver ? 'btn-danger' : 'btn-primary'}`}
                style={{ marginTop: 12 }}
                onClick={confirmDistribution}
                disabled={workerPctOver || workerAmtOver}
              >
                {workerPctOver || workerAmtOver
                  ? <><Icon name="x" size={13} style={{ marginRight: 5 }} />Over Limit</>
                  : <><Icon name="check" size={13} style={{ marginRight: 5 }} />Confirm Distribution</>}
              </button>
            </div>
          </div>
        )}
      </div>}

      {/* Pool Adjustments — only on All Workers tab */}
      {selectedWorker === 'all' && <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Pool Adjustments</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
          Manually add income or remove expenses from the total pool.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="inp"
            type="number"
            min="0"
            step="0.01"
            style={{ width: 130 }}
            placeholder="Amount ($)"
            value={poolAmount}
            onChange={(e) => setPoolAmount(e.target.value)}
          />
          <input
            className="inp"
            style={{ flex: 1, minWidth: 160 }}
            placeholder="Note (optional)"
            value={poolNote}
            onChange={(e) => setPoolNote(e.target.value)}
          />
          <button className="btn btn-success" onClick={() => handlePoolAdjust('credit')}><Icon name="plus" size={13} style={{ marginRight: 5 }} />Add to Pool</button>
          <button className="btn btn-danger" onClick={() => handlePoolAdjust('debit')}><Icon name="x" size={13} style={{ marginRight: 5 }} />Remove from Pool</button>
        </div>
      </div>}

      {/* Transaction Log */}
      <div className="card">
        <div className="card-title">
          Transaction Log
          {selectedWorker !== 'all' && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>— {workerLabel(selectedWorker)}</span>
          )}
        </div>
        {visiblePayouts.length === 0
          ? <div className="empty-state"><div className="empty-icon"><Icon name="money" size={28} /></div>No transactions recorded.</div>
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
                    const isAdd  = p.type === 'credit';
                    return (
                      <tr key={p.id}>
                        <td><span className="tag">{fmtDateTime(p.createdAt)}</span></td>
                        <td style={{ fontWeight: 500 }}>
                          {isPool
                            ? <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="pool" size={13} color="var(--accent)" />Pool</span>
                            : <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <Icon name="workers" size={13} color="var(--text-hint)" />
                                {dm?.name ?? p.workerId}
                              </span>
                          }
                        </td>
                        <td>
                          <span className={`badge ${isAdd ? 'badge-done' : p.status === 'pending' ? 'badge-waiting-payment' : 'badge-cancelled'}`}>
                            {isPool
                              ? (isAdd ? 'Pool Add' : 'Pool Remove')
                              : (isAdd ? 'Credit' : p.status === 'pending' ? 'Pending' : 'Paid Out')}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700, color: isAdd ? 'var(--green)' : 'var(--red)' }}>
                          {isAdd ? '+' : '−'}{fmt(p.amount)} $
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{p.note || '—'}</td>
                        <td>
                          <button className="btn btn-danger btn-xs" onClick={() => handleDelete(p.id)}><Icon name="trash" size={11} /></button>
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
