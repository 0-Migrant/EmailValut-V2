import { useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';

const NAV = [
  { href: '/',           label: 'Overview',       icon: '📊', section: 'Dashboard' },
  { href: '/new-order',  label: 'New Order',       icon: '➕', section: 'Orders' },
  { href: '/orders',     label: 'Manage Orders',   icon: '📋', section: 'Orders' },
  { href: '/analytics',  label: 'Analytics',       icon: '📈', section: 'Orders' },
  { href: '/items',      label: 'Items',           icon: '🛒', section: 'Management' },
  { href: '/delivery',   label: 'Delivery Men',    icon: '🚚', section: 'Management' },
  { href: '/credentials',label: 'Credentials',     icon: '🔒', section: 'Management' },
  { href: '/history',    label: 'History',         icon: '🕐', section: 'System' },
  { href: '/settings',   label: 'Settings',        icon: '⚙️', section: 'System' },
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
      {/* Overlay */}
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
                <span className="ni">{n.icon}</span>
                {n.label}
              </button>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
