import { useState } from 'react';
import React from 'react';
import { useVaultStore } from '@/lib/store';
import { useModal } from '@/context/ModalContext';
import { fmtDate } from '@/lib/utils';

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

  const [expandingCred, setExpandingCred] = useState<string | null>(null);
  const [newStockName, setNewStockName] = useState('');
  const [newStockQty, setNewStockQty] = useState('');

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

  const filtered = credentials.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

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

          {!filtered.length ? (
            <div className="empty-state" style={{ padding: '20px 0' }}><div className="empty-icon">🔒</div>No credentials found.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button className={`expand-btn ${expandingCred === c.id ? 'open' : ''}`} onClick={() => setExpandingCred(expandingCred === c.id ? null : c.id)}>
                              {expandingCred === c.id ? '▼' : '▶'}
                            </button>
                            <span style={{ fontWeight: 600 }}>{c.name}</span>
                          </div>
                        </td>
                        <td style={{ fontSize: 13 }}>{c.email}</td>
                        <td>
                          {showAllPass ? (
                            <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{c.pass}</span>
                          ) : (
                            <span className="pass-mask">••••••••</span>
                          )}
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
                          <td colSpan={5} className="stock-panel">
                            <div className="stock-panel-header">
                              <span className="stock-panel-title">Resource Stocks</span>
                            </div>
                            <div className="stock-list">
                              {!c.stocks.length ? (
                                <div className="stock-empty">No stocks added yet.</div>
                              ) : (
                                c.stocks.map((s) => (
                                  <div key={s.id} className="stock-item">
                                    <span className="stock-name">{s.name}</span>
                                    <span className="stock-qty">{s.qty}</span>
                                    <div className="stock-spacer"></div>
                                    <button className="btn btn-danger btn-xs btn-icon" onClick={() => deleteStock(c.id, s.id)}>✕</button>
                                  </div>
                                ))
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
