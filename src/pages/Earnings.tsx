import { useState, useMemo } from 'react';
import { useVaultStore } from '@/lib/store';
import { fmt, fmtDateTime, orderTotal, calcFee, inDateRange } from '@/lib/utils';
import { uid } from '@/lib/utils';
import Icon from '@/components/Icon';

const POOL_ID     = '__pool__';
const WALLET_ADJ  = '__wallet_adj__';

interface DistRow {
  id: string;
  workerId: string;
  value: string;
}

// Simple horizontal bar used in the Analytics sub-tab
function Bar({ value, max, color = 'var(--accent)' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden', flex: 1 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width .3s' }} />
    </div>
  );
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
  const deletePayout            = useVaultStore((s) => s.deletePayout);
  const restorePayoutToPending  = useVaultStore((s) => s.restorePayoutToPending);

  const wallets = settings.wallets ?? [];

  // ── Active tab ────────────────────────────────────────────────────────────────
  // 'all' | 'wallets' | workerId | 'analytics'
  const [activeTab, setActiveTab] = useState('all');
  const [activeWalletId, setActiveWalletId] = useState<string | null>(null);

  function switchToWallets() {
    setActiveTab('wallets');
    if (!activeWalletId && wallets.length > 0) setActiveWalletId(wallets[0].id);
  }

  // Partial-out state
  const [outAmounts, setOutAmounts] = useState<Record<string, string>>({});

  // Distribute panel state
  const [distAmount,   setDistAmount]   = useState('');
  const [distMode,     setDistMode]     = useState<'pct' | 'amount'>('pct');
  const [distNote,     setDistNote]     = useState('');
  const [distRows,     setDistRows]     = useState<DistRow[]>([]);
  const [distWalletId, setDistWalletId] = useState('');

  // Wallet adjustment state
  const [poolAmount, setPoolAmount] = useState('');
  const [poolNote,   setPoolNote]   = useState('');

  // Filter state
  const [filterFrom,   setFilterFrom]   = useState('');
  const [filterTo,     setFilterTo]     = useState('');
  const [filterWorker, setFilterWorker] = useState('all');
  const [filterType,   setFilterType]   = useState<'all' | 'debit' | 'credit'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'paid'>('all');

  // Analytics sub-tab state
  const [analyticsWallet, setAnalyticsWallet] = useState('all');
  const [analyticsFrom,   setAnalyticsFrom]   = useState('');
  const [analyticsTo,     setAnalyticsTo]     = useState('');

  const platformFees = settings.platformFees ?? [];

  // ── Orders base data ──────────────────────────────────────────────────────────
  const doneOrders = orders.filter((o) => o.status === 'done');

  // All payment method labels claimed by any wallet
  const allLinkedMethods = wallets.flatMap((w) => w.paymentMethods ?? []);

  // Orders NOT linked to any wallet (unassigned revenue)
  const unlinkedOrders = doneOrders.filter((o) => !allLinkedMethods.includes(o.paymentMethod));
  const unlinkedNet    = unlinkedOrders.reduce((a, o) => a + orderTotal(o) - calcFee(o, platformFees), 0);

  // Legacy pool manual adjustments (old __pool__ entries)
  const legacyPoolAdj = payouts
    .filter((p) => p.workerId === POOL_ID)
    .reduce((a, p) => a + (p.type === 'credit' ? p.amount : -p.amount), 0);

  const totalDistributed = payouts
    .filter((p) => p.workerId !== POOL_ID && p.workerId !== WALLET_ADJ && p.type === 'debit')
    .reduce((a, p) => a + p.amount, 0);
  const totalCredits = payouts
    .filter((p) => p.workerId !== POOL_ID && p.workerId !== WALLET_ADJ && p.type === 'credit')
    .reduce((a, p) => a + p.amount, 0);


  // ── Per-wallet stats ──────────────────────────────────────────────────────────
  function walletStats(walletId: string) {
    const wallet = wallets.find((w) => w.id === walletId);
    const linkedMethods = wallet?.paymentMethods ?? [];

    // Revenue from completed orders whose payment method is linked to this wallet
    const orderRevenue = linkedMethods.length > 0
      ? doneOrders
          .filter((o) => linkedMethods.includes(o.paymentMethod))
          .reduce((a, o) => a + orderTotal(o) - calcFee(o, platformFees), 0)
      : 0;

    // Manual adjustments (credit adds, debit removes)
    const adj = payouts
      .filter((p) => p.workerId === WALLET_ADJ && p.walletId === walletId)
      .reduce((a, p) => a + (p.type === 'credit' ? p.amount : -p.amount), 0);

    const distributed = payouts
      .filter((p) => p.walletId === walletId && p.type === 'debit' && p.workerId !== WALLET_ADJ)
      .reduce((a, p) => a + p.amount, 0);

    const totalIncome = orderRevenue + adj;
    return { orderRevenue, adj, distributed, totalIncome, balance: totalIncome - distributed };
  }

  // ── All-tab aggregates (sum across all wallets + unlinked) ───────────────────
  const walletsTotalIncome  = wallets.reduce((a, w) => a + walletStats(w.id).totalIncome, 0);
  const walletsTotalBalance = wallets.reduce((a, w) => a + walletStats(w.id).balance, 0);
  // Grand total = all wallet income + unlinked orders net + legacy pool manual adj
  const grandTotalIncome    = walletsTotalIncome + unlinkedNet + legacyPoolAdj;
  const grandRemaining      = grandTotalIncome - totalDistributed + totalCredits;

  // ── Per-worker stats ──────────────────────────────────────────────────────────
  function workerPayout(workerId: string) {
    const wp      = payouts.filter((p) => p.workerId === workerId);
    const debits  = wp.filter((p) => p.type === 'debit');
    const pending = debits.filter((p) => p.status === 'pending').reduce((a, p) => a + p.amount, 0);
    const paid    = debits.filter((p) => p.status !== 'pending').reduce((a, p) => a + p.amount, 0);
    const credits = wp.filter((p) => p.type === 'credit').reduce((a, p) => a + p.amount, 0);
    return { pending, paid, credits };
  }

  // ── Distribution helpers ──────────────────────────────────────────────────────
  const selectedWalletBalance = distWalletId ? walletStats(distWalletId).balance : null;
  const distBase  = selectedWalletBalance !== null ? selectedWalletBalance : grandRemaining;
  const distInput = Math.min(parseFloat(distAmount) || 0, distMode === 'pct' ? 100 : Infinity);
  const distTotal = distMode === 'pct' ? distBase * (distInput / 100) : distInput;

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
    if (!distWalletId && wallets.length > 0) { alert('Select a source wallet before distributing.'); return; }
    if (distTotal <= 0) { alert('Enter the amount to distribute first.'); return; }
    if (workerPctOver) { alert('Worker percentages exceed 100%. Reduce them before confirming.'); return; }
    if (workerAmtOver) { alert('Worker amounts exceed the distribute total. Reduce them before confirming.'); return; }
    const valid = distRows.filter((r) => r.workerId && computeShare(r.value, distMode, distTotal) > 0);
    if (!valid.length) { alert('Add at least one worker with a valid value.'); return; }
    const date = new Date().toLocaleDateString();
    const note = distNote.trim() || `Distribution ${date}`;
    addPayouts(valid.map((r) => ({
      workerId:  r.workerId,
      walletId:  distWalletId || undefined,
      amount:    computeShare(r.value, distMode, distTotal),
      type:      'debit' as const,
      status:    'pending' as const,
      note,
    })));
    setDistAmount(''); setDistNote(''); setDistRows([]); setDistWalletId('');
  }

  function handleWalletAdjust(walletId: string, type: 'credit' | 'debit') {
    const amount = parseFloat(poolAmount);
    if (isNaN(amount) || amount <= 0 || !walletId) return;
    addPayout({ workerId: WALLET_ADJ, walletId, amount, type, note: poolNote.trim() });
    setPoolAmount(''); setPoolNote('');
  }

  function handleDelete(id: string) {
    const payout = payouts.find((p) => p.id === id);
    if (!payout) return;

    if (payout.status === 'paid') {
      const pass = window.prompt('Enter admin password to cancel this paid transaction (amount returns to pending):');
      if (pass === null) return;
      if (pass !== 'arerede2000.') { alert('❌ Incorrect password.'); return; }
      restorePayoutToPending(id);
      return;
    }

    const pass = window.prompt('Enter admin password to delete this transaction:');
    if (pass === null) return;
    if (pass !== 'arerede2000.') { alert('❌ Incorrect password. Deletion cancelled.'); return; }
    deletePayout(id);
  }

  // ── Visible payouts with filters ──────────────────────────────────────────────
  const visiblePayouts = useMemo(() => {
    let list = payouts;
    // Tab scope
    if (activeTab !== 'all' && activeTab !== 'wallets' && activeTab !== 'analytics') {
      list = list.filter((p) => p.workerId === activeTab);
    }
    // Extra filters
    if (filterWorker !== 'all') list = list.filter((p) => p.workerId === filterWorker);
    if (filterType !== 'all')   list = list.filter((p) => p.type === filterType);
    if (filterStatus !== 'all') list = list.filter((p) => (filterStatus === 'pending' ? p.status === 'pending' : p.status === 'paid'));
    if (filterFrom || filterTo) list = list.filter((p) => inDateRange(p.createdAt, filterFrom, filterTo));
    return list;
  }, [payouts, activeTab, filterWorker, filterType, filterStatus, filterFrom, filterTo]);

  // ── Analytics sub-tab computations ───────────────────────────────────────────
  const analyticsPayouts = useMemo(() => {
    let list = payouts.filter((p) => p.workerId !== POOL_ID && p.workerId !== WALLET_ADJ);
    if (analyticsWallet !== 'all') list = list.filter((p) => p.walletId === analyticsWallet);
    if (analyticsFrom || analyticsTo) list = list.filter((p) => inDateRange(p.createdAt, analyticsFrom, analyticsTo));
    return list;
  }, [payouts, analyticsWallet, analyticsFrom, analyticsTo]);

  // Daily distributions (last 30 days or filtered range)
  const dailyDist = useMemo(() => {
    const debits = analyticsPayouts.filter((p) => p.type === 'debit');
    const map: Record<string, number> = {};
    debits.forEach((p) => {
      const day = p.createdAt.slice(0, 10);
      map[day] = (map[day] ?? 0) + p.amount;
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).slice(-30);
  }, [analyticsPayouts]);

  const maxDaily = Math.max(1, ...dailyDist.map(([, v]) => v));
  const maxWalletBal = Math.max(1, ...wallets.map((w) => Math.abs(walletStats(w.id).totalIncome)));
  const maxWorkerPaid = Math.max(1, ...deliveryMen.map((d) => workerPayout(d.id).paid + workerPayout(d.id).pending));

  const isWorkerTab = activeTab !== 'all' && activeTab !== 'wallets' && activeTab !== 'analytics';
  const workerView  = isWorkerTab ? workerPayout(activeTab) : null;

  function tabLabel(tab: string) {
    if (tab === 'all')       return 'All';
    if (tab === 'wallets')   return 'Wallets';
    if (tab === 'analytics') return 'Analytics';
    return deliveryMen.find((d) => d.id === tab)?.name ?? tab;
  }

  function entryTarget(p: { workerId: string; walletId?: string }) {
    if (p.workerId === POOL_ID)    return 'Legacy Pool';
    if (p.workerId === WALLET_ADJ) {
      const w = wallets.find((x) => x.id === p.walletId);
      return w ? `Wallet: ${w.name}` : 'Wallet Adj.';
    }
    return deliveryMen.find((d) => d.id === p.workerId)?.name ?? p.workerId;
  }

  function entryBadge(p: { workerId: string; type: string; status?: string }) {
    const isAdj = p.workerId === POOL_ID || p.workerId === WALLET_ADJ;
    const isAdd = p.type === 'credit';
    if (isAdj) return isAdd ? 'badge-done' : 'badge-cancelled';
    return isAdd ? 'badge-done' : p.status === 'pending' ? 'badge-waiting-payment' : 'badge-cancelled';
  }

  function entryBadgeLabel(p: { workerId: string; type: string; status?: string }) {
    const isAdj = p.workerId === POOL_ID || p.workerId === WALLET_ADJ;
    const isAdd = p.type === 'credit';
    if (isAdj) return isAdd ? 'Income' : 'Expense';
    return isAdd ? 'Credit' : p.status === 'pending' ? 'Pending' : 'Paid Out';
  }

  return (
    <>
      <div className="section-title"><Icon name="earnings" size={18} style={{ marginRight: 8 }} />Earnings</div>

      {/* ── Tabs ──────────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {(['all', 'wallets', ...deliveryMen.map((d) => d.id), 'analytics']).map((tab) => (
          <button
            key={tab}
            className={`btn btn-sm ${activeTab === tab ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => tab === 'wallets' ? switchToWallets() : setActiveTab(tab)}
          >
            {tabLabel(tab)}
          </button>
        ))}
      </div>

      {/* ── Analytics Sub-Tab ─────────────────────────────────────────────────── */}
      {activeTab === 'analytics' && (
        <>
          {/* Filter bar */}
          <div className="card" style={{ marginBottom: 16, padding: '12px 16px' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <select className="inp inp-sm" value={analyticsWallet} onChange={(e) => setAnalyticsWallet(e.target.value)} style={{ width: 140 }}>
                <option value="all">All Wallets</option>
                {wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <input type="date" className="inp inp-sm" style={{ width: 140 }} value={analyticsFrom} onChange={(e) => setAnalyticsFrom(e.target.value)} />
              <span style={{ fontSize: 12, color: 'var(--text-hint)' }}>to</span>
              <input type="date" className="inp inp-sm" style={{ width: 140 }} value={analyticsTo} onChange={(e) => setAnalyticsTo(e.target.value)} />
              <button className="btn btn-ghost btn-sm" onClick={() => { setAnalyticsWallet('all'); setAnalyticsFrom(''); setAnalyticsTo(''); }}>Reset</button>
            </div>
          </div>

          {/* Wallet Balances */}
          {wallets.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-title">Wallet Balances</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                {wallets.map((w) => {
                  const s = walletStats(w.id);
                  return (
                    <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 110, fontSize: 13, fontWeight: 600, flexShrink: 0 }}>{w.name}</span>
                      <Bar value={Math.max(0, s.balance)} max={maxWalletBal} color={s.balance >= 0 ? 'var(--green)' : 'var(--red)'} />
                      <span style={{ width: 80, fontSize: 13, fontWeight: 700, color: s.balance >= 0 ? 'var(--green)' : 'var(--red)', textAlign: 'right', flexShrink: 0 }}>{fmt(s.balance)} $</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Daily Distributions */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">Daily Distributions</div>
            {dailyDist.length === 0
              ? <div className="empty-state">No distribution data for selected range.</div>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  {dailyDist.map(([day, val]) => (
                    <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 95, fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{day}</span>
                      <Bar value={val} max={maxDaily} color="var(--orange)" />
                      <span style={{ width: 80, fontSize: 13, fontWeight: 700, color: 'var(--orange)', textAlign: 'right', flexShrink: 0 }}>{fmt(val)} $</span>
                    </div>
                  ))}
                </div>
              )
            }
          </div>

          {/* Worker Payout Totals */}
          <div className="card">
            <div className="card-title">Worker Payout Totals</div>
            {deliveryMen.length === 0
              ? <div className="empty-state">No workers added yet.</div>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                  {deliveryMen.map((d) => {
                    const wp = workerPayout(d.id);
                    const total = wp.paid + wp.pending;
                    return (
                      <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ width: 110, fontSize: 13, fontWeight: 600, flexShrink: 0 }}>{d.name}</span>
                        <Bar value={total} max={maxWorkerPaid} color="var(--accent)" />
                        <div style={{ width: 120, flexShrink: 0, textAlign: 'right' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{fmt(total)} $</span>
                          {wp.pending > 0 && <span style={{ fontSize: 11, color: 'var(--orange)', marginLeft: 6 }}>({fmt(wp.pending)} pending)</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            }
          </div>
        </>
      )}

      {/* ── Wallets Tab ───────────────────────────────────────────────────────── */}
      {activeTab === 'wallets' && (
        <>
          {wallets.length === 0
            ? <div className="card"><div className="empty-state"><Icon name="money" size={28} />No wallets configured. Add wallets in Settings first.</div></div>
            : (
              <>
                {/* Wallet sub-tabs */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                  {wallets.map((w) => (
                    <button
                      key={w.id}
                      className={`btn btn-sm ${(activeWalletId ?? wallets[0]?.id) === w.id ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setActiveWalletId(w.id)}
                    >{w.name}</button>
                  ))}
                </div>

                {(() => {
                  const effectiveId = activeWalletId ?? wallets[0]?.id;
                  const w = wallets.find((x) => x.id === effectiveId);
                  if (!w) return null;
                  const stats = walletStats(effectiveId);
                  const walletLog = payouts.filter(
                    (p) => (p.walletId === effectiveId) || (p.workerId === WALLET_ADJ && p.walletId === effectiveId)
                  );
                  return (
                    <>
                      <div className="grid-4" style={{ marginBottom: 20 }}>
                        <div className="stat-card">
                          <div className="stat-label">Balance</div>
                          <div className="stat-value" style={{ color: stats.balance >= 0 ? 'var(--green)' : 'var(--red)', fontSize: 18 }}>{fmt(stats.balance)} <span style={{ fontSize: 12 }}>$</span></div>
                          <div className="stat-sub">remaining</div>
                        </div>
                        <div className="stat-card">
                          <div className="stat-label">Orders Revenue</div>
                          <div className="stat-value" style={{ color: 'var(--accent)', fontSize: 18 }}>{fmt(stats.orderRevenue)} <span style={{ fontSize: 12 }}>$</span></div>
                          <div className="stat-sub">from linked orders</div>
                        </div>
                        <div className="stat-card">
                          <div className="stat-label">Manual Adjustments</div>
                          <div className="stat-value" style={{ color: 'var(--accent)', fontSize: 18 }}>{fmt(stats.adj)} <span style={{ fontSize: 12 }}>$</span></div>
                          <div className="stat-sub">added / removed</div>
                        </div>
                        <div className="stat-card">
                          <div className="stat-label">Distributed</div>
                          <div className="stat-value" style={{ color: 'var(--orange)', fontSize: 18 }}>{fmt(stats.distributed)} <span style={{ fontSize: 12 }}>$</span></div>
                          <div className="stat-sub">paid to workers</div>
                        </div>
                      </div>

                      {/* Wallet Adjustment Form */}
                      <div className="card" style={{ marginBottom: 20 }}>
                        <div className="card-title">Wallet Adjustments — {w.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Add income or remove expenses from this wallet.</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <input className="inp" type="number" min="0" step="0.01" style={{ width: 130 }} placeholder="Amount ($)" value={poolAmount} onChange={(e) => setPoolAmount(e.target.value)} />
                          <input className="inp" style={{ flex: 1, minWidth: 160 }} placeholder="Note (optional)" value={poolNote} onChange={(e) => setPoolNote(e.target.value)} />
                          <button className="btn btn-success" onClick={() => handleWalletAdjust(effectiveId, 'credit')}><Icon name="plus" size={13} style={{ marginRight: 5 }} />Add Income</button>
                          <button className="btn btn-danger" onClick={() => handleWalletAdjust(effectiveId, 'debit')}><Icon name="x" size={13} style={{ marginRight: 5 }} />Remove</button>
                        </div>
                      </div>

                      {/* Wallet Transaction Log */}
                      <div className="card">
                        <div className="card-title">Wallet History — {w.name}</div>
                        {walletLog.length === 0
                          ? <div className="empty-state"><Icon name="money" size={28} />No transactions for this wallet.</div>
                          : (
                            <div className="table-wrap">
                              <table>
                                <thead>
                                  <tr><th>Date</th><th>Target</th><th>Type</th><th>Amount</th><th>Note</th><th></th></tr>
                                </thead>
                                <tbody>
                                  {walletLog.map((p) => {
                                    const isAdj = p.workerId === WALLET_ADJ;
                                    const isAdd = p.type === 'credit';
                                    const dm = deliveryMen.find((d) => d.id === p.workerId);
                                    return (
                                      <tr key={p.id}>
                                        <td><span className="tag">{fmtDateTime(p.createdAt)}</span></td>
                                        <td style={{ fontWeight: 500 }}>{isAdj ? `Wallet: ${w.name}` : (dm?.name ?? p.workerId)}</td>
                                        <td><span className={`badge ${isAdj ? (isAdd ? 'badge-done' : 'badge-cancelled') : (isAdd ? 'badge-done' : p.status === 'pending' ? 'badge-waiting-payment' : 'badge-cancelled')}`}>{isAdj ? (isAdd ? 'Income' : 'Expense') : (isAdd ? 'Credit' : p.status === 'pending' ? 'Pending' : 'Paid Out')}</span></td>
                                        <td style={{ fontWeight: 700, color: isAdd ? 'var(--green)' : 'var(--red)' }}>{isAdd ? '+' : '−'}{fmt(p.amount)} $</td>
                                        <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{p.note || '—'}</td>
                                        <td><button className="btn btn-danger btn-xs" onClick={() => handleDelete(p.id)}><Icon name="trash" size={11} /></button></td>
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
                })()}

                {!activeWalletId && (
                  <div className="card">
                    <div className="empty-state">Select a wallet above to view its details.</div>
                  </div>
                )}
              </>
            )
          }
        </>
      )}

      {/* ── All / Worker views ────────────────────────────────────────────────── */}
      {activeTab !== 'analytics' && activeTab !== 'wallets' && (
        <>
          {/* Overview stats — All tab */}
          {activeTab === 'all' && (
            <div className="grid-4" style={{ marginBottom: 20 }}>
              <div className="stat-card">
                <div className="stat-label">Total Income</div>
                <div className="stat-value" style={{ color: 'var(--accent)', fontSize: 18 }}>{fmt(grandTotalIncome)} <span style={{ fontSize: 12, fontWeight: 500 }}>$</span></div>
                <div className="stat-sub">wallets + unlinked orders</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Wallets Balance</div>
                <div className="stat-value" style={{ color: walletsTotalBalance >= 0 ? 'var(--green)' : 'var(--red)', fontSize: 18 }}>{fmt(walletsTotalBalance)} <span style={{ fontSize: 12, fontWeight: 500 }}>$</span></div>
                <div className="stat-sub">{wallets.length} wallet{wallets.length !== 1 ? 's' : ''}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Total Distributed</div>
                <div className="stat-value" style={{ color: 'var(--orange)', fontSize: 18 }}>-{fmt(totalDistributed)} <span style={{ fontSize: 12, fontWeight: 500 }}>$</span></div>
                <div className="stat-sub">paid to workers</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Net Remaining</div>
                <div className="stat-value" style={{ color: grandRemaining >= 0 ? 'var(--green)' : 'var(--red)', fontSize: 18 }}>{fmt(grandRemaining)} <span style={{ fontSize: 12, fontWeight: 500 }}>$</span></div>
                <div className="stat-sub">{grandRemaining >= 0 ? 'available' : 'over-distributed'}</div>
              </div>
            </div>
          )}

          {/* Per-worker stats */}
          {isWorkerTab && workerView && (
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
              {payouts.filter((p) => p.workerId === activeTab && p.type === 'debit' && p.status === 'pending').length > 0 && (
                <div className="card" style={{ marginBottom: 20, border: '1px solid var(--orange-border)' }}>
                  <div className="card-title" style={{ color: 'var(--orange)', display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="pending" size={13} />Pending Payouts</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {payouts
                      .filter((p) => p.workerId === activeTab && p.type === 'debit' && p.status === 'pending')
                      .map((p) => {
                        const outVal = outAmounts[p.id] ?? '';
                        const outNum = parseFloat(outVal);
                        const isValid = !isNaN(outNum) && outNum > 0 && outNum <= p.amount;
                        const isFull  = isValid && outNum === p.amount;
                        const srcWallet = p.walletId ? wallets.find((w) => w.id === p.walletId) : null;
                        return (
                          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border-row)', flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: 120 }}>
                              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--orange)' }}>{fmt(p.amount)} $</div>
                              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                                {p.note || '—'} · {fmtDateTime(p.createdAt)}
                                {srcWallet && <span style={{ marginLeft: 6, color: 'var(--accent)' }}>· {srcWallet.name}</span>}
                              </div>
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

          {/* Distribute card — only on All tab */}
          {activeTab === 'all' && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="distribute" size={13} />Distribute to Workers
              </div>

              {/* Step 0 — Source Wallet */}
              {wallets.length > 0 && (
                <div className="dist-step">
                  <div className="dist-step-num">0</div>
                  <div className="dist-step-body">
                    <div className="dist-step-label">Select source wallet</div>
                    <select className="inp" style={{ width: 220 }} value={distWalletId} onChange={(e) => setDistWalletId(e.target.value)}>
                      <option value="">— Select wallet —</option>
                      {wallets.map((w) => {
                        const s = walletStats(w.id);
                        return <option key={w.id} value={w.id}>{w.name} ({fmt(s.balance)} $ available)</option>;
                      })}
                    </select>
                  </div>
                </div>
              )}

              {/* Step 1 — Amount & Mode */}
              <div className="dist-step">
                <div className="dist-step-num">{wallets.length > 0 ? 1 : 1}</div>
                <div className="dist-step-body">
                  <div className="dist-step-label">How much to distribute?</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border-inp)', borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
                      <button
                        className={`btn btn-sm ${distMode === 'pct' ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ borderRadius: 0, border: 'none', padding: '6px 12px' }}
                        onClick={() => setDistMode('pct')}
                      >% of Wallet</button>
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
                        placeholder={distMode === 'pct' ? '0 – 100' : `max ${fmt(distBase)}`}
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
                        <span style={{ fontSize: 11, color: 'var(--text-hint)' }}>Amount:</span>
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
                      {distWalletId && (() => {
                        const w = wallets.find((x) => x.id === distWalletId);
                        const s = walletStats(distWalletId);
                        return w ? (
                          <div className="dist-summary-item">
                            <span className="dist-summary-label">Wallet</span>
                            <span className="dist-summary-value" style={{ color: 'var(--accent)' }}>{w.name} ({fmt(s.balance)} $)</span>
                          </div>
                        ) : null;
                      })()}
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
            </div>
          )}

          {/* Filter Bar */}
          <div className="filter-bar" style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="date" className="inp inp-sm" style={{ width: 140 }} value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
            <span style={{ fontSize: 12, color: 'var(--text-hint)' }}>to</span>
            <input type="date" className="inp inp-sm" style={{ width: 140 }} value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
            {activeTab === 'all' && (
              <select className="inp inp-sm" value={filterWorker} onChange={(e) => setFilterWorker(e.target.value)} style={{ width: 140 }}>
                <option value="all">All Workers</option>
                {deliveryMen.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            )}
            <select className="inp inp-sm" value={filterType} onChange={(e) => setFilterType(e.target.value as 'all' | 'debit' | 'credit')} style={{ width: 120 }}>
              <option value="all">All Types</option>
              <option value="debit">Debit</option>
              <option value="credit">Credit</option>
            </select>
            <select className="inp inp-sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as 'all' | 'pending' | 'paid')} style={{ width: 120 }}>
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
            </select>
            <button className="btn btn-ghost btn-sm" onClick={() => { setFilterFrom(''); setFilterTo(''); setFilterWorker('all'); setFilterType('all'); setFilterStatus('all'); }}>
              Reset Filters
            </button>
          </div>

          {/* Transaction Log */}
          <div className="card">
            <div className="card-title">
              Transaction Log
              {isWorkerTab && (
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>— {deliveryMen.find((d) => d.id === activeTab)?.name ?? activeTab}</span>
              )}
            </div>
            {visiblePayouts.length === 0
              ? <div className="empty-state"><div className="empty-icon"><Icon name="money" size={28} /></div>No transactions found.</div>
              : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Target</th>
                        <th>Wallet</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Note</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {visiblePayouts.map((p) => {
                        const isAdd = p.type === 'credit';
                        const srcWallet = p.walletId ? wallets.find((w) => w.id === p.walletId) : null;
                        return (
                          <tr key={p.id}>
                            <td><span className="tag">{fmtDateTime(p.createdAt)}</span></td>
                            <td style={{ fontWeight: 500 }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <Icon name={p.workerId === POOL_ID || p.workerId === WALLET_ADJ ? 'pool' : 'workers'} size={13} color="var(--text-hint)" />
                                {entryTarget(p)}
                              </span>
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{srcWallet?.name ?? '—'}</td>
                            <td>
                              <span className={`badge ${entryBadge(p)}`}>{entryBadgeLabel(p)}</span>
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
      )}
    </>
  );
}
