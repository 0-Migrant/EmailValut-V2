import { useState } from 'react';
import { useVaultStore } from '@/lib/store';
import { useModal } from '@/context/ModalContext';
import { fmt } from '@/lib/utils';
import type { PlatformFee } from '@/lib/types';
import Icon from '@/components/Icon';


export default function Settings() {
  const settings = useVaultStore((s) => s.settings);
  const updateSettings = useVaultStore((s) => s.updateSettings);
  const addWallet    = useVaultStore((s) => s.addWallet);
  const removeWallet = useVaultStore((s) => s.removeWallet);
  const updateWallet = useVaultStore((s) => s.updateWallet);
  const [pmLabel,       setPmLabel]      = useState('');
  const [pmDetail,      setPmDetail]     = useState('');
  const [newPlatform,   setNewPlatform]  = useState('');
  const [feePlatform,   setFeePlatform]  = useState('');
  const [feeType,       setFeeType]      = useState<'pct' | 'amount'>('pct');
  const [feeValue,      setFeeValue]     = useState('');
  const [newWalletName,  setNewWalletName]  = useState('');
  const [editingWallet,  setEditingWallet]  = useState<string | null>(null);
  const [editWalletName, setEditWalletName] = useState('');

  const wallets = settings.wallets ?? [];
  const nukeAll = useVaultStore((s) => s.nukeAll);
  const importData = useVaultStore((s) => s.importData);
  const state = useVaultStore((s) => s);
  const { showConfirm } = useModal();

  function exportBackup() {
    const data = JSON.stringify(state, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `instant-play_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        importData(data);
        alert('✅ Data imported successfully!');
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
                <div className="setting-label">Rows Per Page</div>
                <div className="setting-desc">Default number of rows to show in tables</div>
              </div>
              <select className="inp" style={{ width: 80 }} value={settings.rowsperpage} onChange={(e) => updateSettings({ rowsperpage: parseInt(e.target.value) })}>
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
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

          {/* Platform Fees */}
          <div className="card">
            <div className="settings-section-header">
              <div className="settings-section-icon"><Icon name="pdf" size={16} color="#fff" /></div>
              <div className="settings-section-text">
                <div className="settings-section-title">Platform Fees</div>
                <div className="settings-section-sub">Deducted from gross revenue when calculating net earnings</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {(settings.platformFees ?? []).length === 0
                ? <div style={{ fontSize: 13, color: 'var(--text-hint)' }}>No platform fees configured.</div>
                : (settings.platformFees ?? []).map((f) => (
                  <div key={f.platform} className="pm-item">
                    <div className="pm-avatar" style={{ borderRadius: 6 }}>{f.platform.charAt(0)}</div>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{f.platform}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)', marginRight: 4 }}>
                      {f.feeType === 'pct' ? `${f.value}%` : `$${fmt(f.value)}`}
                    </span>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '2px 8px', fontSize: 12 }}
                      onClick={() => {
                        setFeePlatform(f.platform);
                        setFeeType(f.feeType);
                        setFeeValue(String(f.value));
                        updateSettings({ platformFees: (settings.platformFees ?? []).filter((x) => x.platform !== f.platform) });
                      }}
                    ><Icon name="edit" size={11} style={{ marginRight: 3 }} />Edit</button>
                    <button
                      className="btn btn-danger btn-sm"
                      style={{ padding: '2px 8px', fontSize: 12 }}
                      onClick={() => updateSettings({ platformFees: (settings.platformFees ?? []).filter((x) => x.platform !== f.platform) })}
                    ><Icon name="x" size={11} /></button>
                  </div>
                ))
              }
            </div>

            <hr className="fee-add-sep" />

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="field-label">Platform</div>
                <select className="inp" style={{ minWidth: 130 }} value={feePlatform} onChange={(e) => setFeePlatform(e.target.value)}>
                  <option value="">Select platform...</option>
                  {(settings.platforms ?? []).map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="field-label">Fee Type</div>
                <select className="inp" style={{ width: 130 }} value={feeType} onChange={(e) => setFeeType(e.target.value as 'pct' | 'amount')}>
                  <option value="pct">Percentage %</option>
                  <option value="amount">Flat Amount $</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="field-label">Value</div>
                <input
                  className="inp"
                  type="number"
                  min="0"
                  step="0.01"
                  style={{ width: 90 }}
                  placeholder={feeType === 'pct' ? 'e.g. 5' : 'e.g. 2.50'}
                  value={feeValue}
                  onChange={(e) => setFeeValue(e.target.value)}
                />
              </div>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  const val = parseFloat(feeValue);
                  if (!feePlatform || isNaN(val) || val < 0) return;
                  const newFee: PlatformFee = { platform: feePlatform, feeType, value: val };
                  const existing = (settings.platformFees ?? []).filter((x) => x.platform !== feePlatform);
                  updateSettings({ platformFees: [...existing, newFee] });
                  setFeePlatform(''); setFeeValue('');
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
              <button className="btn btn-ghost" onClick={exportBackup}><Icon name="download" size={13} style={{ marginRight: 5 }} />Export JSON Backup</button>
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
    </>
  );
}
