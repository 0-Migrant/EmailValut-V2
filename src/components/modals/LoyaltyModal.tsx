import { useModal } from '@/context/ModalContext';
import { getLoyaltyTier } from '@/lib/utils';

export default function LoyaltyModal() {
  const { loyalty, closeLoyalty } = useModal();
  if (!loyalty.open) return null;

  const tier = getLoyaltyTier(loyalty.orderNum);

  return (
    <div className="modal-bg" onClick={closeLoyalty}>
      <div className="modal loyalty-modal" onClick={(e) => e.stopPropagation()}>
        <div className="loyalty-header" style={{ fontSize: 48 }}>{tier.emoji}</div>
        <h3 style={{ textAlign: 'center', marginBottom: 8 }}>Tier Up!</h3>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: 16, fontSize: 14 }}>
          <strong>{loyalty.customerId}</strong> just reached{' '}
          <strong>{loyalty.orderNum}</strong> orders and is now a{' '}
          <strong style={{ color: tier.color }}>{tier.label}</strong> customer!
        </p>

        <div style={{
          background: tier.bg,
          border: `1px solid ${tier.color}`,
          borderRadius: 10, padding: '14px 18px', marginBottom: 20,
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: tier.color, textAlign: 'center' }}>
            {tier.emoji} {tier.label} Tier
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
            Consider offering them a special discount or loyalty reward.
          </div>
        </div>

        {/* All tiers overview */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'New',     emoji: '🌱', min: 0   },
            { label: 'Regular', emoji: '⭐', min: 11  },
            { label: 'Silver',  emoji: '🥈', min: 21  },
            { label: 'Gold',    emoji: '🥇', min: 51  },
            { label: 'VIP',     emoji: '💎', min: 101 },
          ].map((t) => {
            const active = t.label === tier.label;
            return (
              <div key={t.label} style={{
                padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: active ? 700 : 400,
                background: active ? tier.bg : 'var(--surface-alt, var(--border))',
                border: active ? `1px solid ${tier.color}` : '1px solid transparent',
                color: active ? tier.color : 'var(--text-hint)',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                {t.emoji} {t.label}
              </div>
            );
          })}
        </div>

        <div className="modal-actions">
          <button className="btn btn-success btn-sm" onClick={closeLoyalty}>
            ✓ Got it
          </button>
        </div>
      </div>
    </div>
  );
}
