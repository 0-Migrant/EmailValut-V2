// Cloud enabled in production always; in dev only if VITE_CLOUD_ENABLED=true
export const isCloudEnabled: boolean =
  import.meta.env.PROD || import.meta.env.VITE_CLOUD_ENABLED === 'true';

export async function getVault(): Promise<unknown | null> {
  try {
    const res = await fetch('/api/vault');
    if (!res.ok) return null;
    const { data } = await res.json();
    return data ?? null;
  } catch {
    return null;
  }
}

export async function saveVault(data: unknown): Promise<void> {
  const res = await fetch('/api/vault', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) throw new Error('Failed to save vault');
}

export async function deleteVault(): Promise<void> {
  const res = await fetch('/api/vault', { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete vault');
}
