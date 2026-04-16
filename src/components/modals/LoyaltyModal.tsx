import { useModal } from '@/context/ModalContext';

export default function LoyaltyModal() {
  const { loyalty, closeLoyalty } = useModal();
  if (!loyalty.open) return null;

  return (
    <div className="modal-bg" onClick={closeLoyalty}>
      <div className="modal loyalty-modal" onClick={(e) => e.stopPropagation()}>
        <div className="loyalty-header">🎉</div>
        <h3 style={{ textAlign: 'center', marginBottom: 8 }}>Special Offer Alert!</h3>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: 16, fontSize: 14 }}>
          Customer <strong>{loyalty.customerId}</strong> has reached{' '}
          <strong>{loyalty.orderNum}</strong> purchases!
          <br />Consider giving them a special price on this order.
        </p>
        <div style={{
          background: 'var(--green-bg)', border: '1px solid var(--green-border)',
          borderRadius: 8, padding: 12, marginBottom: 20,
          textAlign: 'center', fontSize: 13, color: 'var(--green)',
        }}>
          🏆 Loyal customer milestone reached! Reward them with a discount.
        </div>
        <div className="modal-actions">
          <button className="btn btn-success btn-sm" onClick={closeLoyalty}>
            ✓ Got it — Go to Orders
          </button>
        </div>
      </div>
    </div>
  );
}
