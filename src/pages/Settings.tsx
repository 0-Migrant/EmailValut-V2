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

      <div className="settings-grid">
        <div className="card">
          <div className="card-title">General Preferences</div>
          
          <div className="setting-row">
            <div>
              <div className="setting-label">Show Passwords</div>
              <div className="setting-desc">Always reveal passwords in credentials list</div>
            </div>
            <input type="checkbox" checked={settings.showpass} onChange={(e) => updateSettings({ showpass: e.target.checked })} />
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-label">Confirm Deletions</div>
              <div className="setting-desc">Show confirmation popup before deleting items</div>
            </div>
            <input type="checkbox" checked={settings.confirmdelete} onChange={(e) => updateSettings({ confirmdelete: e.target.checked })} />
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

        <div className="card">
          <div className="card-title">History Retention</div>
          
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
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-title">Data Management</div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          Backup your data locally or import an existing JSON backup. Exported data includes all items, orders, and credentials.
        </p>
        <div className="data-mgmt-row">
          <button className="btn btn-ghost" onClick={exportBackup}><Icon name="download" size={13} style={{ marginRight: 5 }} />Export JSON Backup</button>

          <div style={{ position: 'relative' }}>
            <button className="btn btn-ghost" onClick={() => document.getElementById('import-file')?.click()}><Icon name="pdf" size={13} style={{ marginRight: 5 }} />Import JSON Backup</button>
            <input id="import-file" type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
          </div>

          <button className="btn btn-danger" onClick={handleReset}><Icon name="x" size={13} style={{ marginRight: 5 }} />Factory Reset</button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-title">Order Configuration</div>

        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {/* Payment Methods */}
          <div style={{ flex: 1, minWidth: 280 }}>
            <div className="setting-label" style={{ marginBottom: 8 }}>Payment Methods</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              {(settings.paymentMethods ?? []).map((m) => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-2, var(--bg))' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</div>
                    {m.detail && <div style={{ fontSize: 11, color: 'var(--text-hint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.detail}</div>}
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
              <input
                className="inp"
                placeholder="Label (e.g. PayPal, Binance, USDT)..."
                value={pmLabel}
                onChange={(e) => setPmLabel(e.target.value)}
              />
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
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="setting-label" style={{ marginBottom: 8 }}>Order Platforms</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              {(settings.platforms ?? []).map((p) => (
                <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ flex: 1, fontSize: 13 }}>{p}</span>
                  <button
                    className="btn btn-danger btn-sm"
                    style={{ padding: '2px 8px', fontSize: 12 }}
                    onClick={() => updateSettings({ platforms: settings.platforms.filter((x) => x !== p) })}
                  >×</button>
                </div>
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
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-title">Platform Fees</div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
          Define a fee per platform. This is deducted from gross revenue when calculating net earnings.
        </p>

        {/* Existing fee list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
          {(settings.platformFees ?? []).length === 0
            ? <div style={{ fontSize: 13, color: 'var(--text-hint)' }}>No platform fees configured.</div>
            : (settings.platformFees ?? []).map((f) => (
              <div key={f.platform} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-2, var(--bg))' }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{f.platform}</span>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
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

        {/* Add fee form */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>Platform</div>
            <select className="inp" style={{ minWidth: 130 }} value={feePlatform} onChange={(e) => setFeePlatform(e.target.value)}>
              <option value="">Select platform...</option>
              {(settings.platforms ?? []).map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>Fee Type</div>
            <select className="inp" style={{ width: 110 }} value={feeType} onChange={(e) => setFeeType(e.target.value as 'pct' | 'amount')}>
              <option value="pct">Percentage %</option>
              <option value="amount">Flat Amount $</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>Value</div>
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

      {/* ── Wallets ─────────────────────────────────────────────────────────── */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-title">Wallets</div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
          Named income wallets. Assign payment methods to each wallet — completed orders using that method will automatically count toward that wallet's balance.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 10 }}>
          {wallets.length === 0
            ? <div style={{ fontSize: 13, color: 'var(--text-hint)' }}>No wallets configured. Add one below.</div>
            : wallets.map((w) => {
                const linkedMethods = w.paymentMethods ?? [];
                const allPmLabels = (settings.paymentMethods ?? []).map((m) => m.label);
                return (
                  <div key={w.id} style={{ borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', overflow: 'hidden' }}>
                    {/* Wallet name row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: linkedMethods.length > 0 || editingWallet === w.id ? '1px solid var(--border)' : 'none' }}>
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
                            <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{w.name}</span>
                            <span style={{ fontSize: 11, color: 'var(--text-hint)' }}>{linkedMethods.length} payment method{linkedMethods.length !== 1 ? 's' : ''}</span>
                            <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => { setEditingWallet(w.id); setEditWalletName(w.name); }}>
                              <Icon name="edit" size={11} style={{ marginRight: 3 }} />Rename
                            </button>
                            <button className="btn btn-danger btn-sm" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => removeWallet(w.id)}>×</button>
                          </>
                      }
                    </div>
                    {/* Payment methods assignment */}
                    <div style={{ padding: '8px 12px' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-hint)', marginBottom: 6, fontWeight: 600 }}>PAYMENT METHODS → auto-track order revenue</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {allPmLabels.length === 0
                          ? <span style={{ fontSize: 12, color: 'var(--text-hint)' }}>No payment methods configured yet.</span>
                          : allPmLabels.map((label) => {
                              const active = linkedMethods.includes(label);
                              // Check if this label is already claimed by another wallet
                              const claimedBy = wallets.find((x) => x.id !== w.id && (x.paymentMethods ?? []).includes(label));
                              return (
                                <button
                                  key={label}
                                  className={`btn btn-sm ${active ? 'btn-primary' : 'btn-ghost'}`}
                                  style={{ opacity: claimedBy ? 0.45 : 1, fontSize: 12 }}
                                  title={claimedBy ? `Already assigned to "${claimedBy.name}"` : undefined}
                                  onClick={() => {
                                    if (claimedBy) return; // prevent double-assigning
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
    </>
  );
}
