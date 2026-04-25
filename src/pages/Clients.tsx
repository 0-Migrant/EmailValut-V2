import { useState, useEffect } from 'react';
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
  const clients                  = useVaultStore((s) => s.clients);
  const orders                   = useVaultStore((s) => s.orders);
  const addClient                = useVaultStore((s) => s.addClient);
  const updateClient             = useVaultStore((s) => s.updateClient);
  const deleteClient             = useVaultStore((s) => s.deleteClient);
  const syncClientsFromDoneOrders = useVaultStore((s) => s.syncClientsFromDoneOrders);
  const settings                 = useVaultStore((s) => s.settings);
  const { showConfirm } = useModal();

  const [popupOpen,   setPopupOpen]   = useState(false);
  const [editId,      setEditId]      = useState<string | null>(null);
  const [editName,    setEditName]    = useState('');
  const [editNote,    setEditNote]    = useState('');
  const [editSpecial, setEditSpecial] = useState(false);
  const [search,      setSearch]      = useState('');
  const [tierFilter,  setTierFilter]  = useState<string>('all');
  const [syncMsg,     setSyncMsg]     = useState('');

  // Auto-sync on first mount
  useEffect(() => {
    syncClientsFromDoneOrders();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    const clientOrders = orders.filter((o) => o.customerId?.trim().toLowerCase() === c.name.trim().toLowerCase());
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

  // Tier order index for sorting (0 = highest)
  const TIER_ORDER = ['VIP', 'Gold', 'Silver', 'Regular', 'New'];

  const sorted = [...filtered].sort((a, b) => {
    // Special first
    if (a.isSpecial && !b.isSpecial) return -1;
    if (!a.isSpecial && b.isSpecial) return 1;
    // Then by tier rank (highest first)
    const ta = TIER_ORDER.indexOf(a.tier.label);
    const tb = TIER_ORDER.indexOf(b.tier.label);
    if (ta !== tb) return ta - tb;
    // Within same tier: more orders first
    return b.orderCount - a.orderCount;
  });

  // Group into sections for the list view
  type Group = { key: string; label: string; emoji: string; color: string; bg: string; items: typeof sorted };
  const groups: Group[] = [];

  const specials = sorted.filter((c) => c.isSpecial);
  if (specials.length) {
    groups.push({ key: 'special', label: 'Special', emoji: '⭐', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', items: specials });
  }
  for (const tier of LOYALTY_TIERS) {
    const members = sorted.filter((c) => !c.isSpecial && c.tier.label === tier.label);
    if (members.length) {
      groups.push({ key: tier.label, label: tier.label, emoji: tier.emoji, color: tier.color, bg: tier.bg, items: members });
    }
  }

  const tierLabels = ['all', 'special', ...LOYALTY_TIERS.map((t) => t.label)];

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
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {syncMsg && (
            <span style={{ fontSize: 12, color: 'var(--green, #22c55e)' }}>{syncMsg}</span>
          )}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              const n = syncClientsFromDoneOrders();
              setSyncMsg(n > 0 ? `+${n} client${n > 1 ? 's' : ''} added` : 'Already up to date');
              setTimeout(() => setSyncMsg(''), 3000);
            }}
            title="Import any missing customers from done orders"
          >
            ↻ Sync from Orders
          </button>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>
            + Add Client
          </button>
        </div>
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

      {/* Client list */}
      {!sorted.length ? (
        <div className="empty-state">
          <div className="empty-icon"><Icon name="clients" size={32} /></div>
          {search || tierFilter !== 'all' ? 'No clients match.' : 'No clients yet. Add one above.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {groups.map((group) => (
            <div key={group.key}>
              {/* Section header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 12px', borderRadius: 8, marginBottom: 8,
                background: group.bg, border: `1px solid ${group.color}`,
                fontWeight: 700, fontSize: 13, color: group.color,
              }}>
                {group.emoji} {group.label}
                <span style={{ marginLeft: 4, fontWeight: 400, fontSize: 12, opacity: 0.75 }}>
                  — {group.items.length} client{group.items.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {group.items.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 14px', borderRadius: 8,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderLeft: `4px solid ${c.isSpecial ? '#f59e0b' : c.tier.color}`,
                    }}
                  >
                    {/* Name + note */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {c.name}
                        {c.isSpecial && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10,
                            background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid #f59e0b',
                          }}>⭐ Special</span>
                        )}
                      </div>
                      {c.note && (
                        <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 2, fontStyle: 'italic' }}>
                          {c.note}
                        </div>
                      )}
                    </div>

                    {/* Orders count */}
                    <div style={{ textAlign: 'center', minWidth: 52 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: c.isSpecial ? '#f59e0b' : c.tier.color }}>
                        {c.orderCount}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-hint)' }}>orders</div>
                    </div>

                    {/* Last order */}
                    <div style={{ textAlign: 'right', minWidth: 72 }}>
                      {c.lastDate
                        ? <>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.lastDate}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-hint)' }}>last order</div>
                          </>
                        : <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>—</div>
                      }
                    </div>

                    {/* Actions */}
                    <div className="action-group">
                      <button className="btn btn-ghost btn-xs" onClick={() => openEdit(c.id)}>
                        <Icon name="edit" size={11} />
                      </button>
                      <button className="btn btn-danger btn-xs" onClick={() => handleDelete(c.id)}>
                        <Icon name="trash" size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
