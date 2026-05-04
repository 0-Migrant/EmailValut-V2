import { useVaultStore, useSaveStatusStore, type SaveStatus } from '@/lib/store';
import { isCloudEnabled } from '@/lib/api';

const STATUS_CONFIG: Record<SaveStatus, { label: string; title: string; className: string }> = {
  idle:    { label: '✓', title: 'All changes saved',                className: 'save-badge save-badge--idle'    },
  pending: { label: '…', title: 'Save pending…',                    className: 'save-badge save-badge--pending' },
  saving:  { label: '↑', title: 'Saving to server…',                className: 'save-badge save-badge--saving'  },
  error:   { label: '!', title: 'Save failed — data is local only', className: 'save-badge save-badge--error'  },
};

function SaveStatusBadge() {
  const status = useSaveStatusStore((s) => s.saveStatus);
  const error  = useSaveStatusStore((s) => s.saveError);
  if (!isCloudEnabled) return null;
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={cfg.className}
      title={status === 'error' && error ? `Save failed: ${error}` : cfg.title}
      aria-label={cfg.title}
    >
      {cfg.label}
    </span>
  );
}

export default function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const theme = useVaultStore((s) => s.settings.theme);
  const updateSettings = useVaultStore((s) => s.updateSettings);

  const isDark = theme === 'dark';

  // Apply theme class to body whenever it changes
  if (typeof document !== 'undefined') {
    document.body.classList.toggle('dark', isDark);
  }

  function toggleTheme() {
    updateSettings({ theme: isDark ? 'light' : 'dark' });
  }

  return (
    <div className="topbar">
      <button className="menu-btn" onClick={onMenuClick} aria-label="Open menu">☰</button>
      <div className="brand">
        <img src="/logo.png?v=2" alt="Instant-Play" className="brand-logo" />
        <span className="brand-name">Instant-Play</span>
      </div>
      <div className="topbar-right">
        <SaveStatusBadge />
        <button className="theme-btn" onClick={toggleTheme} title="Toggle theme">
          {isDark ? '☀️' : '🌙'}
        </button>
      </div>
    </div>
  );
}
