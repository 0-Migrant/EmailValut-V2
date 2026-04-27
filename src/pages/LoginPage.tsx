import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import Icon from '@/components/Icon';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate   = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = login(username.trim(), password);
    setLoading(false);

    if (result === 'admin') {
      navigate('/', { replace: true });
    } else if (result === 'worker') {
      navigate('/worker', { replace: true });
    } else if (result === 'frozen') {
      setError('Your account has been frozen. Please contact the admin.');
    } else {
      setError('Invalid username or password.');
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-page)',
    }}>
      <div className="card" style={{ width: 360, padding: 36 }}>
        {/* Logo / Brand */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'var(--stock-bg)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 14,
          }}>
            <Icon name="credentials" size={28} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>Instant-Play</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Sign in to continue
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="field">
            <label>Username</label>
            <input
              className="inp"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              disabled={loading}
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              className="inp"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          {error && (
            <div style={{
              background: 'var(--red-bg)',
              border: '1px solid var(--red-border)',
              borderRadius: 8,
              padding: '10px 14px',
              color: 'var(--red)',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <Icon name="info" size={14} />
              {error}
            </div>
          )}

          <button
            className="btn btn-primary"
            type="submit"
            style={{ marginTop: 4, height: 42 }}
            disabled={loading}
          >
            <Icon name="login" size={15} style={{ marginRight: 8 }} />
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
