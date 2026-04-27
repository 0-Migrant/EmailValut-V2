import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { WorkerStatus } from '@/lib/types';

const STATUS_COLORS: Record<WorkerStatus, string> = {
  available: 'var(--green)',
  busy:      '#f59e0b',
  offline:   'var(--text-muted)',
};

const STATUS_LABELS: Record<WorkerStatus, string> = {
  available: 'Available',
  busy:      'Busy',
  offline:   'Offline',
};

interface Props {
  value: WorkerStatus;
  onChange: (s: WorkerStatus) => void;
  disabled?: boolean;
}

export default function StatusPicker({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || dropRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  function handleToggle() {
    if (disabled) return;
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setCoords({ top: r.bottom + 4, left: r.left });
    }
    setOpen((o) => !o);
  }

  const color = disabled ? 'var(--text-muted)' : STATUS_COLORS[value];

  return (
    <div style={{ display: 'inline-block' }}>
      <button
        ref={btnRef}
        onClick={handleToggle}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          height: 28,
          borderRadius: 6,
          border: '1px solid var(--border)',
          background: 'var(--bg-card)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: 12,
          fontWeight: 600,
          color,
          opacity: disabled ? 0.5 : 1,
          whiteSpace: 'nowrap',
          userSelect: 'none',
        }}
      >
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: color, flexShrink: 0,
          display: 'inline-block',
        }} />
        {STATUS_LABELS[value]}
        <span style={{ fontSize: 9, color: 'var(--text-hint)', lineHeight: 1 }}>▾</span>
      </button>

      {open && createPortal(
        <div
          ref={dropRef}
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            zIndex: 9999,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 6px 20px var(--shadow)',
            minWidth: 130,
            overflow: 'hidden',
          }}
        >
          {(['available', 'busy', 'offline'] as WorkerStatus[]).map((s) => {
            const isSelected = s === value;
            return (
              <button
                key={s}
                onClick={() => { onChange(s); setOpen(false); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '9px 14px',
                  background: isSelected ? 'var(--bg-subtle)' : 'var(--bg-card)',
                  border: 'none',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: isSelected ? 700 : 500,
                  color: STATUS_COLORS[s],
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = isSelected ? 'var(--bg-subtle)' : 'var(--bg-card)'; }}
              >
                <span style={{
                  width: 9, height: 9, borderRadius: '50%',
                  background: STATUS_COLORS[s],
                  flexShrink: 0,
                  display: 'inline-block',
                }} />
                {STATUS_LABELS[s]}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}
