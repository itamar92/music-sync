import React from 'react';
import ToastComponent, { Toast } from './Toast';

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

/**
 * 📢 Toast Container Component
 * 
 * Renders all active toasts in a fixed position
 * Stacks multiple toasts vertically
 */
export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          style={{
            transform: `translateY(${index * 4}px)`,
            zIndex: 50 - index,
          }}
        >
          <ToastComponent toast={toast} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
};