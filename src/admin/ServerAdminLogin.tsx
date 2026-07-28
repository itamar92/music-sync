import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../services/adminApiService';
import { WaveMark } from '../components/nocturne/WaveMark';
import { Icon } from '../components/nocturne/icons';

/**
 * The JWT login for container mode.
 *
 * Firebase mode gates the studio on Firebase Auth plus an admin role, so it
 * never renders this. Everything past the gate is the same dashboard either way.
 */
export const ServerAdminLogin: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminApi.login(email, password);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="nc-page"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div className="nc-dialog" style={{ maxWidth: 392 }}>
        <div className="nc-dialog-seam" />
        <form onSubmit={submit} className="nc-dialog-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 18 }}>
            <WaveMark height={22} />
            <span style={{ fontSize: 14, fontWeight: 500, letterSpacing: '0.02em' }}>MusicSync</span>
          </div>

          <div className="nc-kicker" style={{ fontSize: 10.5, marginBottom: 8 }}>
            Studio access
          </div>
          <h1 className="nc-h2" style={{ marginBottom: 20 }}>
            Welcome back
          </h1>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="nc-field">
              <label className="nc-label" htmlFor="sa-email">
                Email
              </label>
              <input
                id="sa-email"
                className="nc-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
              />
            </div>

            <div className="nc-field">
              <label className="nc-label" htmlFor="sa-password">
                Password
              </label>
              <input
                id="sa-password"
                className="nc-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="nc-notice nc-notice-danger" style={{ fontSize: 12.5 }}>
                <Icon name="warning" size={15} />
                {error}
              </div>
            )}

            <button
              type="submit"
              className="nc-btn nc-btn-accent nc-btn-block"
              style={{ height: 40, marginTop: 4 }}
              disabled={busy}
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </button>

            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                className="nc-link"
                style={{ fontSize: 12.5 }}
                onClick={() => navigate('/')}
              >
                <Icon name="arrowLeft" size={13} />
                Back to the site
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
