import type { Metadata } from 'next';
import './globals.css';
import ClientShell from './ClientShell';

// Fix for server-side localStorage access (especially in environments with broken polyfills)
if (typeof window === 'undefined') {
  (global as any).localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  };
}

export const metadata: Metadata = {
  title: 'Vault — Business Manager',
  description: 'Manage orders, items, delivery men, and credentials.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
