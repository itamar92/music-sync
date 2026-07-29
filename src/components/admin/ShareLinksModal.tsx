import React, { useCallback, useEffect, useState } from 'react';
import { adminApi, CollectionShare } from '../../services/adminApiService';
import { Modal } from '../Modal';
import { FormError } from '../nocturne/Picker';
import { Icon } from '../nocturne/icons';
import { CollectionRecord } from './types';

/**
 * Share links for one collection.
 *
 * A collection is otherwise all-or-nothing: on the home page for everyone, or
 * invisible. A link here is the middle ground — send it to one person and they
 * get this collection and nothing else, without an account.
 *
 * Container mode only; the caller gates on it. Revoked links stay listed rather
 * than disappearing, so it's clear which link you handed out and killed.
 */

interface ShareLinksModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection: CollectionRecord | null;
}

const shareUrl = (share: CollectionShare) => `${window.location.origin}/share/${share.token}`;

const formatDate = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
};

export const ShareLinksModal: React.FC<ShareLinksModalProps> = ({
  isOpen,
  onClose,
  collection,
}) => {
  const [shares, setShares] = useState<CollectionShare[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const collectionId = collection?.id;

  const load = useCallback(async () => {
    if (!collectionId) return;
    setLoading(true);
    setError('');
    try {
      setShares(await adminApi.listCollectionShares(collectionId));
    } catch (loadError) {
      console.error('Error loading share links:', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Failed to load share links');
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  useEffect(() => {
    if (!isOpen) return;
    setCopied(null);
    load();
  }, [isOpen, load]);

  /** Wrap a mutation so one failure can't leave the list stale or the UI stuck. */
  const run = async (action: () => Promise<void>, failure: string) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (actionError) {
      console.error(failure, actionError);
      setError(actionError instanceof Error ? actionError.message : failure);
    } finally {
      setBusy(false);
    }
  };

  const create = () =>
    run(async () => {
      if (!collectionId) return;
      const created = await adminApi.createCollectionShare(collectionId);
      setShares((prev) => [created, ...prev]);
      await copy(created);
    }, 'Failed to create share link');

  const revoke = (share: CollectionShare) =>
    run(async () => {
      const revoked = await adminApi.revokeShare(share.id);
      setShares((prev) => prev.map((item) => (item.id === share.id ? revoked : item)));
    }, 'Failed to revoke share link');

  // Regenerate is revoke + create, so the old link is dead the moment the new
  // one exists — there is no window where both work.
  const regenerate = (share: CollectionShare) =>
    run(async () => {
      if (!collectionId) return;
      const revoked = await adminApi.revokeShare(share.id);
      const created = await adminApi.createCollectionShare(collectionId);
      setShares((prev) => [created, ...prev.map((item) => (item.id === share.id ? revoked : item))]);
      await copy(created);
    }, 'Failed to regenerate share link');

  const copy = async (share: CollectionShare) => {
    const url = shareUrl(share);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(share.id);
    } catch {
      window.prompt('Copy this link', url);
    }
  };

  if (!collection) return null;

  const active = shares.filter((share) => !share.revokedAt);
  const revoked = shares.filter((share) => share.revokedAt);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Share links"
      kicker={collection.displayName || collection.name}
      width={600}
    >
      <p style={{ margin: '0 0 16px', fontSize: 13.5, lineHeight: 1.6, color: 'var(--nc-mut)' }}>
        Anyone with a link can browse and play this collection — nothing else in the library. Links
        never expire; revoke one to kill it.
      </p>

      {collection.isPublic && (
        <div className="nc-notice" style={{ fontSize: 12.5, marginBottom: 16 }}>
          <Icon name="globe" size={15} />
          This collection is already public, so it&apos;s listed on the home page for everyone.
        </div>
      )}

      {loading ? (
        <div style={{ padding: 32, display: 'flex', justifyContent: 'center' }}>
          <div className="nc-spinner" />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {active.length === 0 && (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--nc-mut)' }}>
              No active links. Create one to start sharing.
            </p>
          )}

          {active.map((share) => (
            <div key={share.id} className="nc-panel" style={{ padding: 12 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input
                  className="nc-input nc-mono"
                  style={{ fontSize: 11.5 }}
                  value={shareUrl(share)}
                  readOnly
                  aria-label="Share link"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  className="nc-btn nc-btn-accent"
                  style={{ height: 38, flexShrink: 0 }}
                  onClick={() => copy(share)}
                >
                  <Icon name={copied === share.id ? 'check' : 'share'} size={14} />
                  {copied === share.id ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
              >
                <span className="nc-mono" style={{ fontSize: 11, color: 'var(--nc-dim)' }}>
                  CREATED {formatDate(share.createdAt)}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="nc-btn nc-btn-ghost"
                    onClick={() => regenerate(share)}
                    disabled={busy}
                    title="Revoke this link and create a new one"
                  >
                    <Icon name="refresh" size={14} />
                    Regenerate
                  </button>
                  <button
                    className="nc-btn nc-btn-ghost"
                    style={{ color: 'var(--nc-danger)' }}
                    onClick={() => revoke(share)}
                    disabled={busy}
                  >
                    <Icon name="plugOff" size={14} />
                    Revoke
                  </button>
                </div>
              </div>
            </div>
          ))}

          {revoked.length > 0 && (
            <>
              <div className="nc-mono" style={{ fontSize: 10.5, letterSpacing: '0.12em', color: 'var(--nc-dim)', marginTop: 8 }}>
                REVOKED
              </div>
              {revoked.map((share) => (
                <div
                  key={share.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '8px 12px',
                    fontSize: 12,
                    color: 'var(--nc-dim)',
                  }}
                >
                  <span className="nc-mono nc-truncate">…{share.token.slice(-8)}</span>
                  <span className="nc-mono" style={{ flexShrink: 0 }}>
                    {formatDate(share.revokedAt as string)}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <FormError message={error} />
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button className="nc-btn" style={{ flex: 1, height: 38 }} onClick={onClose}>
          Done
        </button>
        <button
          className="nc-btn nc-btn-accent"
          style={{ flex: 1, height: 38 }}
          onClick={create}
          disabled={busy || loading}
        >
          <Icon name="plus" size={14} />
          {busy ? 'Working…' : 'Create link'}
        </button>
      </div>
    </Modal>
  );
};
