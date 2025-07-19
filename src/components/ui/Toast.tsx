import React, { useEffect, useState } from 'react';
import { X, AlertCircle, CheckCircle, Info, WifiOff } from 'lucide-react';

export interface Toast {
  id: string;
  type: 'error' | 'success' | 'info' | 'warning';
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const ToastComponent: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Animate in
    setTimeout(() => setIsVisible(true), 50);

    // Auto dismiss
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, toast.duration);

      return () => clearTimeout(timer);
    }
  }, [toast.duration]);

  const handleDismiss = () => {
    setIsLeaving(true);
    setTimeout(() => {
      onDismiss(toast.id);
    }, 300);
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning':
        return <WifiOff className="w-5 h-5 text-yellow-500" />;
      case 'info':
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getStyles = () => {
    const baseStyles = "border-l-4 shadow-lg";
    switch (toast.type) {
      case 'error':
        return `${baseStyles} bg-red-50 border-red-500 text-red-900`;
      case 'success':
        return `${baseStyles} bg-green-50 border-green-500 text-green-900`;
      case 'warning':
        return `${baseStyles} bg-yellow-50 border-yellow-500 text-yellow-900`;
      case 'info':
      default:
        return `${baseStyles} bg-blue-50 border-blue-500 text-blue-900`;
    }
  };

  return (
    <div
      className={`
        fixed top-4 right-4 max-w-sm w-full z-50 transition-all duration-300 ease-in-out
        ${isVisible && !isLeaving ? 'transform translate-x-0 opacity-100' : 'transform translate-x-full opacity-0'}
      `}
    >
      <div className={`${getStyles()} rounded-lg p-4 backdrop-blur-sm`}>
        <div className="flex items-start">
          <div className="flex-shrink-0">
            {getIcon()}
          </div>
          <div className="ml-3 w-0 flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">{toast.title}</h3>
              <button
                onClick={handleDismiss}
                className="ml-2 flex-shrink-0 p-1 rounded-md hover:bg-black/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {toast.message && (
              <p className="mt-1 text-sm opacity-90">{toast.message}</p>
            )}
            {toast.action && (
              <div className="mt-3">
                <button
                  onClick={toast.action.onClick}
                  className="text-sm font-medium underline hover:no-underline transition-all"
                >
                  {toast.action.label}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToastComponent;