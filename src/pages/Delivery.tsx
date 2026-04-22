import { useState } from 'react';
import { useVaultStore } from '@/lib/store';
import { useModal } from '@/context/ModalContext';
import { fmt, orderTotal } from '@/lib/utils';
import Icon from '@/components/Icon';

export default function Delivery() {
  const deliveryMen  = useVaultStore((s) => s.deliveryMen);
  const orders       = useVaultStore((s) => s.orders);
  const settings     = useVaultStore((s) => s.settings);
  const addDM        = useVaultStore((s) => s.addDeliveryMan);
  const updateDM     = useVaultStore((s) => s.updateDeliveryMan);
  const deleteDM     = useVaultStore((s) => s.deleteDeliveryMan);
  const { showConfirm } = useModal();

  const [editId, setEditId] = useState<string | null>(null);
  const [name,   setName]   = useState('');

  function startEdit(id: string) {
    const dm = deliveryMen.find((d) => d.id === id);
    if (!dm) return;
    setEditId(id); setName(dm.name);
  }

  function save() {
    if (!name.trim()) { alert('Name required'); return; }
    if (editId) {
      updateDM(editId, { name: name.trim() });
    } else {
      addDM({ name: name.trim() });
    }
    setEditId(null); setName('');
  }

  function handleDelete(id: string) {
    const dm = deliveryMen.find((d) => d.id === id);
    if (!dm) return;
    if (settings.confirmdelete) {
      showConfirm('Delete', `Delete "${dm.name}"?`, () => deleteDM(id));
    } else {
      deleteDM(id);
    }
  }

  return (
    <>
      <div className="section-title"><Icon name="workers" size={18} style={{ marginRight: 8 }} />Workers</div>
      <div className="grid-2" style={{ alignItems:'start' }}>
        <div className="card">
          <div className="card-title">{editId ? 'Edit Worker' : 'Add Worker'}</div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div className="field">
              <label>Full Name</label>
              <input className="inp" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ahmed Hassan"
                onKeyDown={(e) => e.key === 'Enter' && save()} />
            </div>
            <div className="flex-row" style={{ marginTop:4 }}>
              <button className="btn btn-primary" onClick={save} style={{ flex:1 }}>Save</button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setEditId(null); setName(''); }}>Clear</button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">All Workers ({deliveryMen.length})</div>
          {!deliveryMen.length
            ? <div className="empty-state" style={{ padding:'20px 0' }}><div className="empty-icon"><Icon name="workers" size={28} /></div>No workers yet.</div>
            : (
              <div className="table-wrap"><table>
                <thead><tr><th>Name</th><th>Orders</th><th>Revenue</th><th></th></tr></thead>
                <tbody>
                  {deliveryMen.map((dm) => {
                    const done = orders.filter((o) => o.deliveryManId === dm.id && o.status === 'done');
                    const rev  = done.reduce((a, o) => a + orderTotal(o), 0);
                    return (
                      <tr key={dm.id}>
                        <td style={{ fontWeight:500 }}>{dm.name}</td>
                        <td><span className="badge badge-info">{done.length}</span></td>
                        <td style={{ fontWeight:700, color:'var(--green)' }}>{fmt(rev)} $ USD</td>
                        <td><div className="action-group">
                          <button className="btn btn-ghost btn-xs" onClick={() => startEdit(dm.id)}>Edit</button>
                          <button className="btn btn-danger btn-xs" onClick={() => handleDelete(dm.id)}><Icon name="trash" size={11} /></button>
                        </div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            )
          }
        </div>
      </div>
    </>
  );
}
