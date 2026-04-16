import { useVaultStore } from '@/lib/store';

interface Props {
  onMenuClick: () => void;
}

export default function Topbar({ onMenuClick }: Props) {
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
      <div className="brand">
        <div className="brand-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM12 17c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9z"/>
          </svg>
        </div>
        <span className="brand-name">Vault</span>
      </div>
      <div className="topbar-right">
        <button className="hamburger-btn" onClick={onMenuClick} title="Menu">☰</button>
        <button className="theme-btn" onClick={toggleTheme} title="Toggle theme">
          {isDark ? '☀️' : '🌙'}
        </button>
      </div>
    </div>
  );
}
