import React from 'react';
import { Icon } from './icons';

/**
 * Shared pieces for the admin's create/edit dialogs — a segmented view switch
 * and the selectable rows used to attach playlists or folders to a record.
 */

interface SegmentedProps<T extends string> {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  label: string;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: SegmentedProps<T>) {
  return (
    <div className="nc-seg" role="tablist" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          className="nc-seg-opt"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

interface PickRowProps {
  selected: boolean;
  onToggle: () => void;
  title: string;
  subtitle?: string;
}

export const PickRow: React.FC<PickRowProps> = ({ selected, onToggle, title, subtitle }) => (
  <button type="button" className="nc-pick" aria-pressed={selected} onClick={onToggle}>
    <span style={{ minWidth: 0 }}>
      <span
        className="nc-truncate"
        style={{ display: 'block', fontSize: 13.5, fontWeight: 500 }}
      >
        {title}
      </span>
      {subtitle && (
        <span
          className="nc-truncate"
          style={{ display: 'block', fontSize: 11.5, color: 'var(--nc-mut)' }}
        >
          {subtitle}
        </span>
      )}
    </span>
    <span className="nc-pick-tick">
      <Icon name="check" size={11} />
    </span>
  </button>
);

interface ToggleRowProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
}

/** A labelled checkbox row for dialog options — visibility, sync scope, etc. */
export const ToggleRow: React.FC<ToggleRowProps> = ({ checked, onChange, label, hint }) => (
  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, cursor: 'pointer' }}>
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      style={{ accentColor: 'var(--nc-tl)', marginTop: 2 }}
    />
    <span style={{ minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: 13 }}>{label}</span>
      {hint && (
        <span style={{ display: 'block', fontSize: 11.5, color: 'var(--nc-mut)' }}>{hint}</span>
      )}
    </span>
  </label>
);

/** The Cancel / confirm pair every dialog ends with. */
export const DialogActions: React.FC<{
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  busy?: boolean;
  disabled?: boolean;
  secondaryLabel?: string;
}> = ({ onCancel, onConfirm, confirmLabel, busy, disabled, secondaryLabel = 'Cancel' }) => (
  <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
    <button type="button" className="nc-btn" style={{ flex: 1, height: 38 }} onClick={onCancel}>
      {secondaryLabel}
    </button>
    <button
      type="button"
      className="nc-btn nc-btn-accent"
      style={{ flex: 1, height: 38 }}
      onClick={onConfirm}
      disabled={busy || disabled}
    >
      {busy ? 'Working…' : confirmLabel}
    </button>
  </div>
);

/** Inline form-level error, styled as the danger notice. */
export const FormError: React.FC<{ message?: string }> = ({ message }) =>
  message ? (
    <div className="nc-notice nc-notice-danger" style={{ fontSize: 12.5 }}>
      <Icon name="warning" size={15} />
      {message}
    </div>
  ) : null;
