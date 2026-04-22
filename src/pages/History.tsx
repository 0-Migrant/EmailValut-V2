import { useState } from 'react';
import { useVaultStore } from '@/lib/store';
import { useModal } from '@/context/ModalContext';
import { fmtDateTime } from '@/lib/utils';
import Icon from '@/components/Icon';

export default function History() {
  const history = useVaultStore((s) => s.history);
  const clearHistory = useVaultStore((s) => s.clearHistory);
  const deleteEntry = useVaultStore((s) => s.deleteHistoryEntry);
  const restoreSnapshot = useVaultStore((s) => s.restoreSnapshot);
  const { showConfirm } = useModal();

  const [search, setSearch] = useState('');

  const filtered = history.filter((h) => h.msg.toLowerCase().includes(search.toLowerCase()));

  function handleRestore(id: string, time: string) {
    showConfirm(
      'Restore Snapshot',
      `Restoring to snapshot from ${fmtDateTime(time)}. Existing data will be overwritten by this snapshot. Procced?`,
      () => {
        const ok = restoreSnapshot(id);
        if (ok) alert('✅ Data restored successfully!');
        else alert('❌ Snapshot restore failed.');
      }
    );
  }

  return (
    <>
      <div className="section-title"><Icon name="history" size={18} style={{ marginRight: 8 }} />System History</div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="history-toolbar">
          <input className="search-box" placeholder="Search logs..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="btn btn-danger btn-sm" onClick={() => showConfirm('Clear History', 'Delete all log history permanentely?', clearHistory)}>
            <Icon name="trash" size={13} style={{ marginRight: 5 }} />Clear All Logs
          </button>
        </div>

        {!filtered.length ? (
          <div className="empty-state" style={{ padding: '40px 0' }}><div className="empty-icon"><Icon name="history" size={28} /></div>No activity logs found.</div>
        ) : (
          <div>
            {filtered.slice(0, 100).map((h) => (
              <div key={h.id} className="history-item">
                <div className={`history-dot h-${h.type}`}></div>
                <div className="history-body">
                  <div className="history-msg">{h.msg}</div>
                  <div className="history-time">{fmtDateTime(h.time)}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {h.snapshot && (
                    <button className="btn btn-ghost btn-xs" title="Restore snapshot" onClick={() => handleRestore(h.id, h.time)}><Icon name="arrowLeft" size={11} style={{ marginRight: 3 }} />Restore</button>
                  )}
                  <button className="btn btn-ghost btn-xs" onClick={() => deleteEntry(h.id)}><Icon name="trash" size={11} /></button>
                </div>
              </div>
            ))}
            {filtered.length > 100 && (
              <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 13, color: 'var(--text-hint)' }}>
                Showing last 100 entries.
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
