import { useVaultStore } from '@/lib/store';

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
        <button className="theme-btn" onClick={toggleTheme} title="Toggle theme">
          {isDark ? '☀️' : '🌙'}
        </button>
      </div>
    </div>
  );
}
