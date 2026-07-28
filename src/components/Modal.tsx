import React, { useEffect } from 'react';
import { Icon } from './nocturne/icons';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** Small tracked-out label above the title. */
  kicker?: string;
  children: React.ReactNode;
  /** Dialog width in px; the design's default is a comfortable form width. */
  width?: number;
}

/**
 * The app's dialog: a panel at the top elevation, capped by the 2px spectrum
 * seam that marks every Nocturne modal.
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  kicker,
  children,
  width = 560,
}) => {
  // Escape closes, and the page behind stops scrolling while the modal is up.
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;

    window.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="nc-backdrop" onClick={onClose} role="presentation">
      <div
        className="nc-dialog"
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="nc-dialog-seam" />
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            padding: '22px 28px 0',
          }}
        >
          <div>
            {kicker && (
              <div className="nc-kicker" style={{ fontSize: 10.5, marginBottom: 8 }}>
                {kicker}
              </div>
            )}
            <h2 className="nc-h2">{title}</h2>
          </div>
          <button className="nc-btn nc-btn-icon" onClick={onClose} aria-label="Close">
            <Icon name="x" size={15} />
          </button>
        </div>
        <div className="nc-dialog-body" style={{ paddingTop: 20 }}>
          {children}
        </div>
      </div>
    </div>
  );
};

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareUrl: string;
  onCopy: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, shareUrl, onCopy }) => (
  <Modal isOpen={isOpen} onClose={onClose} title="Share link" kicker="Public link" width={440}>
    <p style={{ margin: '0 0 14px', fontSize: 13.5, color: 'var(--nc-mut)' }}>
      Anyone with this link can listen. It always serves the current version.
    </p>
    <div style={{ display: 'flex', gap: 8 }}>
      <input className="nc-input nc-mono" style={{ fontSize: 12 }} value={shareUrl} readOnly />
      <button className="nc-btn nc-btn-accent" style={{ height: 38 }} onClick={onCopy}>
        Copy
      </button>
    </div>
  </Modal>
);
