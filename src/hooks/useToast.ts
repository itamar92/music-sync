import { useState, useCallback } from 'react';
import { Toast } from '../components/ui/Toast';

/**
 * 📢 Toast Notification Hook
 * 
 * Provides easy-to-use toast notifications for user feedback
 * Perfect for authentication errors, success messages, etc.
 */
export const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration ?? 5000, // Default 5 seconds
    };

    setToasts(prev => [...prev, newToast]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  // Convenience methods
  const showError = useCallback((title: string, message?: string, action?: Toast['action']) => {
    return addToast({
      type: 'error',
      title,
      message,
      action,
      duration: 8000, // Longer duration for errors
    });
  }, [addToast]);

  const showSuccess = useCallback((title: string, message?: string) => {
    return addToast({
      type: 'success',
      title,
      message,
      duration: 4000,
    });
  }, [addToast]);

  const showInfo = useCallback((title: string, message?: string) => {
    return addToast({
      type: 'info',
      title,
      message,
      duration: 5000,
    });
  }, [addToast]);

  const showWarning = useCallback((title: string, message?: string, action?: Toast['action']) => {
    return addToast({
      type: 'warning',
      title,
      message,
      action,
      duration: 6000,
    });
  }, [addToast]);

  // Authentication-specific helpers
  const showAuthError = useCallback((error: string, onRetry?: () => void) => {
    return showError(
      'Authentication Required',
      error.includes('not authenticated') 
        ? 'Please connect to Dropbox to play music'
        : error,
      onRetry ? {
        label: 'Retry Connection',
        onClick: onRetry
      } : undefined
    );
  }, [showError]);

  const showConnectionRestored = useCallback(() => {
    return showSuccess(
      'Connected to Dropbox',
      'Music playback is now available'
    );
  }, [showSuccess]);

  return {
    toasts,
    addToast,
    removeToast,
    clearAllToasts,
    showError,
    showSuccess,
    showInfo,
    showWarning,
    showAuthError,
    showConnectionRestored,
  };
};