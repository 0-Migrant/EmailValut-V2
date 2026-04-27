import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useVaultStore } from '@/lib/store';
import { useModal } from '@/context/ModalContext';
import { fmt, orderTotal } from '@/lib/utils';
import type { WorkerStatus } from '@/lib/types';
import Icon from '@/components/Icon';
import StatusPicker from '@/components/StatusPicker';

const STATUS_COLORS: Record<WorkerStatus, string> = {
  available: 'var(--green)',
  busy:      'var(--yellow, #f59e0b)',
  offline:   'var(--muted)',
};

const STATUS_LABELS: Record<WorkerStatus, string> = {
  available: 'Available',
  busy:      'Busy',
  offline:   'Offline',
};

const EMPTY_FORM = { name: '', username: '', password: '' };

export default function AdminWorkers() {
  const { logout } = useAuth();
  const deliveryMen     = useVaultStore((s) => s.deliveryMen);
  const orders          = useVaultStore((s) => s.orders);
  const addDM           = useVaultStore((s) => s.addDeliveryMan);
  const updateDM        = useVaultStore((s) => s.updateDeliveryMan);
  const deleteDM        = useVaultStore((s) => s.deleteDeliveryMan);
  const setWorkerStatus = useVaultStore((s) => s.setWorkerStatus);
  const freezeWorker    = useVaultStore((s) => s.freezeWorker);
  const unfreezeWorker  = useVaultStore((s) => s.unfreezeWorker);
  const settings        = useVaultStore((s) => s.settings);
  const { showConfirm } = useModal();

  const [form,   setForm]   = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [showPass, setShowPass] = useState<Record<string, boolean>>({});

  function startEdit(id: string) {
    const dm = deliveryMen.find((d) => d.id === id);
    if (!dm) return;
    setEditId(id);
    setForm({ name: dm.name, username: dm.username ?? '', password: dm.password ?? '' });
  }

  function clearForm() {
    setEditId(null);
    setForm(EMPTY_FORM);
  }

  function save() {
    if (!form.name.trim())     { alert('Name is required'); return; }
    if (!form.username.trim()) { alert('Username is required'); return; }
    if (!form.password.trim()) { alert('Password is required'); return; }

    const duplicate = deliveryMen.find(
      (d) => d.username === form.username.trim() && d.id !== editId,
    );
    if (duplicate) { alert('Username already taken.'); return; }

    if (editId) {
      updateDM(editId, {
        name:     form.name.trim(),
        username: form.username.trim(),
        password: form.password.trim(),
      });
    } else {
      addDM({
        name:     form.name.trim(),
        username: form.username.trim(),
        password: form.password.trim(),
        status:   'offline',
      });
    }
    clearForm();
  }

  function handleDelete(id: string) {
    const dm = deliveryMen.find((d) => d.id === id);
    if (!dm) return;
    if (settings.confirmdelete) {
      showConfirm('Delete Worker', `Delete "${dm.name}"? This cannot be undone.`, () => deleteDM(id));
    } else {
      deleteDM(id);
    }
  }

  function handleFreeze(id: string) {
    const dm = deliveryMen.find((d) => d.id === id);
    if (!dm) return;
    showConfirm(
      'Freeze Worker',
      `Freeze "${dm.name}"? They won't be able to sign in until unfrozen.`,
      () => freezeWorker(id),
    );
  }

  function toggleShowPass(id: string) {
    setShowPass((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <>
      <div className="section-title" style={{ display: 'flex', alignItems: 'center' }}>
        <Icon name="shield" size={18} style={{ marginRight: 8 }} />
        Worker Accounts
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginLeft: 'auto', fontSize: 12 }}
          onClick={logout}
        >
          Sign Out
        </button>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Add / Edit Form */}
        <div className="card">
          <div className="card-title">{editId ? 'Edit Worker' : 'Add Worker'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="field">
              <label>Full Name</label>
              <input
                className="inp"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Ahmed Hassan"
              />
            </div>
            <div className="field">
              <label>Username</label>
              <input
                className="inp"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                placeholder="Login username"
                autoComplete="off"
              />
            </div>
            <div className="field">
              <label>Password</label>
              <input
                className="inp"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Login password"
                autoComplete="new-password"
              />
            </div>
            <div className="flex-row" style={{ marginTop: 4 }}>
              <button className="btn btn-primary" onClick={save} style={{ flex: 1 }}>
                {editId ? 'Update Worker' : 'Add Worker'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={clearForm}>Clear</button>
            </div>
          </div>
        </div>

        {/* Workers Table */}
        <div className="card">
          <div className="card-title">All Workers ({deliveryMen.length})</div>
          {deliveryMen.length === 0 ? (
            <div className="empty-state" style={{ padding: '20px 0' }}>
              <div className="empty-icon"><Icon name="workers" size={28} /></div>
              No workers yet.
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Username</th>
                    <th>Password</th>
                    <th>Status</th>
                    <th>Orders</th>
                    <th>Revenue</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {deliveryMen.map((dm) => {
                    const workerStatus: WorkerStatus = dm.status ?? 'offline';
                    const done   = orders.filter((o) => o.deliveryManId === dm.id && o.status === 'done');
                    const active = orders.filter((o) => o.deliveryManId === dm.id && o.status !== 'done');
                    const rev    = done.reduce((a, o) => a + orderTotal(o), 0);
                    return (
                      <tr key={dm.id} style={dm.frozen ? { opacity: 0.5 } : {}}>
                        <td style={{ fontWeight: 500 }}>
                          {dm.name}
                          {dm.frozen && (
                            <span className="badge" style={{
                              marginLeft: 6, background: 'var(--danger)', color: '#fff',
                              fontSize: 10,
                            }}>
                              FROZEN
                            </span>
                          )}
                        </td>
                        <td style={{ fontSize: 13, color: 'var(--muted)' }}>
                          {dm.username || <span style={{ fontStyle: 'italic' }}>not set</span>}
                        </td>
                        <td style={{ fontSize: 13 }}>
                          {dm.password ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ fontFamily: 'monospace' }}>
                                {showPass[dm.id] ? dm.password : '••••••'}
                              </span>
                              <button
                                className="btn btn-ghost btn-xs"
                                style={{ padding: '1px 5px' }}
                                onClick={() => toggleShowPass(dm.id)}
                              >
                                {showPass[dm.id] ? 'Hide' : 'Show'}
                              </button>
                            </span>
                          ) : (
                            <span style={{ fontStyle: 'italic', color: 'var(--muted)' }}>not set</span>
                          )}
                        </td>
                        <td>
                          <StatusPicker
                            value={workerStatus}
                            onChange={(s) => setWorkerStatus(dm.id, s)}
                            disabled={!!dm.frozen}
                          />
                        </td>
                        <td>
                          <span className="badge badge-info">{done.length}</span>
                          {active.length > 0 && (
                            <span className="badge badge-accepted" style={{ marginLeft: 4 }}>
                              {active.length} active
                            </span>
                          )}
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--green)' }}>
                          {fmt(rev)} $
                        </td>
                        <td>
                          <div className="action-group">
                            <button
                              className="btn btn-ghost btn-xs"
                              onClick={() => startEdit(dm.id)}
                            >
                              Edit
                            </button>
                            {dm.frozen ? (
                              <button
                                className="btn btn-ghost btn-xs"
                                style={{ color: 'var(--green)' }}
                                onClick={() => unfreezeWorker(dm.id)}
                                title="Unfreeze worker"
                              >
                                Unfreeze
                              </button>
                            ) : (
                              <button
                                className="btn btn-ghost btn-xs"
                                style={{ color: 'var(--yellow, #f59e0b)' }}
                                onClick={() => handleFreeze(dm.id)}
                                title="Freeze worker"
                              >
                                Freeze
                              </button>
                            )}
                            <button
                              className="btn btn-danger btn-xs"
                              onClick={() => handleDelete(dm.id)}
                            >
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

      {/* Status Legend */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-title">Status Guide</div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {(['available', 'busy', 'offline'] as WorkerStatus[]).map((s) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 10, height: 10, borderRadius: '50%',
                background: STATUS_COLORS[s], display: 'inline-block',
              }} />
              <span style={{ fontSize: 13 }}>{STATUS_LABELS[s]}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 10, height: 10, borderRadius: '50%',
              background: 'var(--danger)', display: 'inline-block',
            }} />
            <span style={{ fontSize: 13 }}>Frozen — cannot sign in</span>
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
          Workers log in at <strong>/worker</strong> and set their own status.
          Offline and Busy workers cannot be assigned to new orders.
        </div>
      </div>
    </>
  );
}
