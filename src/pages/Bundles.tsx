import { useState } from 'react';
import Icon from '@/components/Icon';
import { useVaultStore } from '@/lib/store';
import { useModal } from '@/context/ModalContext';
import { fmt } from '@/lib/utils';
import type { BundleItem } from '@/lib/types';

export default function Bundles() {
  const storeItems   = useVaultStore((s) => s.items);
  const bundles      = useVaultStore((s) => s.bundles);
  const settings     = useVaultStore((s) => s.settings);
  const addBundle    = useVaultStore((s) => s.addBundle);
  const updateBundle = useVaultStore((s) => s.updateBundle);
  const deleteBundle = useVaultStore((s) => s.deleteBundle);
  const { showConfirm } = useModal();

  const [editId,      setEditId]      = useState<string | null>(null);
  const [name,        setName]        = useState('');
  const [formItems,   setFormItems]   = useState<BundleItem[]>([]);
  const [expandedId,  setExpandedId]  = useState<string | null>(null);

  function clearForm() {
    setEditId(null);
    setName('');
    setFormItems([]);
  }

  function startEdit(id: string) {
    const b = bundles.find((x) => x.id === id);
    if (!b) return;
    setEditId(id);
    setName(b.name);
    setFormItems(b.items.map((bi) => ({ ...bi })));
  }

  function addFormItem(itemId: string) {
    if (!itemId) return;
    setFormItems((prev) => {
      const ex = prev.find((bi) => bi.itemId === itemId);
      return ex
        ? prev.map((bi) => bi.itemId === itemId ? { ...bi, qty: bi.qty + 1 } : bi)
        : [...prev, { itemId, qty: 1 }];
    });
  }

  function changeFormQty(itemId: string, val: string) {
    const qty = val === '' ? 0 : Math.max(0, parseInt(val) || 0);
    setFormItems((prev) => prev.map((bi) => bi.itemId === itemId ? { ...bi, qty } : bi));
  }

  function removeFormItem(itemId: string) {
    setFormItems((prev) => prev.filter((bi) => bi.itemId !== itemId));
  }

  function bundleTotal(items: BundleItem[]) {
    return items.reduce((sum, bi) => {
      const it = storeItems.find((i) => i.id === bi.itemId);
      return sum + (it?.price ?? 0) * bi.qty;
    }, 0);
  }

  function save() {
    if (!name.trim()) { alert('Bundle name required'); return; }
    const validItems = formItems.filter((bi) => bi.qty > 0);
    if (!validItems.length) { alert('Add at least one item with qty > 0'); return; }
    if (editId) {
      updateBundle(editId, { name: name.trim(), items: validItems });
    } else {
      addBundle({ name: name.trim(), items: validItems });
    }
    clearForm();
  }

  function handleDelete(id: string) {
    const b = bundles.find((x) => x.id === id);
    if (!b) return;
    if (settings.confirmdelete) {
      showConfirm('Delete bundle', `Delete "${b.name}"?`, () => deleteBundle(id));
    } else {
      deleteBundle(id);
    }
  }

  const cats = [...new Set(storeItems.map((i) => i.category || 'Other'))].sort();
  const formTotal = bundleTotal(formItems);

  return (
    <>
      <div className="section-title"><Icon name="bundles" size={18} style={{ marginRight: 8 }} />Bundles Management</div>

      <div className="grid-2" style={{ alignItems: 'start', marginBottom: 20 }}>

        {/* Form */}
        <div className="card">
          <div className="card-title">{editId ? 'Edit Bundle' : 'Add Bundle'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            <div className="field">
              <label>Bundle Name</label>
              <input className="inp" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Family Meal" />
            </div>

            {/* Item picker */}
            <div className="field">
              <label>Add Item</label>
              <select className="inp" value="" onChange={(e) => { addFormItem(e.target.value); e.target.value = ''; }}>
                <option value="">+ Add item to bundle...</option>
                {cats.map((cat) => (
                  <optgroup key={cat} label={cat}>
                    {storeItems.filter((it) => (it.category || 'Other') === cat).map((it) => (
                      <option key={it.id} value={it.id}>{it.name} — {fmt(it.price)} $ USD</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Bundle items list */}
            {formItems.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {formItems.map((bi) => {
                  const it = storeItems.find((i) => i.id === bi.itemId);
                  return (
                    <div key={bi.itemId} className="order-item-row">
                      <div className="item-label">{it?.name ?? '?'}</div>
                      <input className="inp" type="number" min={0} value={bi.qty || ''}
                        style={{ height: 28, fontSize: 12 }}
                        onChange={(e) => changeFormQty(bi.itemId, e.target.value)} />
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text-hint)' }}>@ {fmt(it?.price ?? 0)}</div>
                        <div className="item-subtotal">{fmt((it?.price ?? 0) * bi.qty)} $ USD</div>
                      </div>
                      <button className="btn btn-danger btn-xs btn-icon" onClick={() => removeFormItem(bi.itemId)}>✕</button>
                    </div>
                  );
                })}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 2px', borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Bundle Total</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>{fmt(formTotal)} $ USD</span>
                </div>
              </div>
            )}

            <div className="flex-row" style={{ marginTop: 4 }}>
              <button className="btn btn-primary" onClick={save} style={{ flex: 1 }}>Save Bundle</button>
              <button className="btn btn-ghost btn-sm" onClick={clearForm}>Clear</button>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="card">
          <div className="card-title">All Bundles ({bundles.length})</div>
          {!bundles.length
            ? <div className="empty-state" style={{ padding: '20px 0' }}><div className="empty-icon"><Icon name="bundles" size={28} /></div>No bundles yet.</div>
            : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Name</th><th>Items</th><th>Total</th><th></th></tr>
                  </thead>
                  <tbody>
                    {bundles.map((b) => {
                      const total = bundleTotal(b.items);
                      const isOpen = expandedId === b.id;
                      return (
                        <>
                          <tr key={b.id}>
                            <td style={{ fontWeight: 500 }}>{b.name}</td>
                            <td>
                              <button className={`expand-btn${isOpen ? ' open' : ''}`}
                                onClick={() => setExpandedId(isOpen ? null : b.id)}
                                title="View items">
                                {isOpen ? '▲' : '▼'}
                              </button>
                              <span className="badge badge-info" style={{ marginLeft: 6 }}>
                                {b.items.length} item{b.items.length !== 1 ? 's' : ''}
                              </span>
                            </td>
                            <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{fmt(total)} $ USD</td>
                            <td>
                              <div className="action-group">
                                <button className="btn btn-ghost btn-xs" onClick={() => startEdit(b.id)}>Edit</button>
                                <button className="btn btn-danger btn-xs" onClick={() => handleDelete(b.id)}>×</button>
                              </div>
                            </td>
                          </tr>
                          {isOpen && (
                            <tr key={`${b.id}-exp`}>
                              <td colSpan={4} style={{ padding: '0 12px 10px', background: 'var(--bg-subtle)' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 8 }}>
                                  {b.items.map((bi) => {
                                    const it = storeItems.find((i) => i.id === bi.itemId);
                                    return (
                                      <div key={bi.itemId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0', borderBottom: '1px solid var(--border-row)' }}>
                                        <span style={{ color: 'var(--text-main)' }}>{it?.name ?? '?'} <span className="tag">×{bi.qty}</span></span>
                                        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{fmt((it?.price ?? 0) * bi.qty)} $ USD</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          }
        </div>
      </div>
    </>
  );
}
