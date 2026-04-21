import { useState } from 'react';
import { useVaultStore } from '@/lib/store';
import { useModal } from '@/context/ModalContext';
import { fmt, fmtDateTime, orderTotal, calcFee } from '@/lib/utils';

export default function Earnings() {
  const orders      = useVaultStore((s) => s.orders);
  const deliveryMen = useVaultStore((s) => s.deliveryMen);
  const payouts     = useVaultStore((s) => s.payouts);
  const settings    = useVaultStore((s) => s.settings);
  const addPayout   = useVaultStore((s) => s.addPayout);
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
      o.status === 'done' && (workerId === 'all' || o.deliveryManId === workerId)
    );
    const gross   = wo.reduce((a, o) => a + orderTotal(o), 0);
    const fees    = wo.reduce((a, o) => a + calcFee(o, platformFees), 0);
    const net     = gross - fees;
    const wp      = payouts.filter((p) => workerId === 'all' || p.workerId === workerId);
    const paidOut = wp.filter((p) => p.type === 'debit').reduce((a, p) => a + p.amount, 0);
    const credits = wp.filter((p) => p.type === 'credit').reduce((a, p) => a + p.amount, 0);
    return { gross, fees, net, paidOut, credits, balance: net - paidOut + credits, orderCount: wo.length };
  }

  function handleAddPayout() {
    const amount = parseFloat(pmAmount);
    if (!pmWorker || isNaN(amount) || amount <= 0) return;
    addPayout({ workerId: pmWorker, amount, type: pmType, note: pmNote.trim() });
    setPmAmount(''); setPmNote('');
  }

  function handleDelete(id: string) {
    if (settings.confirmdelete) {
      showConfirm('Delete payout', 'Remove this payout entry?', () => deletePayout(id));
    } else {
      deletePayout(id);
    }
  }

  const stats = workerStats(selectedWorker);

  const visiblePayouts = selectedWorker === 'all'
    ? payouts
    : payouts.filter((p) => p.workerId === selectedWorker);

  return (
    <>
      <div className="section-title">💰 Earnings</div>

      {/* Worker tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {(['all', ...deliveryMen.map((d) => d.id)] as string[]).map((wid) => (
          <button
            key={wid}
            className={`btn btn-sm ${selectedWorker === wid ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setSelectedWorker(wid)}
          >
            {wid === 'all' ? 'All Workers' : deliveryMen.find((d) => d.id === wid)?.name ?? wid}
          </button>
        ))}
      </div>

      {/* Summary */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: 'Gross Revenue',    val: stats.gross,    color: undefined,      note: `${stats.orderCount} orders` },
          { label: 'Platform Fees',    val: -stats.fees,    color: 'var(--red)',   note: 'deducted' },
          { label: 'Net Earnings',     val: stats.net,      color: 'var(--accent)',note: 'after fees' },
          { label: 'Total Paid Out',   val: -stats.paidOut, color: 'var(--orange)',note: 'disbursed' },
          { label: 'Adjustments',      val: stats.credits,  color: 'var(--purple)',note: 'credits added' },
          { label: 'Balance Remaining',val: stats.balance,  color: stats.balance >= 0 ? 'var(--green)' : 'var(--red)', note: stats.balance >= 0 ? 'available' : 'overpaid' },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color, fontSize: 18 }}>
              {s.val < 0 ? '-' : ''}{fmt(Math.abs(s.val))} <span style={{ fontSize: 12, fontWeight: 500 }}>$</span>
            </div>
            <div className="stat-sub">{s.note}</div>
          </div>
        ))}
      </div>

      {/* Record payout form */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Record Transaction</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>Worker</div>
            <select className="inp" style={{ minWidth: 140 }} value={pmWorker} onChange={(e) => setPmWorker(e.target.value)}>
              <option value="">Select worker...</option>
              {deliveryMen.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>Type</div>
            <select className="inp" style={{ width: 150 }} value={pmType} onChange={(e) => setPmType(e.target.value as 'debit' | 'credit')}>
              <option value="debit">Paid Out (debit)</option>
              <option value="credit">Adjustment + (credit)</option>
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

      {/* Payout log */}
      <div className="card">
        <div className="card-title">Transaction Log</div>
        {visiblePayouts.length === 0
          ? <div className="empty-state"><div className="empty-icon">💸</div>No transactions recorded.</div>
          : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Worker</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Note</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePayouts.map((p) => {
                    const dm = deliveryMen.find((d) => d.id === p.workerId);
                    return (
                      <tr key={p.id}>
                        <td><span className="tag">{fmtDateTime(p.createdAt)}</span></td>
                        <td style={{ fontWeight: 500 }}>{dm?.name ?? p.workerId}</td>
                        <td>
                          <span className={`badge ${p.type === 'debit' ? 'badge-cancelled' : 'badge-done'}`}>
                            {p.type === 'debit' ? 'Paid Out' : 'Adjustment'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700, color: p.type === 'debit' ? 'var(--red)' : 'var(--green)' }}>
                          {p.type === 'debit' ? '-' : '+'}{fmt(p.amount)} $
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
