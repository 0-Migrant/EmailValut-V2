import { useState } from 'react';
import { useVaultStore } from '@/lib/store';
import { useModal } from '@/context/ModalContext';
import { fmtDateTime } from '@/lib/utils';

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
      <div className="section-title">🕐 System History</div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 10, flex: 1 }}>
            <input className="search-box" style={{ width: 300 }} placeholder="Search logs..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-danger btn-sm" onClick={() => showConfirm('Clear History', 'Delete all log history permanentely?', clearHistory)}>
            🗑 Clear All Logs
          </button>
        </div>

        {!filtered.length ? (
          <div className="empty-state" style={{ padding: '40px 0' }}><div className="empty-icon">🕐</div>No activity logs found.</div>
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
                    <button className="btn btn-ghost btn-xs" title="Restore snapshot" onClick={() => handleRestore(h.id, h.time)}>↩ Restore</button>
                  )}
                  <button className="btn btn-ghost btn-xs" onClick={() => deleteEntry(h.id)}>🗑</button>
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
