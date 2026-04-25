import { useState } from 'react';
import { useVaultStore } from '@/lib/store';
import { useModal } from '@/context/ModalContext';
import { getLoyaltyTier, LOYALTY_TIERS } from '@/lib/utils';
import Icon from '@/components/Icon';

export default function Clients() {
  const clients     = useVaultStore((s) => s.clients);
  const orders      = useVaultStore((s) => s.orders);
  const addClient   = useVaultStore((s) => s.addClient);
  const updateClient = useVaultStore((s) => s.updateClient);
  const deleteClient = useVaultStore((s) => s.deleteClient);
  const settings    = useVaultStore((s) => s.settings);
  const { showConfirm } = useModal();

  const [editId, setEditId] = useState<string | null>(null);
  const [name,   setName]   = useState('');
  const [note,   setNote]   = useState('');
  const [search, setSearch] = useState('');

  function startEdit(id: string) {
    const c = clients.find((x) => x.id === id);
    if (!c) return;
    setEditId(id);
    setName(c.name);
    setNote(c.note ?? '');
  }

  function clearForm() {
    setEditId(null);
    setName('');
    setNote('');
  }

  function save() {
    if (!name.trim()) { alert('Client name is required'); return; }
    const duplicate = clients.some(
      (c) => c.name.toLowerCase() === name.trim().toLowerCase() && c.id !== editId
    );
    if (duplicate) { alert('A client with that name already exists'); return; }
    if (editId) {
      updateClient(editId, { name: name.trim(), note: note.trim() || undefined });
    } else {
      addClient({ name: name.trim(), note: note.trim() || undefined });
    }
    clearForm();
  }

  function handleDelete(id: string) {
    const c = clients.find((x) => x.id === id);
    if (!c) return;
    if (settings.confirmdelete) {
      showConfirm('Delete Client', `Delete client "${c.name}"?`, () => deleteClient(id));
    } else {
      deleteClient(id);
    }
  }

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.note ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <div className="section-title">
        <Icon name="clients" size={18} style={{ marginRight: 8 }} />Clients
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Add / Edit form */}
        <div className="card">
          <div className="card-title">{editId ? 'Edit Client' : 'Add Client'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="field">
              <label>Name <span style={{ fontSize: 11, color: 'var(--text-hint)' }}>(used as Customer ID in orders)</span></label>
              <input
                className="inp"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. JOJO"
                onKeyDown={(e) => e.key === 'Enter' && save()}
              />
            </div>
            <div className="field">
              <label>Note <span style={{ fontSize: 11, color: 'var(--text-hint)' }}>(optional)</span></label>
              <input
                className="inp"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. VIP customer"
                onKeyDown={(e) => e.key === 'Enter' && save()}
              />
            </div>
            <div className="flex-row" style={{ marginTop: 4 }}>
              <button className="btn btn-primary" onClick={save} style={{ flex: 1 }}>Save</button>
              <button className="btn btn-ghost btn-sm" onClick={clearForm}>Clear</button>
            </div>
          </div>
        </div>

        {/* Client list */}
        <div className="card">
          <div className="card-title">All Clients ({clients.length})</div>
          <input
            className="inp"
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginBottom: 12 }}
          />
          {/* Tier legend */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {[...LOYALTY_TIERS].reverse().map((t) => (
              <div key={t.label} style={{
                padding: '3px 10px', borderRadius: 20, fontSize: 11,
                background: t.bg, border: `1px solid ${t.color}`,
                color: t.color, display: 'flex', alignItems: 'center', gap: 4,
              }}>
                {t.emoji} {t.label}
                <span style={{ opacity: 0.7 }}>
                  {t.min === 0 ? '<11' : t.min === 101 ? '101+' : `${t.min}+`}
                </span>
              </div>
            ))}
          </div>

          {!sorted.length ? (
            <div className="empty-state" style={{ padding: '20px 0' }}>
              <div className="empty-icon"><Icon name="clients" size={28} /></div>
              {search ? 'No clients match.' : 'No clients yet.'}
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tier</th>
                    <th>Name</th>
                    <th>Note</th>
                    <th>Orders</th>
                    <th>Last Order</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((c) => {
                    const clientOrders = orders.filter((o) => o.customerId === c.name);
                    const lastOrder = clientOrders[0];
                    const lastDate = lastOrder
                      ? new Date(lastOrder.createdAt).toLocaleDateString()
                      : '—';
                    const tier = getLoyaltyTier(clientOrders.length);
                    return (
                      <tr key={c.id}>
                        <td>
                          <span style={{
                            padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                            background: tier.bg, border: `1px solid ${tier.color}`,
                            color: tier.color, whiteSpace: 'nowrap',
                          }}>
                            {tier.emoji} {tier.label}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{c.name}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-hint)' }}>{c.note || '—'}</td>
                        <td><span className="badge badge-info">{clientOrders.length}</span></td>
                        <td style={{ fontSize: 12 }}>{lastDate}</td>
                        <td>
                          <div className="action-group">
                            <button className="btn btn-ghost btn-xs" onClick={() => startEdit(c.id)}>Edit</button>
                            <button className="btn btn-danger btn-xs" onClick={() => handleDelete(c.id)}>
                              <Icon name="trash" size={11} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
