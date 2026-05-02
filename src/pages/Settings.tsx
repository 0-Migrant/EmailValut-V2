import { useState } from 'react';
import { useVaultStore, flushSave } from '@/lib/store';
import { useModal } from '@/context/ModalContext';
import { fmt } from '@/lib/utils';
import type { PaymentMethodFee } from '@/lib/types';
import Icon from '@/components/Icon';
import SelectDropdown from '@/components/SelectDropdown';

type ExportKey = 'orders' | 'credentials' | 'items' | 'categories' | 'bundles' | 'deliveryMen' | 'clients' | 'payouts' | 'settings' | 'history';

const EXPORT_OPTIONS: { key: ExportKey; label: string; desc: string }[] = [
  { key: 'orders',      label: 'Orders',      desc: 'All order records & statuses' },
  { key: 'credentials', label: 'Credentials', desc: 'Accounts, emails & stock entries' },
  { key: 'items',       label: 'Items',       desc: 'Product catalog & prices' },
  { key: 'categories',  label: 'Categories',  desc: 'Item category list' },
  { key: 'bundles',     label: 'Bundles',     desc: 'Item bundle definitions' },
  { key: 'deliveryMen', label: 'Workers',     desc: 'Worker accounts & credentials' },
  { key: 'clients',     label: 'Clients',     desc: 'Customer profiles & notes' },
  { key: 'payouts',     label: 'Payouts',     desc: 'Worker payout & distribution history' },
  { key: 'settings',    label: 'Settings',    desc: 'All preferences, payment methods, order platforms & wallets' },
  { key: 'history',     label: 'History',     desc: 'Activity & audit log' },
];

export default function Settings() {
  const settings = useVaultStore((s) => s.settings);
  const updateSettings = useVaultStore((s) => s.updateSettings);
  const addWallet    = useVaultStore((s) => s.addWallet);
  const removeWallet = useVaultStore((s) => s.removeWallet);
  const updateWallet = useVaultStore((s) => s.updateWallet);
  const [pmLabel,       setPmLabel]      = useState('');
  const [pmDetail,      setPmDetail]     = useState('');
  const [newPlatform,   setNewPlatform]  = useState('');
  const [feePmLabel,    setFeePmLabel]   = useState('');
  const [feePct,        setFeePct]       = useState('');
  const [feeAmount,     setFeeAmount]    = useState('');
  const [newWalletName,  setNewWalletName]  = useState('');
  const [editingWallet,  setEditingWallet]  = useState<string | null>(null);
  const [editWalletName, setEditWalletName] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportSel, setExportSel] = useState<Record<ExportKey, boolean>>({
    orders: true, credentials: true, items: true, categories: true,
    bundles: true, deliveryMen: true, clients: true, payouts: true,
    settings: true, history: true,
  });

  const wallets = settings.wallets ?? [];
  const nukeAll = useVaultStore((s) => s.nukeAll);
  const importData = useVaultStore((s) => s.importData);
  const state = useVaultStore((s) => s);
  const { showConfirm } = useModal();

  const stateMap = state as unknown as Record<string, unknown>;

  function getCount(key: ExportKey): string {
    if (key === 'settings') {
      const s = settings;
      const parts: string[] = [];
      if (s.paymentMethods?.length) parts.push(`${s.paymentMethods.length} method${s.paymentMethods.length !== 1 ? 's' : ''}`);
      if (s.wallets?.length) parts.push(`${s.wallets.length} wallet${s.wallets.length !== 1 ? 's' : ''}`);
      if (s.platforms?.length) parts.push(`${s.platforms.length} platform${s.platforms.length !== 1 ? 's' : ''}`);
      return parts.length ? parts.join(', ') : 'All preferences';
    }
    const v = stateMap[key];
    if (Array.isArray(v)) return v.length > 0 ? String(v.length) : '';
    return '';
  }

  function doExport() {
    const payload: Record<string, unknown> = {};
    for (const { key } of EXPORT_OPTIONS) {
      if (exportSel[key]) payload[key] = stateMap[key];
    }
    const data = JSON.stringify(payload, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `instant-play_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportModal(false);
  }

  function toggleAll(checked: boolean) {
    const next = {} as Record<ExportKey, boolean>;
    for (const { key } of EXPORT_OPTIONS) next[key] = checked;
    setExportSel(next);
  }

  const allSelected = EXPORT_OPTIONS.every(({ key }) => exportSel[key]);
  const noneSelected = EXPORT_OPTIONS.every(({ key }) => !exportSel[key]);

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        importData(data);
        flushSave().then(() => {
          alert('✅ Data imported and saved to cloud successfully!');
        }).catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          alert(`✅ Data imported locally, but cloud save failed: ${msg}\n\nDo NOT refresh — your data is visible now. Try exporting again as backup.`);
        });
      } catch {
        alert('❌ Invalid backup file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleReset() {
    const pass = window.prompt('🔐 Enter admin password to perform Factory Reset:');
    if (pass === null) return;
    if (pass !== 'arerede2000.') {
      alert('❌ Incorrect password. Factory reset cancelled.');
      return;
    }
    showConfirm(
      'Factory Reset',
      'This will DELETE EVERYTHING (Orders, Items, Credentials, Settings). This cannot be undone. Are you absolutely sure?',
      () => {
        nukeAll();
        alert('✅ Instant-Play has been reset.');
      }
    );
  }

  return (
    <>
      <div className="section-title"><Icon name="settings" size={18} style={{ marginRight: 8 }} />System Settings</div>

      {/* Left col: General Prefs, History, Platform Fees, Data Mgmt  |  Right col: Order Config, Wallets */}
      <div className="settings-two-col">

        {/* ── LEFT COLUMN ── */}
        <div className="settings-stack">

          {/* General Preferences */}
          <div className="card">
            <div className="settings-section-header">
              <div className="settings-section-icon"><Icon name="settings" size={16} color="#fff" /></div>
              <div className="settings-section-text">
                <div className="settings-section-title">General Preferences</div>
                <div className="settings-section-sub">Display &amp; behavior defaults</div>
              </div>
            </div>

            <div className="setting-row">
              <div>
                <div className="setting-label">Show Passwords</div>
                <div className="setting-desc">Always reveal passwords in credentials list</div>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={settings.showpass} onChange={(e) => updateSettings({ showpass: e.target.checked })} />
                <span className="toggle-track" />
              </label>
            </div>

            <div className="setting-row">
              <div>
                <div className="setting-label">Confirm Deletions</div>
                <div className="setting-desc">Show confirmation popup before deleting items</div>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={settings.confirmdelete} onChange={(e) => updateSettings({ confirmdelete: e.target.checked })} />
                <span className="toggle-track" />
              </label>
            </div>

            <div className="setting-row">
              <div>
                <div className="setting-label">Hide Resource Accounts in New Order</div>
                <div className="setting-desc">Remove the Resource Accounts section from the New Order page</div>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={!!settings.hideResourceAccounts} onChange={(e) => updateSettings({ hideResourceAccounts: e.target.checked })} />
                <span className="toggle-track" />
              </label>
            </div>

            <div className="setting-row">
              <div>
                <div className="setting-label">Worker Full Access</div>
                <div className="setting-desc">Allow workers to access the full app (except Worker Accounts). Worker Portal remains available.</div>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={!!settings.workerFullAccess} onChange={(e) => updateSettings({ workerFullAccess: e.target.checked })} />
                <span className="toggle-track" />
              </label>
            </div>

            <div className="setting-row">
              <div>
                <div className="setting-label">Worker Offline Delay</div>
                <div className="setting-desc">Seconds to wait after a worker disconnects before marking them offline. Prevents false offline on page refresh.</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  className="inp"
                  type="number"
                  min="0"
                  max="120"
                  style={{ width: 72 }}
                  value={settings.workerOfflineDelay ?? 8}
                  onChange={(e) => updateSettings({ workerOfflineDelay: Math.max(0, parseInt(e.target.value) || 0) })}
                />
                <span style={{ fontSize: 13, color: 'var(--text-hint)' }}>sec</span>
              </div>
            </div>

            <div className="setting-row">
              <div>
                <div className="setting-label">Rows Per Page</div>
                <div className="setting-desc">Default number of rows to show in tables</div>
              </div>
              <SelectDropdown
                value={String(settings.rowsperpage)}
                onChange={(v) => updateSettings({ rowsperpage: parseInt(v) })}
                options={[{ value: '10', label: '10' }, { value: '25', label: '25' }, { value: '50', label: '50' }, { value: '100', label: '100' }]}
                style={{ width: 80 }}
              />
            </div>
          </div>

          {/* History Retention */}
          <div className="card">
            <div className="settings-section-header">
              <div className="settings-section-icon"><Icon name="pdf" size={16} color="#fff" /></div>
              <div className="settings-section-text">
                <div className="settings-section-title">History Retention</div>
                <div className="settings-section-sub">Log storage limits</div>
              </div>
            </div>

            <div className="setting-row">
              <div>
                <div className="setting-label">Retention Period</div>
                <div className="setting-desc">How many days to keep history logs (0 = forever)</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input className="inp" type="number" style={{ width: 80 }} value={settings.historyretention} onChange={(e) => updateSettings({ historyretention: parseInt(e.target.value) })} />
                <span style={{ fontSize: 13, color: 'var(--text-hint)' }}>days</span>
              </div>
            </div>

            <div className="setting-row">
              <div>
                <div className="setting-label">Max Logs Count</div>
                <div className="setting-desc">Maximum number of history entries to keep</div>
              </div>
              <input className="inp" type="number" style={{ width: 80 }} value={settings.historylimit} onChange={(e) => updateSettings({ historylimit: parseInt(e.target.value) })} />
            </div>
          </div>

          {/* Payment Method Fees */}
          <div className="card">
            <div className="settings-section-header">
              <div className="settings-section-icon"><Icon name="pdf" size={16} color="#fff" /></div>
              <div className="settings-section-text">
                <div className="settings-section-title">Payment Method Fees</div>
                <div className="settings-section-sub">Deducted from gross revenue when calculating net earnings</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {(settings.paymentMethodFees ?? []).length === 0
                ? <div style={{ fontSize: 13, color: 'var(--text-hint)' }}>No payment method fees configured.</div>
                : (settings.paymentMethodFees ?? []).map((f) => {
                    const parts = [];
                    if (f.pct != null) parts.push(`${f.pct}%`);
                    if (f.amount != null) parts.push(`$${fmt(f.amount)}`);
                    return (
                      <div key={f.paymentMethod} className="pm-item">
                        <div className="pm-avatar" style={{ borderRadius: 6 }}>{f.paymentMethod.charAt(0)}</div>
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{f.paymentMethod}</span>
                        <span style={{ fontSize: 13, color: 'var(--text-muted)', marginRight: 4 }}>
                          {parts.join(' + ')}
                        </span>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '2px 8px', fontSize: 12 }}
                          onClick={() => {
                            setFeePmLabel(f.paymentMethod);
                            setFeePct(f.pct != null ? String(f.pct) : '');
                            setFeeAmount(f.amount != null ? String(f.amount) : '');
                            updateSettings({ paymentMethodFees: (settings.paymentMethodFees ?? []).filter((x) => x.paymentMethod !== f.paymentMethod) });
                          }}
                        ><Icon name="edit" size={11} style={{ marginRight: 3 }} />Edit</button>
                        <button
                          className="btn btn-danger btn-sm"
                          style={{ padding: '2px 8px', fontSize: 12 }}
                          onClick={() => updateSettings({ paymentMethodFees: (settings.paymentMethodFees ?? []).filter((x) => x.paymentMethod !== f.paymentMethod) })}
                        ><Icon name="x" size={11} /></button>
                      </div>
                    );
                  })
              }
            </div>

            <hr className="fee-add-sep" />

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="field-label">Payment Method</div>
                <SelectDropdown
                  value={feePmLabel}
                  onChange={setFeePmLabel}
                  placeholder="Select method..."
                  options={(settings.paymentMethods ?? []).map((m) => ({ value: m.label, label: m.label }))}
                  style={{ minWidth: 140 }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="field-label">% Fee</div>
                <input
                  className="inp"
                  type="number"
                  min="0"
                  step="0.01"
                  style={{ width: 90 }}
                  placeholder="e.g. 4.4"
                  value={feePct}
                  onChange={(e) => setFeePct(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="field-label">Flat $ Fee</div>
                <input
                  className="inp"
                  type="number"
                  min="0"
                  step="0.01"
                  style={{ width: 90 }}
                  placeholder="e.g. 0.30"
                  value={feeAmount}
                  onChange={(e) => setFeeAmount(e.target.value)}
                />
              </div>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  const pct = feePct !== '' ? parseFloat(feePct) : null;
                  const amt = feeAmount !== '' ? parseFloat(feeAmount) : null;
                  if (!feePmLabel || (pct == null && amt == null)) return;
                  if (pct != null && (isNaN(pct) || pct < 0)) return;
                  if (amt != null && (isNaN(amt) || amt < 0)) return;
                  const newFee: PaymentMethodFee = { paymentMethod: feePmLabel, pct, amount: amt };
                  const existing = (settings.paymentMethodFees ?? []).filter((x) => x.paymentMethod !== feePmLabel);
                  updateSettings({ paymentMethodFees: [...existing, newFee] });
                  setFeePmLabel(''); setFeePct(''); setFeeAmount('');
                }}
              >Save Fee</button>
            </div>
          </div>

          {/* Data Management */}
          <div className="card">
            <div className="settings-section-header">
              <div className="settings-section-icon"><Icon name="download" size={16} color="#fff" /></div>
              <div className="settings-section-text">
                <div className="settings-section-title">Data Management</div>
                <div className="settings-section-sub">Backup, restore, or reset all data</div>
              </div>
            </div>

            <div className="data-mgmt-row" style={{ marginBottom: 12 }}>
              <button className="btn btn-ghost" onClick={() => setShowExportModal(true)}><Icon name="download" size={13} style={{ marginRight: 5 }} />Export JSON Backup</button>
              <div style={{ position: 'relative' }}>
                <button className="btn btn-ghost" onClick={() => document.getElementById('import-file')?.click()}><Icon name="pdf" size={13} style={{ marginRight: 5 }} />Import JSON Backup</button>
                <input id="import-file" type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
              </div>
            </div>

            <div className="danger-zone">
              <div className="danger-zone-text">
                <div className="danger-zone-title">Factory Reset</div>
                <div className="danger-zone-desc">Permanently deletes all orders, items, credentials, and settings. Cannot be undone.</div>
              </div>
              <button className="btn btn-danger" onClick={handleReset}><Icon name="x" size={13} style={{ marginRight: 5 }} />Factory Reset</button>
            </div>
          </div>

        </div>{/* end left column */}

        {/* ── RIGHT COLUMN ── */}
        <div className="settings-stack">

          {/* Order Configuration */}
          <div className="card">
            <div className="settings-section-header">
              <div className="settings-section-icon"><Icon name="edit" size={16} color="#fff" /></div>
              <div className="settings-section-text">
                <div className="settings-section-title">Order Configuration</div>
                <div className="settings-section-sub">Payment methods &amp; platforms</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {/* Payment Methods */}
              <div style={{ flex: 1, minWidth: 220 }}>
                <div className="setting-label" style={{ marginBottom: 10 }}>Payment Methods</div>
                <div className="pm-list">
                  {(settings.paymentMethods ?? []).map((m) => (
                    <div key={m.id} className="pm-item">
                      <div className="pm-avatar">{m.label.charAt(0)}</div>
                      <div className="pm-info">
                        <div className="pm-info-label">{m.label}</div>
                        {m.detail && <div className="pm-info-detail">{m.detail}</div>}
                      </div>
                      <button
                        className="btn btn-danger btn-sm"
                        style={{ padding: '2px 8px', fontSize: 12, flexShrink: 0 }}
                        onClick={() => updateSettings({ paymentMethods: settings.paymentMethods.filter((x) => x.id !== m.id) })}
                      >×</button>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <input className="inp" placeholder="Label (e.g. PayPal, Binance, USDT)..." value={pmLabel} onChange={(e) => setPmLabel(e.target.value)} />
                  <input
                    className="inp"
                    placeholder="Account / address / email / URL..."
                    value={pmDetail}
                    onChange={(e) => setPmDetail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && pmLabel.trim()) {
                        updateSettings({ paymentMethods: [...(settings.paymentMethods ?? []), { id: `pm-${Date.now()}`, label: pmLabel.trim(), detail: pmDetail.trim() }] });
                        setPmLabel(''); setPmDetail('');
                      }
                    }}
                  />
                  <button
                    className="btn btn-ghost"
                    style={{ alignSelf: 'flex-start' }}
                    onClick={() => {
                      if (!pmLabel.trim()) return;
                      updateSettings({ paymentMethods: [...(settings.paymentMethods ?? []), { id: `pm-${Date.now()}`, label: pmLabel.trim(), detail: pmDetail.trim() }] });
                      setPmLabel(''); setPmDetail('');
                    }}
                  >Add</button>
                </div>
              </div>

              {/* Order Platforms */}
              <div style={{ flex: 1, minWidth: 160 }}>
                <div className="setting-label" style={{ marginBottom: 10 }}>Order Platforms</div>
                <div className="platform-chips">
                  {(settings.platforms ?? []).map((p) => (
                    <span key={p} className="platform-chip">
                      {p}
                      <button
                        className="platform-chip-remove"
                        onClick={() => updateSettings({ platforms: settings.platforms.filter((x) => x !== p) })}
                        title={`Remove ${p}`}
                      >×</button>
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    className="inp"
                    style={{ flex: 1 }}
                    placeholder="New platform..."
                    value={newPlatform}
                    onChange={(e) => setNewPlatform(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newPlatform.trim()) {
                        updateSettings({ platforms: [...(settings.platforms ?? []), newPlatform.trim()] });
                        setNewPlatform('');
                      }
                    }}
                  />
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      if (!newPlatform.trim()) return;
                      updateSettings({ platforms: [...(settings.platforms ?? []), newPlatform.trim()] });
                      setNewPlatform('');
                    }}
                  >Add</button>
                </div>
              </div>
            </div>
          </div>

          {/* Wallets */}
          <div className="card">
            <div className="settings-section-header">
              <div className="settings-section-icon"><Icon name="settings" size={16} color="#fff" /></div>
              <div className="settings-section-text">
                <div className="settings-section-title">Wallets</div>
                <div className="settings-section-sub">Named income wallets — auto-track revenue by payment method</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
              {wallets.length === 0
                ? <div style={{ fontSize: 13, color: 'var(--text-hint)' }}>No wallets configured. Add one below.</div>
                : wallets.map((w) => {
                    const linkedMethods = w.paymentMethods ?? [];
                    const allPmLabels = (settings.paymentMethods ?? []).map((m) => m.label);
                    return (
                      <div key={w.id} style={{ borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-subtle)', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                          {editingWallet === w.id
                            ? <>
                                <input
                                  className="inp"
                                  style={{ flex: 1 }}
                                  value={editWalletName}
                                  onChange={(e) => setEditWalletName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && editWalletName.trim()) { updateWallet(w.id, { name: editWalletName.trim() }); setEditingWallet(null); }
                                    if (e.key === 'Escape') setEditingWallet(null);
                                  }}
                                  autoFocus
                                />
                                <button className="btn btn-primary btn-sm" onClick={() => { if (editWalletName.trim()) { updateWallet(w.id, { name: editWalletName.trim() }); setEditingWallet(null); } }}>Save</button>
                                <button className="btn btn-ghost btn-sm" onClick={() => setEditingWallet(null)}>Cancel</button>
                              </>
                            : <>
                                <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{w.name}</span>
                                <span style={{ fontSize: 11, color: 'var(--text-hint)' }}>{linkedMethods.length} method{linkedMethods.length !== 1 ? 's' : ''}</span>
                                <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => { setEditingWallet(w.id); setEditWalletName(w.name); }}>
                                  <Icon name="edit" size={11} style={{ marginRight: 3 }} />Rename
                                </button>
                                <button className="btn btn-danger btn-sm" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => removeWallet(w.id)}>×</button>
                              </>
                          }
                        </div>
                        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                          <div className="field-label" style={{ marginBottom: 8 }}>Distribution Fee</div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <input
                                className="inp inp-sm"
                                type="number"
                                min="0"
                                step="0.01"
                                style={{ width: 80 }}
                                placeholder="0"
                                value={w.distFeePct ?? ''}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  updateWallet(w.id, { distFeePct: raw === '' ? null : parseFloat(raw) || null });
                                }}
                              />
                              <span style={{ fontSize: 12, color: 'var(--text-hint)' }}>%</span>
                            </div>
                            <span style={{ fontSize: 12, color: 'var(--text-hint)' }}>+</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <input
                                className="inp inp-sm"
                                type="number"
                                min="0"
                                step="0.01"
                                style={{ width: 80 }}
                                placeholder="0"
                                value={w.distFeeAmount ?? ''}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  updateWallet(w.id, { distFeeAmount: raw === '' ? null : parseFloat(raw) || null });
                                }}
                              />
                              <span style={{ fontSize: 12, color: 'var(--text-hint)' }}>$</span>
                            </div>
                            {((w.distFeePct ?? 0) > 0 || (w.distFeeAmount ?? 0) > 0) && (
                              <span style={{ fontSize: 11, color: 'var(--text-hint)' }}>charged per distribution</span>
                            )}
                          </div>
                        </div>
                        <div style={{ padding: '10px 12px' }}>
                          <div className="field-label" style={{ marginBottom: 8 }}>Assign payment methods</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {allPmLabels.length === 0
                              ? <span style={{ fontSize: 12, color: 'var(--text-hint)' }}>No payment methods configured yet.</span>
                              : allPmLabels.map((label) => {
                                  const active = linkedMethods.includes(label);
                                  const claimedBy = wallets.find((x) => x.id !== w.id && (x.paymentMethods ?? []).includes(label));
                                  return (
                                    <button
                                      key={label}
                                      className={`btn btn-sm pm-toggle ${active ? 'btn-primary' : 'btn-ghost'}`}
                                      style={{ opacity: claimedBy ? 0.45 : 1, fontSize: 12 }}
                                      title={claimedBy ? `Already assigned to "${claimedBy.name}"` : undefined}
                                      onClick={() => {
                                        if (claimedBy) return;
                                        const next = active
                                          ? linkedMethods.filter((x) => x !== label)
                                          : [...linkedMethods, label];
                                        updateWallet(w.id, { paymentMethods: next });
                                      }}
                                    >
                                      {label}{active ? ' ✓' : ''}
                                    </button>
                                  );
                                })
                            }
                          </div>
                        </div>
                      </div>
                    );
                  })
              }
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <input
                className="inp"
                style={{ flex: 1 }}
                placeholder="Wallet name (e.g. PayPal, Website, Reserve)..."
                value={newWalletName}
                onChange={(e) => setNewWalletName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newWalletName.trim()) { addWallet({ name: newWalletName.trim(), paymentMethods: [] }); setNewWalletName(''); }
                }}
              />
              <button
                className="btn btn-ghost"
                onClick={() => {
                  if (!newWalletName.trim()) return;
                  addWallet({ name: newWalletName.trim(), paymentMethods: [] });
                  setNewWalletName('');
                }}
              >Add Wallet</button>
            </div>
          </div>

        </div>{/* end right column */}

      </div>

      {/* Export Selection Modal */}
      {showExportModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.45)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowExportModal(false); }}
        >
          <div style={{
            background: 'var(--modal-bg)', borderRadius: 12, width: '100%',
            maxWidth: 420, boxShadow: '0 8px 32px var(--shadow)',
            border: '1px solid var(--border)', overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Export Backup</div>
                <div style={{ fontSize: 12, color: 'var(--text-hint)', marginTop: 2 }}>Choose which data to include</div>
              </div>
              <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }} onClick={() => setShowExportModal(false)}>
                <Icon name="x" size={14} />
              </button>
            </div>

            {/* Select all toggle */}
            <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = !allSelected && !noneSelected; }}
                  onChange={(e) => toggleAll(e.target.checked)}
                  style={{ width: 15, height: 15, accentColor: 'var(--accent)', cursor: 'pointer' }}
                />
                Select All
              </label>
              <span style={{ fontSize: 11, color: 'var(--text-hint)' }}>
                {EXPORT_OPTIONS.filter(({ key }) => exportSel[key]).length} / {EXPORT_OPTIONS.length} selected
              </span>
            </div>

            {/* Checkboxes */}
            <div style={{ padding: '8px 20px', display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 340, overflowY: 'auto' }}>
              {EXPORT_OPTIONS.map(({ key, label, desc }) => {
                const count = getCount(key);
                return (
                  <label
                    key={key}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 10px', borderRadius: 8, cursor: 'pointer',
                      background: exportSel[key] ? 'var(--bg-subtle)' : 'transparent',
                      transition: 'background 0.15s',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={exportSel[key]}
                      onChange={(e) => setExportSel((prev) => ({ ...prev, [key]: e.target.checked }))}
                      style={{ width: 15, height: 15, accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 1 }}>{desc}</div>
                    </div>
                    {count && (
                      <span style={{
                        fontSize: 11, fontWeight: 600, color: 'var(--accent)',
                        background: 'rgba(24,95,165,0.08)', borderRadius: 6,
                        padding: '2px 7px', whiteSpace: 'nowrap', flexShrink: 0,
                      }}>
                        {count}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowExportModal(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                disabled={noneSelected}
                onClick={doExport}
              >
                <Icon name="download" size={13} style={{ marginRight: 5 }} />Export Selected
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
