import { useLocation, useNavigate } from 'react-router-dom';
import Icon, { type IconName } from '@/components/Icon';

const NAV: { href: string; label: string; icon: IconName; section: string }[] = [
  { href: '/',            label: 'Overview',      icon: 'dashboard',    section: 'Dashboard' },
  { href: '/new-order',   label: 'New Order',      icon: 'newOrder',     section: 'Orders' },
  { href: '/orders',      label: 'Manage Orders',  icon: 'orders',       section: 'Orders' },
  { href: '/analytics',   label: 'Analytics',      icon: 'analytics',    section: 'Orders' },
  { href: '/earnings',    label: 'Earnings',       icon: 'earnings',     section: 'Orders' },
  { href: '/items',       label: 'Items',          icon: 'items',        section: 'Management' },
  { href: '/bundles',     label: 'Bundles',        icon: 'bundles',      section: 'Management' },
  { href: '/delivery',    label: 'Workers',        icon: 'workers',      section: 'Management' },
  { href: '/credentials', label: 'Credentials',    icon: 'credentials',  section: 'Management' },
  { href: '/history',     label: 'History',        icon: 'history',      section: 'System' },
  { href: '/settings',    label: 'Settings',       icon: 'settings',     section: 'System' },
];

const SECTIONS = ['Dashboard', 'Orders', 'Management', 'System'];

interface Props {
  mobileOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ mobileOpen, onClose }: Props) {
  const location = useLocation();
  const navigate = useNavigate();

  function go(href: string) {
    navigate(href);
    onClose();
  }

  return (
    <>
      {mobileOpen && (
        <div className="sidebar-overlay open" onClick={onClose} />
      )}

      <div className={`sidebar${mobileOpen ? ' mobile-open' : ''}`}>
        {SECTIONS.map((section) => (
          <div key={section}>
            <div className="sidebar-section">{section}</div>
            {NAV.filter((n) => n.section === section).map((n) => (
              <button
                key={n.href}
                className={`nav-item${location.pathname === n.href ? ' active' : ''}`}
                onClick={() => go(n.href)}
              >
                <span className="ni"><Icon name={n.icon} size={15} /></span>
                {n.label}
              </button>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
