import React from 'react';

interface LoadingSpinnerProps {
  size?: number;
  /** Optional line under the spinner, set in the mono kicker style. */
  label?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 32, label = 'Loading' }) => (
  <div
    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}
    role="status"
    aria-live="polite"
  >
    <div className="nc-spinner" style={{ width: size, height: size }} />
    {label && (
      <span className="nc-kicker" style={{ fontSize: 10.5 }}>
        {label}
      </span>
    )}
  </div>
);
