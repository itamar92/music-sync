import React, { useCallback, useEffect, useState } from 'react';
import { Icon, IconName } from '../nocturne/icons';

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

/** Each kind gets an icon and an accent line — the body stays on the dark panel. */
const APPEARANCE: Record<Toast['type'], { icon: IconName; color: string }> = {
  error: { icon: 'warning', color: 'var(--nc-danger)' },
  success: { icon: 'check', color: 'var(--nc-cy)' },
  warning: { icon: 'plugOff', color: '#e3c069' },
  info: { icon: 'globe', color: 'var(--nc-tl)' },
};

const ToastComponent: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const { icon, color } = APPEARANCE[toast.type];

  const dismiss = useCallback(() => {
    setLeaving(true);
    setTimeout(() => onDismiss(toast.id), 250);
  }, [onDismiss, toast.id]);

  useEffect(() => {
    const enter = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(enter);
  }, []);

  useEffect(() => {
    if (!toast.duration || toast.duration <= 0) return;
    const timer = setTimeout(dismiss, toast.duration);
    return () => clearTimeout(timer);
  }, [toast.duration, dismiss]);

  return (
    <div
      role="status"
      style={{
        width: 340,
        maxWidth: 'calc(100vw - 32px)',
        borderRadius: 'var(--nc-r-lg)',
        background: 'rgba(23,26,41,0.96)',
        border: '1px solid var(--nc-line)',
        borderLeft: `2px solid ${color}`,
        boxShadow: 'var(--nc-shadow-sm)',
        backdropFilter: 'blur(10px)',
        padding: '12px 14px',
        display: 'flex',
        gap: 11,
        alignItems: 'flex-start',
        transform: visible && !leaving ? 'translateX(0)' : 'translateX(calc(100% + 24px))',
        opacity: visible && !leaving ? 1 : 0,
        transition: 'transform 0.25s cubic-bezier(0.2,0.8,0.2,1), opacity 0.25s ease',
      }}
    >
      <Icon name={icon} size={16} color={color} style={{ marginTop: 1 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--nc-text)' }}>{toast.title}</div>
        {toast.message && (
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--nc-mut)', lineHeight: 1.5 }}>
            {toast.message}
          </p>
        )}
        {toast.action && (
          <button
            className="nc-link"
            style={{ marginTop: 9, fontSize: 12.5, color }}
            onClick={toast.action.onClick}
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        className="nc-btn nc-btn-ghost nc-btn-icon"
        style={{ width: 24, height: 24 }}
        onClick={dismiss}
        aria-label="Dismiss"
      >
        <Icon name="x" size={13} />
      </button>
    </div>
  );
};

export default ToastComponent;
