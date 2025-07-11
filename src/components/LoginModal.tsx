import React, { useState } from 'react';
import { X, Eye, EyeOff, Mail, Lock, LogIn } from 'lucide-react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../services/firebase';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [showResetForm, setShowResetForm] = useState(false);

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
    } catch (error: any) {
      console.error('Login error:', error);
      setError(getErrorMessage(error.code));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await sendPasswordResetEmail(auth, email);
      setResetEmailSent(true);
      setError('');
    } catch (error: any) {
      console.error('Password reset error:', error);
      setError(getErrorMessage(error.code));
    } finally {
      setLoading(false);
    }
  };

  const getErrorMessage = (errorCode: string) => {
    switch (errorCode) {
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

  const resetForm = () => {
    setShowResetForm(false);
    setResetEmailSent(false);
    setError('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-xl border border-gray-700/50 w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700/50">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
              <LogIn className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-semibold text-white">
              {showResetForm ? 'Reset Password' : 'Admin Login'}
            </h2>
          </div>
          <button
            onClick={() => {
              onClose();
              resetForm();
            }}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {showResetForm ? (
            // Password Reset Form
            <div>
              {resetEmailSent ? (
                <div className="text-center">
                  <div className="w-12 h-12 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Mail className="w-6 h-6 text-green-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Check Your Email</h3>
                  <p className="text-gray-300 mb-6">
                    We've sent a password reset link to <strong>{email}</strong>
                  </p>
                  <button
                    onClick={resetForm}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg transition-colors"
                  >
                    Back to Login
                  </button>
                </div>
              ) : (
                <form onSubmit={handlePasswordReset} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-gray-800 text-white pl-10 pr-4 py-3 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                        placeholder="Enter your email"
                        required
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="bg-red-900/50 border border-red-500/50 rounded-lg p-3">
                      <p className="text-red-400 text-sm">{error}</p>
                    </div>
                  )}

                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-3 rounded-lg transition-colors"
                      disabled={loading}
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg transition-colors disabled:opacity-50"
                      disabled={loading}
                    >
                      {loading ? 'Sending...' : 'Send Reset Link'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            // Login Form
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-gray-800 text-white pl-10 pr-4 py-3 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                    placeholder="admin@example.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-gray-800 text-white pl-10 pr-12 py-3 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-900/50 border border-red-500/50 rounded-lg p-3">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
                disabled={loading}
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    <span>Sign In</span>
                  </>
                )}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setShowResetForm(true)}
                  className="text-blue-400 hover:text-blue-300 text-sm underline"
                >
                  Forgot your password?
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};