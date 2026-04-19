import { useState } from 'react';
import { useVaultStore } from '@/lib/store';
import { useModal } from '@/context/ModalContext';
import { fmt } from '@/lib/utils';

export default function Items() {
  const storeItems   = useVaultStore((s) => s.items);
  const categories   = useVaultStore((s) => s.categories);
  const settings     = useVaultStore((s) => s.settings);
  const addItem      = useVaultStore((s) => s.addItem);
  const updateItem   = useVaultStore((s) => s.updateItem);
  const deleteItem   = useVaultStore((s) => s.deleteItem);
  const addCat       = useVaultStore((s) => s.addCategory);
  const renameCat    = useVaultStore((s) => s.renameCategory);
  const deleteCat    = useVaultStore((s) => s.deleteCategory);
  const { showConfirm } = useModal();

  const [search, setSearch]     = useState('');
  const [editId, setEditId]     = useState<string | null>(null);
  const [name,   setName]       = useState('');
  const [price,  setPrice]      = useState('');
  const [cat,    setCat]        = useState('');
  const [newCat, setNewCat]     = useState('');

  function clearForm() { setEditId(null); setName(''); setPrice(''); setCat(''); }

  function startEdit(id: string) {
    const it = storeItems.find((i) => i.id === id);
    if (!it) return;
    setEditId(id); setName(it.name); setPrice(String(it.price)); setCat(it.category || '');
  }

  function save() {
    if (!name.trim()) { alert('Name required'); return; }
    const p = parseFloat(price);
    if (isNaN(p) || p < 0) { alert('Valid price required'); return; }
    if (editId) {
      updateItem(editId, { name: name.trim(), price: p, category: cat });
    } else {
      addItem({ name: name.trim(), price: p, category: cat });
    }
    clearForm();
  }

  function handleDelete(id: string) {
    const it = storeItems.find((i) => i.id === id);
    if (!it) return;
    if (settings.confirmdelete) {
      showConfirm('Delete item', `Delete "${it.name}"?`, () => deleteItem(id));
    } else {
      deleteItem(id);
    }
  }

  function handleAddCat() {
    if (!newCat.trim()) return;
    if (categories.includes(newCat.trim())) { alert('Category already exists.'); return; }
    addCat(newCat.trim());
    setNewCat('');
  }

  function handleRenameCat(oldName: string) {
    const n = prompt(`Rename "${oldName}" to:`, oldName);
    if (!n || n.trim() === oldName) return;
    if (categories.includes(n.trim())) { alert('Name already exists.'); return; }
    renameCat(oldName, n.trim());
  }

  function handleDeleteCat(name: string) {
    const count = storeItems.filter((i) => i.category === name).length;
    showConfirm('Delete Category',
      `Delete "${name}"?${count > 0 ? ` ${count} item(s) will become Uncategorized.` : ''}`,
      () => deleteCat(name));
  }

  const filtered = storeItems.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.category || '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <div className="section-title">🛒 Items Management</div>

      <div className="grid-2" style={{ alignItems:'start', marginBottom:20 }}>
        {/* Form */}
        <div className="card">
          <div className="card-title">{editId ? 'Edit Item' : 'Add Item'}</div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div className="field"><label>Item Name</label>
              <input className="inp" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Burger" />
            </div>
            <div className="field"><label>Price ($ USD)</label>
              <input className="inp" type="number" min={0} step={0.5} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
            </div>
            <div className="field"><label>Category</label>
              <select className="inp" value={cat} onChange={(e) => setCat(e.target.value)}>
                <option value="">— Select category —</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex-row" style={{ marginTop:4 }}>
              <button className="btn btn-primary" onClick={save} style={{ flex:1 }}>Save Item</button>
              <button className="btn btn-ghost btn-sm" onClick={clearForm}>Clear</button>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="card">
          <div className="card-title">All Items ({storeItems.length})</div>
          <input className="search-box" placeholder="Search..." value={search}
            onChange={(e) => setSearch(e.target.value)} style={{ width:'100%', marginBottom:12 }} />
          {!filtered.length
            ? <div className="empty-state" style={{ padding:'20px 0' }}><div className="empty-icon">🛒</div>No items yet.</div>
            : (
              <div className="table-wrap"><table>
                <thead><tr><th>Name</th><th>Price</th><th>Category</th><th></th></tr></thead>
                <tbody>
                  {filtered.map((it) => (
                    <tr key={it.id}>
                      <td style={{ fontWeight:500 }}>{it.name}</td>
                      <td style={{ fontWeight:700, color:'var(--accent)' }}>{fmt(it.price)} $ USD</td>
                      <td><span className="tag">{it.category || '—'}</span></td>
                      <td><div className="action-group">
                        <button className="btn btn-ghost btn-xs" onClick={() => startEdit(it.id)}>Edit</button>
                        <button className="btn btn-danger btn-xs" onClick={() => handleDelete(it.id)}>×</button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )
          }
        </div>
      </div>

      {/* Category Management */}
      <div className="card">
        <div className="card-title">🏷 Manage Categories</div>
        <div className="cat-add-row">
          <div className="field" style={{ flex:1, margin:0 }}>
            <label>New Category Name</label>
            <input className="inp" placeholder="e.g. Desserts" value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCat()} />
          </div>
          <button className="btn btn-primary" onClick={handleAddCat}>+ Add Category</button>
        </div>
        <div className="category-chips">
          {categories.map((c) => {
            const count = storeItems.filter((i) => i.category === c).length;
            return (
              <div key={c} className="category-chip">
                <span className="cat-chip-name">{c}</span>
                <span className="cat-chip-count">{count} item{count !== 1 ? 's' : ''}</span>
                <button className="btn btn-ghost btn-xs" onClick={() => handleRenameCat(c)}>Edit</button>
                <button className="btn btn-danger btn-xs" onClick={() => handleDeleteCat(c)}>×</button>
              </div>
            );
          })}
          {!categories.length && <div style={{ color:'var(--text-hint)', fontSize:13 }}>No categories yet.</div>}
        </div>
      </div>
    </>
  );
}
