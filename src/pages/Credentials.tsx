import { useState } from 'react';
import React from 'react';
import { useVaultStore } from '@/lib/store';
import { useModal } from '@/context/ModalContext';
import { fmtDate } from '@/lib/utils';
import { generateCredentialsPDF } from '@/lib/pdf';

export default function Credentials() {
  const credentials = useVaultStore((s) => s.credentials);
  const settings = useVaultStore((s) => s.settings);
  const addCredential = useVaultStore((s) => s.addCredential);
  const updateCredential = useVaultStore((s) => s.updateCredential);
  const deleteCredential = useVaultStore((s) => s.deleteCredential);
  const addStock = useVaultStore((s) => s.addStock);
  const updateStock = useVaultStore((s) => s.updateStock);
  const deleteStock = useVaultStore((s) => s.deleteStock);
  const { showConfirm } = useModal();

  const [search, setSearch] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [showAllPass, setShowAllPass] = useState(settings.showpass);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [expandingCred, setExpandingCred] = useState<string | null>(null);
  const [newStockName, setNewStockName] = useState('');
  const [newStockQty, setNewStockQty] = useState('');
  const [editingStockQty, setEditingStockQty] = useState<Record<string, string>>({});

  function clearForm() {
    setEditId(null);
    setName('');
    setEmail('');
    setPass('');
  }

  function startEdit(id: string) {
    const c = credentials.find((x) => x.id === id);
    if (!c) return;
    setEditId(id);
    setName(c.name);
    setEmail(c.email);
    setPass(c.pass);
  }

  function save() {
    if (!name.trim() || !email.trim() || !pass.trim()) {
      alert('All fields required');
      return;
    }
    if (editId) {
      updateCredential(editId, { name: name.trim(), email: email.trim(), pass: pass.trim() });
    } else {
      addCredential({ name: name.trim(), email: email.trim(), pass: pass.trim() });
    }
    clearForm();
  }

  function handleDelete(id: string) {
    const c = credentials.find((x) => x.id === id);
    if (!c) return;
    if (settings.confirmdelete) {
      showConfirm('Delete Credential', `Delete "${c.name}"?`, () => deleteCredential(id));
    } else {
      deleteCredential(id);
    }
  }

  function handleAddStock(credId: string) {
    if (!newStockName.trim()) return;
    const qty = parseInt(newStockQty) || 0;
    addStock(credId, { name: newStockName.trim(), qty });
    setNewStockName('');
    setNewStockQty('');
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      if (filtered.length > 0 && filtered.every((c) => prev.has(c.id))) {
        return new Set();
      }
      return new Set(filtered.map((c) => c.id));
    });
  }

  async function copyText(value: string, label: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedKey(label);
      window.setTimeout(() => setCopiedKey(null), 1200);
    } catch {
      alert('Failed to copy to clipboard.');
    }
  }

  function downloadCredentials(useSelected: boolean) {
    const exported = (useSelected ? credentials.filter((c) => selectedIds.has(c.id)) : credentials);

    if (!exported.length) {
      alert('No credentials selected to download.');
      return;
    }

    generateCredentialsPDF(exported);
  }

  const filtered = credentials.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  const allSelected = filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id));

  return (
    <>
      <div className="section-title">🔒 Credentials Management</div>

      <div className="grid-2" style={{ alignItems: 'start', marginBottom: 20 }}>
        <div className="card">
          <div className="card-title">{editId ? 'Edit Credential' : 'Add Credential'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="field">
              <label>Service Name</label>
              <input className="inp" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Gmail" />
            </div>
            <div className="field">
              <label>Email / Username</label>
              <input className="inp" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. user@gmail.com" />
            </div>
            <div className="field">
              <label>Password</label>
              <input className="inp" type="text" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Secret password" />
            </div>
            <div className="flex-row" style={{ marginTop: 4 }}>
              <button className="btn btn-primary" onClick={save} style={{ flex: 1 }}>Save</button>
              <button className="btn btn-ghost btn-sm" onClick={clearForm}>Clear</button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">All Credentials ({credentials.length})</div>
          <div className="flex-row" style={{ marginBottom: 16 }}>
            <input className="search-box" style={{ flex: 1 }} placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <button className={`btn btn-sm ${showAllPass ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setShowAllPass(!showAllPass)}>
              {showAllPass ? '🙈 Hide All' : '👁 Show All'}
            </button>
          </div>
          <div className="flex-row" style={{ marginBottom: 16, gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => downloadCredentials(false)}>
              � Download All (PDF)
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => downloadCredentials(true)}
              disabled={!selectedIds.size}
            >
              📄 Download Selected ({selectedIds.size}) (PDF)
            </button>
            <button className="btn btn-ghost btn-sm" onClick={toggleSelectAll}>
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
            <div style={{ flex: 1 }} />
          </div>

          {!filtered.length ? (
            <div className="empty-state" style={{ padding: '20px 0' }}><div className="empty-icon">🔒</div>No credentials found.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>
                      <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                    </th>
                    <th>Service</th>
                    <th>User / Email</th>
                    <th>Password</th>
                    <th>Added</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <React.Fragment key={c.id}>
                      <tr>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(c.id)}
                            onChange={() => toggleSelect(c.id)}
                          />
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button className={`expand-btn ${expandingCred === c.id ? 'open' : ''}`} onClick={() => setExpandingCred(expandingCred === c.id ? null : c.id)}>
                              {expandingCred === c.id ? '▼' : '▶'}
                            </button>
                            <span style={{ fontWeight: 600 }}>{c.name}</span>
                          </div>
                        </td>
                        <td style={{ fontSize: 13 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>{c.email}</span>
                            <button
                              type="button"
                              className={`copy-btn ${copiedKey === `email-${c.id}` ? 'copied' : ''}`}
                              onClick={() => copyText(c.email, `email-${c.id}`)}
                              title="Copy email"
                            >
                              📋
                            </button>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {showAllPass ? (
                              <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{c.pass}</span>
                            ) : (
                              <span className="pass-mask">••••••••</span>
                            )}
                            <button
                              type="button"
                              className={`copy-btn ${copiedKey === `pass-${c.id}` ? 'copied' : ''}`}
                              onClick={() => copyText(c.pass, `pass-${c.id}`)}
                              title="Copy password"
                            >
                              📋
                            </button>
                          </div>
                        </td>
                        <td><span className="tag">{fmtDate(c.added)}</span></td>
                        <td>
                          <div className="action-group">
                            <button className="btn btn-ghost btn-xs" onClick={() => startEdit(c.id)}>Edit</button>
                            <button className="btn btn-danger btn-xs" onClick={() => handleDelete(c.id)}>×</button>
                          </div>
                        </td>
                      </tr>
                      {expandingCred === c.id && (
                        <tr>
                          <td colSpan={6} className="stock-panel">
                            <div className="stock-panel-header">
                              <span className="stock-panel-title">Resource Stocks</span>
                            </div>
                            <div className="stock-list">
                              {!c.stocks.length ? (
                                <div className="stock-empty">No stocks added yet.</div>
                              ) : (
                                c.stocks.map((s) => {
                                  const key = `${c.id}-${s.id}`;
                                  const editing = editingStockQty[key] !== undefined;
                                  return (
                                    <div key={s.id} className="stock-item">
                                      <span className="stock-name">{s.name}</span>
                                      <button className="btn btn-ghost btn-xs btn-icon" onClick={() => updateStock(c.id, s.id, { qty: Math.max(0, s.qty - 1) })}>−</button>
                                      {editing ? (
                                        <input
                                          className="stock-inp stock-inp-qty"
                                          type="number"
                                          value={editingStockQty[key]}
                                          autoFocus
                                          onChange={(e) => setEditingStockQty((prev) => ({ ...prev, [key]: e.target.value }))}
                                          onBlur={() => {
                                            const v = parseInt(editingStockQty[key]);
                                            if (!isNaN(v)) updateStock(c.id, s.id, { qty: Math.max(0, v) });
                                            setEditingStockQty((prev) => { const n = { ...prev }; delete n[key]; return n; });
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                            if (e.key === 'Escape') setEditingStockQty((prev) => { const n = { ...prev }; delete n[key]; return n; });
                                          }}
                                        />
                                      ) : (
                                        <span className="stock-qty" style={{ cursor: 'pointer', textDecoration: 'underline dotted' }} title="Click to edit" onClick={() => setEditingStockQty((prev) => ({ ...prev, [key]: String(s.qty) }))}>{s.qty}</span>
                                      )}
                                      <button className="btn btn-ghost btn-xs btn-icon" onClick={() => updateStock(c.id, s.id, { qty: s.qty + 1 })}>+</button>
                                      <div className="stock-spacer"></div>
                                      <button className="btn btn-danger btn-xs btn-icon" onClick={() => deleteStock(c.id, s.id)}>✕</button>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                            <div className="stock-add-form">
                              <input className="stock-inp stock-inp-name" placeholder="Stock Name" value={newStockName} onChange={(e) => setNewStockName(e.target.value)} />
                              <input className="stock-inp stock-inp-qty" type="number" placeholder="Qty" value={newStockQty} onChange={(e) => setNewStockQty(e.target.value)} />
                              <button className="btn btn-ghost btn-xs" onClick={() => handleAddStock(c.id)}>+ Add Stock</button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
