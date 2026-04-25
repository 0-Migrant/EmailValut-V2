import { useModal } from '@/context/ModalContext';
import { getLoyaltyTier, LOYALTY_TIERS } from '@/lib/utils';

export default function LoyaltyModal() {
  const { loyalty, closeLoyalty } = useModal();
  if (!loyalty.open) return null;

  const tier = getLoyaltyTier(loyalty.orderNum);

  return (
    <div className="modal-bg" onClick={closeLoyalty}>
      <div className="modal loyalty-modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>

        {/* Big emoji */}
        <div style={{ fontSize: 56, textAlign: 'center', marginBottom: 8, lineHeight: 1 }}>
          {tier.emoji}
        </div>

        <h3 style={{ textAlign: 'center', marginBottom: 6, fontSize: 18 }}>
          {tier.label} Tier Reached!
        </h3>

        <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: 20, fontSize: 13, lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text)' }}>{loyalty.customerId}</strong> just completed their{' '}
          <strong style={{ color: tier.color }}>{loyalty.orderNum}th order</strong> and is now a{' '}
          <strong style={{ color: tier.color }}>{tier.label}</strong> customer!
        </p>

        {/* Highlighted tier box */}
        <div style={{
          background: tier.bg,
          border: `1.5px solid ${tier.color}`,
          borderRadius: 10, padding: '14px 18px', marginBottom: 20,
          textAlign: 'center',
        }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: tier.color, marginBottom: 4 }}>
            {tier.emoji} {tier.label}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Consider offering a special price or discount as a loyalty reward.
          </div>
        </div>

        {/* All tiers progress bar */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
          {[...LOYALTY_TIERS].reverse().map((t) => {
            const isActive  = t.label === tier.label;
            const isPast    = loyalty.orderNum >= t.min;
            return (
              <div
                key={t.label}
                style={{
                  flex: 1, borderRadius: 6, padding: '6px 4px',
                  textAlign: 'center', fontSize: 10, fontWeight: isActive ? 700 : 400,
                  background: isPast ? t.bg : 'var(--surface-alt, rgba(0,0,0,0.04))',
                  border: `1px solid ${isPast ? t.color : 'var(--border)'}`,
                  color: isPast ? t.color : 'var(--text-hint)',
                  outline: isActive ? `2px solid ${t.color}` : 'none',
                  outlineOffset: 1,
                  transition: 'all 0.15s',
                }}
                title={`${t.emoji} ${t.label} — ${t.min === 0 ? '<10' : `${t.min}+`} orders`}
              >
                <div style={{ fontSize: 14 }}>{t.emoji}</div>
                <div>{t.label}</div>
                <div style={{ opacity: 0.7 }}>{t.min === 0 ? '<10' : `${t.min}+`}</div>
              </div>
            );
          })}
        </div>

        <div className="modal-actions">
          <button className="btn btn-success btn-sm" style={{ flex: 1 }} onClick={closeLoyalty}>
            ✓ Got it
          </button>
        </div>
      </div>
    </div>
  );
}
