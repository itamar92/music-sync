import React, { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../services/firebase';
import { Icon } from './nocturne/icons';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess?: () => void;
}

/** Firebase auth codes, translated into something a person can act on. */
const errorMessage = (code: string): string => {
  switch (code) {
    case 'auth/user-not-found':
      return 'No account found with this email address';
    case 'auth/wrong-password':
      return 'Incorrect password';
    case 'auth/invalid-email':
      return 'Invalid email address';
    case 'auth/user-disabled':
      return 'This account has been disabled';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later';
    case 'auth/invalid-credential':
      return 'Invalid email or password';
    default:
      return 'Login failed. Please try again';
  }
};

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const reset = () => {
    setResetMode(false);
    setResetSent(false);
    setError('');
  };

  const close = () => {
    onClose();
    reset();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await signInWithEmailAndPassword(auth, email, password);
      onLoginSuccess?.();
      onClose();
      setEmail('');
      setPassword('');
    } catch (err) {
      console.error('Login error:', err);
      setError(errorMessage((err as { code?: string })?.code || ''));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (err) {
      console.error('Password reset error:', err);
      setError(errorMessage((err as { code?: string })?.code || ''));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="nc-backdrop" onClick={close} role="presentation">
      <div
        className="nc-dialog"
        style={{ maxWidth: 392 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Studio access"
      >
        <div className="nc-dialog-seam" />
        <div className="nc-dialog-body">
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              marginBottom: 20,
            }}
          >
            <div>
              <div className="nc-kicker" style={{ fontSize: 10.5, marginBottom: 8 }}>
                Studio access
              </div>
              <h2 className="nc-h2">{resetMode ? 'Reset your password' : 'Welcome back'}</h2>
            </div>
            <button
              className="nc-btn nc-btn-icon"
              style={{ width: 30, height: 30 }}
              onClick={close}
              aria-label="Close"
            >
              <Icon name="x" size={15} />
            </button>
          </div>

          {resetMode && resetSent ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ margin: 0, fontSize: 13.5, color: 'var(--nc-mut)', lineHeight: 1.6 }}>
                A reset link is on its way to <strong style={{ color: 'var(--nc-text)' }}>{email}</strong>.
              </p>
              <button className="nc-btn nc-btn-accent nc-btn-block" style={{ height: 40 }} onClick={reset}>
                Back to sign in
              </button>
            </div>
          ) : (
            <form
              onSubmit={resetMode ? handleReset : handleLogin}
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              <div className="nc-field">
                <label className="nc-label" htmlFor="login-email">
                  Email
                </label>
                <input
                  id="login-email"
                  className="nc-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@studio.com"
                  required
                  autoComplete="email"
                />
              </div>

              {!resetMode && (
                <div className="nc-field">
                  <label className="nc-label" htmlFor="login-password">
                    Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="login-password"
                      className="nc-input"
                      style={{ paddingRight: 40 }}
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      style={{
                        position: 'absolute',
                        right: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        padding: 4,
                        cursor: 'pointer',
                        color: 'var(--nc-mut)',
                      }}
                    >
                      <Icon name={showPassword ? 'eyeSlash' : 'eye'} size={16} />
                    </button>
                  </div>
                </div>
              )}

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
                disabled={loading}
              >
                {loading ? 'Working…' : resetMode ? 'Send reset link' : 'Sign in'}
              </button>

              <div style={{ textAlign: 'center' }}>
                <button
                  type="button"
                  className="nc-link"
                  style={{ fontSize: 12.5 }}
                  onClick={() => (resetMode ? reset() : setResetMode(true))}
                >
                  {resetMode ? 'Back to sign in' : 'Forgot your password?'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
