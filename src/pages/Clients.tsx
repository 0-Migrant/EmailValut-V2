import { useState } from 'react';
import { useVaultStore } from '@/lib/store';
import { useModal } from '@/context/ModalContext';
import { getLoyaltyTier, LOYALTY_TIERS } from '@/lib/utils';
import Icon from '@/components/Icon';

// ─── Add / Edit popup ─────────────────────────────────────────────────────────

interface FormPopupProps {
  editId: string | null;
  initialName: string;
  initialNote: string;
  initialSpecial: boolean;
  onSave: (name: string, note: string, isSpecial: boolean) => void;
  onClose: () => void;
}

function ClientFormPopup({ editId, initialName, initialNote, initialSpecial, onSave, onClose }: FormPopupProps) {
  const [name,      setName]      = useState(initialName);
  const [note,      setNote]      = useState(initialNote);
  const [isSpecial, setIsSpecial] = useState(initialSpecial);

  function submit() {
    if (!name.trim()) { alert('Client name is required'); return; }
    onSave(name.trim(), note.trim(), isSpecial);
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ width: 380 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>{editId ? 'Edit Client' : 'Add Client'}</h3>
          <button className="btn btn-ghost btn-xs btn-icon" onClick={onClose}>
            <Icon name="x" size={14} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="field">
            <label>Name <span style={{ fontSize: 11, color: 'var(--text-hint)' }}>(used as Customer ID in orders)</span></label>
            <input
              className="inp"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. JOJO"
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>

          <div className="field">
            <label>Note <span style={{ fontSize: 11, color: 'var(--text-hint)' }}>(optional)</span></label>
            <input
              className="inp"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Prefers morning delivery"
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
            padding: '10px 12px', borderRadius: 8, border: `1px solid ${isSpecial ? '#f59e0b' : 'var(--border)'}`,
            background: isSpecial ? 'rgba(245,158,11,0.08)' : 'transparent', userSelect: 'none',
          }}>
            <input
              type="checkbox"
              checked={isSpecial}
              onChange={(e) => setIsSpecial(e.target.checked)}
            />
            <span>
              <span style={{ fontWeight: 600, color: isSpecial ? '#f59e0b' : 'var(--text)' }}>⭐ Special Client</span>
              <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 2 }}>
                Manually designated VIP — not auto-created from orders
              </div>
            </span>
          </label>
        </div>

        <div className="modal-actions" style={{ marginTop: 20 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={submit}>
            {editId ? 'Save Changes' : 'Add Client'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Clients() {
  const clients      = useVaultStore((s) => s.clients);
  const orders       = useVaultStore((s) => s.orders);
  const addClient    = useVaultStore((s) => s.addClient);
  const updateClient = useVaultStore((s) => s.updateClient);
  const deleteClient = useVaultStore((s) => s.deleteClient);
  const settings     = useVaultStore((s) => s.settings);
  const { showConfirm } = useModal();

  const [popupOpen,   setPopupOpen]   = useState(false);
  const [editId,      setEditId]      = useState<string | null>(null);
  const [editName,    setEditName]    = useState('');
  const [editNote,    setEditNote]    = useState('');
  const [editSpecial, setEditSpecial] = useState(false);
  const [search,      setSearch]      = useState('');
  const [tierFilter,  setTierFilter]  = useState<string>('all');

  function openAdd() {
    setEditId(null); setEditName(''); setEditNote(''); setEditSpecial(false);
    setPopupOpen(true);
  }

  function openEdit(id: string) {
    const c = clients.find((x) => x.id === id);
    if (!c) return;
    setEditId(id); setEditName(c.name); setEditNote(c.note ?? ''); setEditSpecial(c.isSpecial ?? false);
    setPopupOpen(true);
  }

  function handleSave(name: string, note: string, isSpecial: boolean) {
    const duplicate = clients.some(
      (c) => c.name.toLowerCase() === name.toLowerCase() && c.id !== editId
    );
    if (duplicate) { alert('A client with that name already exists'); return; }
    if (editId) {
      updateClient(editId, { name, note: note || undefined, isSpecial });
    } else {
      addClient({ name, note: note || undefined, isSpecial });
    }
    setPopupOpen(false);
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

  // Build enriched list
  const enriched = clients.map((c) => {
    const clientOrders = orders.filter((o) => o.customerId === c.name);
    const lastOrder    = clientOrders[0];
    return {
      ...c,
      orderCount: clientOrders.length,
      lastDate: lastOrder ? new Date(lastOrder.createdAt).toLocaleDateString() : null,
      tier: getLoyaltyTier(clientOrders.length),
    };
  });

  const filtered = enriched.filter((c) => {
    const q = search.toLowerCase();
    const matchQ = !q || c.name.toLowerCase().includes(q) || (c.note ?? '').toLowerCase().includes(q);
    const matchT = tierFilter === 'all'
      || (tierFilter === 'special' ? c.isSpecial : c.tier.label === tierFilter);
    return matchQ && matchT;
  });

  // Sort: special first, then by order count desc
  const sorted = [...filtered].sort((a, b) => {
    if (a.isSpecial && !b.isSpecial) return -1;
    if (!a.isSpecial && b.isSpecial) return 1;
    return b.orderCount - a.orderCount;
  });

  const tierLabels = ['all', 'special', ...LOYALTY_TIERS.map((t) => t.label).reverse()];

  return (
    <>
      {popupOpen && (
        <ClientFormPopup
          editId={editId}
          initialName={editName}
          initialNote={editNote}
          initialSpecial={editSpecial}
          onSave={handleSave}
          onClose={() => setPopupOpen(false)}
        />
      )}

      <div className="section-title">
        <Icon name="clients" size={18} style={{ marginRight: 8 }} />
        Clients
        <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 400, color: 'var(--text-hint)' }}>
          ({clients.length})
        </span>
        <button
          className="btn btn-primary btn-sm"
          style={{ marginLeft: 'auto' }}
          onClick={openAdd}
        >
          + Add Client
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="inp"
          style={{ flex: 1, minWidth: 180, maxWidth: 300 }}
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {tierLabels.map((t) => {
            const tier = LOYALTY_TIERS.find((x) => x.label === t);
            const active = tierFilter === t;
            return (
              <button
                key={t}
                onClick={() => setTierFilter(t)}
                style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: 'none',
                  fontWeight: active ? 700 : 400,
                  background: active
                    ? (t === 'special' ? 'rgba(245,158,11,0.2)' : tier ? tier.bg : 'var(--accent-bg)')
                    : 'var(--surface-alt, var(--border))',
                  color: active
                    ? (t === 'special' ? '#f59e0b' : tier ? tier.color : 'var(--accent)')
                    : 'var(--text-muted)',
                  outline: active ? `1px solid ${t === 'special' ? '#f59e0b' : tier?.color ?? 'var(--accent)'}` : 'none',
                }}
              >
                {t === 'all' ? 'All' : t === 'special' ? '⭐ Special' : `${tier?.emoji} ${t}`}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tier legend */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {[...LOYALTY_TIERS].reverse().map((t) => (
          <div key={t.label} style={{
            padding: '3px 10px', borderRadius: 20, fontSize: 11,
            background: t.bg, border: `1px solid ${t.color}`,
            color: t.color, display: 'flex', alignItems: 'center', gap: 4,
          }}>
            {t.emoji} {t.label}
            <span style={{ opacity: 0.65, fontSize: 10 }}>
              {t.min === 0 ? '<10' : `${t.min}+`}
            </span>
          </div>
        ))}
      </div>

      {/* Client cards */}
      {!sorted.length ? (
        <div className="empty-state">
          <div className="empty-icon"><Icon name="clients" size={32} /></div>
          {search || tierFilter !== 'all' ? 'No clients match.' : 'No clients yet. Add one above.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {sorted.map((c) => (
            <div
              key={c.id}
              style={{
                borderRadius: 10,
                border: `1.5px solid ${c.isSpecial ? '#f59e0b' : c.tier.color}`,
                background: c.isSpecial ? 'rgba(245,158,11,0.07)' : c.tier.bg,
                padding: '14px 16px',
                display: 'flex', flexDirection: 'column', gap: 8,
                position: 'relative',
              }}
            >
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: c.isSpecial ? '#f59e0b' : c.tier.color,
                  color: '#fff', whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                  {c.tier.emoji} {c.tier.label}
                </span>
                {c.isSpecial && (
                  <span style={{
                    padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: 'rgba(245,158,11,0.18)', color: '#f59e0b',
                    border: '1px solid #f59e0b', whiteSpace: 'nowrap',
                  }}>
                    ⭐ Special
                  </span>
                )}
                <div className="action-group" style={{ marginLeft: 'auto' }}>
                  <button className="btn btn-ghost btn-xs" onClick={() => openEdit(c.id)}>
                    <Icon name="edit" size={11} />
                  </button>
                  <button className="btn btn-danger btn-xs" onClick={() => handleDelete(c.id)}>
                    <Icon name="trash" size={11} />
                  </button>
                </div>
              </div>

              {/* Name */}
              <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--text)', letterSpacing: 0.2 }}>
                {c.name}
              </div>

              {/* Note */}
              {c.note && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  {c.note}
                </div>
              )}

              {/* Stats */}
              <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                <span>
                  <strong style={{ color: c.tier.color }}>{c.orderCount}</strong> orders
                </span>
                {c.lastDate && (
                  <span>Last: {c.lastDate}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
