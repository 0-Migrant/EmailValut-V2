import { useModal } from '@/context/ModalContext';

export default function ConfirmModal() {
  const { confirm, closeConfirm } = useModal();
  if (!confirm.open) return null;

  function handleOk() {
    closeConfirm();
    confirm.onConfirm?.();
  }

  return (
    <div className="modal-bg" onClick={closeConfirm}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{confirm.title}</h3>
        <p style={{ margin: '10px 0 20px', color: 'var(--text-muted)', fontSize: 14 }}>
          {confirm.message}
        </p>
        <div className="modal-actions">
          <button className="btn btn-ghost btn-sm" onClick={closeConfirm}>Cancel</button>
          <button className="btn btn-danger btn-sm" onClick={handleOk}>Confirm</button>
        </div>
      </div>
    </div>
  );
}
