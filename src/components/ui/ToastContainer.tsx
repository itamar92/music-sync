import React from 'react';
import ToastComponent, { Toast } from './Toast';

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

/**
 * Stacks active toasts in the top-right. The container owns the positioning so
 * each toast can animate independently without fighting over a fixed slot.
 */
export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 80,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <div key={toast.id} style={{ pointerEvents: 'auto' }}>
          <ToastComponent toast={toast} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
};
