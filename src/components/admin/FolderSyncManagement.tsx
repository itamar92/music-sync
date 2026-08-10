import React, { useCallback, useState, useEffect } from 'react';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { AddFolderModal } from './AddFolderModal';
import { Modal } from '../Modal';
import { adminData, FolderFile } from '../../services/adminData';
import { ToggleRow } from '../nocturne/Picker';
import { Icon, IconName } from '../nocturne/icons';
import { FolderRecord } from './types';

/** Firestore returns a Timestamp, the REST API an ISO string, a fresh write a Date. */
function formatLastSync(value: FolderRecord['lastSyncAt']): string {
  if (!value) return '';
  const date =
    typeof value === 'object' && 'seconds' in value
      ? new Date(value.seconds * 1000)
      : new Date(value as string | Date);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
}

/** Status glyph and colour per sync state. */
const STATUS: Record<string, { icon: IconName; color: string; label: string }> = {
  synced: { icon: 'check', color: 'var(--nc-cy)', label: 'SYNCED' },
  syncing: { icon: 'refresh', color: 'var(--nc-tl)', label: 'SYNCING' },
  error: { icon: 'warning', color: 'var(--nc-danger)', label: 'ERROR' },
  pending: { icon: 'refresh', color: 'var(--nc-mut)', label: 'PENDING' },
};

export const FolderSyncManagement: React.FC = () => {
  const isMobile = useIsMobile();
  const [folders, setFolders] = useState<FolderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<FolderRecord | null>(null);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [viewing, setViewing] = useState<FolderRecord | null>(null);
  const [folderFiles, setFolderFiles] = useState<FolderFile[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(false);

  const loadFolders = useCallback(async () => {
    setLoading(true);
    try {
      setFolders(await adminData.listFolders());
    } catch (error) {
      console.error('Error loading folders:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  // The Dropbox OAuth redirect leaves the page; when it returns, reopen the
  // modal the user was in the middle of.
  useEffect(() => {
    const handleAuthComplete = (event: Event) => {
      const detail = (event as CustomEvent).detail as { modal?: string } | undefined;
      if (detail?.modal === 'folder_add') setShowAdd(true);
    };

    window.addEventListener('dropbox_auth_complete', handleAuthComplete);
    return () => window.removeEventListener('dropbox_auth_complete', handleAuthComplete);
  }, []);

  const markSynced = async (folderId: string) => {
    setSyncingIds((prev) => new Set(prev).add(folderId));
    try {
      await adminData.syncFolder(folderId);
      await loadFolders();
    } catch (error) {
      console.error('Error syncing folder:', error);
      alert(error instanceof Error ? error.message : 'Sync failed. Please try again.');
      await loadFolders();
    } finally {
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(folderId);
        return next;
      });
    }
  };

  const removeFolder = async (folder: FolderRecord) => {
    if (!confirm(`Stop syncing "${folder.displayName || folder.name}"? Dropbox is untouched.`))
      return;

    try {
      await adminData.removeFolder(folder.id);
      await loadFolders();
    } catch (error) {
      console.error('Error deleting folder:', error);
      alert('Failed to remove folder. Please try again.');
    }
  };

  const saveFolder = async () => {
    if (!editing) return;

    try {
      await adminData.updateFolder(editing.id, {
        displayName: editing.displayName || editing.name,
        syncFrequency: editing.syncFrequency || 'manual',
        isActive: editing.isActive ?? true,
        includeSubfolders: editing.includeSubfolders ?? false,
      });
      setEditing(null);
      await loadFolders();
    } catch (error) {
      console.error('Error updating folder:', error);
      alert('Failed to update folder. Please try again.');
    }
  };

  const openFolder = async (folder: FolderRecord) => {
    setViewing(folder);
    setLoadingTracks(true);
    setFolderFiles([]);

    try {
      setFolderFiles(await adminData.listFolderFiles(folder.id));
    } catch (error) {
      console.error('Error loading folder tracks:', error);
      alert(
        error instanceof Error ? error.message : 'Failed to load folder contents. Please try again.'
      );
    } finally {
      setLoadingTracks(false);
    }
  };

  if (viewing) {
    return (
      <div style={{ maxWidth: 1180 }}>
        <button className="nc-link" style={{ marginBottom: 18 }} onClick={() => setViewing(null)}>
          <Icon name="arrowLeft" size={15} />
          Folder sync
        </button>

        <div className="nc-kicker" style={{ marginBottom: 10 }}>
          Watched folder
        </div>
        <h1
          className="nc-h1"
          dir="auto"
          style={{ fontSize: isMobile ? 24 : 30, marginBottom: 6, overflowWrap: 'anywhere' }}
        >
          {viewing.displayName || viewing.name}
        </h1>
        <p
          className="nc-mono"
          dir="auto"
          style={{
            margin: '0 0 24px',
            fontSize: 12,
            color: 'var(--nc-dim)',
            overflowWrap: 'anywhere',
          }}
        >
          {viewing.dropboxPath}
        </p>

        {loadingTracks ? (
          <div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}>
            <div className="nc-spinner" />
          </div>
        ) : folderFiles.length === 0 ? (
          <div className="nc-panel" style={{ padding: '48px 24px', textAlign: 'center' }}>
            <h3 className="nc-h2" style={{ marginBottom: 8 }}>
              No audio files found
            </h3>
            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--nc-mut)' }}>
              This folder has no files in a supported format.
            </p>
          </div>
        ) : (
          <div className="nc-table">
            {/* Narrower gutters and columns on a phone so the filename keeps
                the width it needs; the header is desktop-only. */}
            {!isMobile && (
              <div
                className="nc-table-head"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '48px 1fr 84px',
                  gap: 16,
                  padding: '11px 18px',
                }}
              >
                <span>#</span>
                <span>FILE</span>
                <span style={{ textAlign: 'right' }}>TIME</span>
              </div>
            )}
            {folderFiles.map((file, index) => (
              <div
                key={file.id}
                className="nc-table-row nc-row-hover"
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '30px 1fr 52px' : '48px 1fr 84px',
                  gap: isMobile ? 10 : 16,
                  padding: isMobile ? '11px 12px' : '11px 18px',
                  alignItems: 'center',
                }}
              >
                <span className="nc-mono" style={{ fontSize: 11.5, color: 'var(--nc-dim)' }}>
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span
                  className={isMobile ? 'nc-clamp2' : 'nc-truncate'}
                  dir="auto"
                  style={{ fontSize: 13.5, lineHeight: isMobile ? 1.3 : undefined }}
                >
                  {file.name}
                </span>
                <span
                  className="nc-mono"
                  style={{ fontSize: 11.5, color: 'var(--nc-muted)', textAlign: 'right' }}
                >
                  {file.duration || '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1180 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 20,
          marginBottom: 24,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div className="nc-kicker" style={{ marginBottom: 10 }}>
            Studio
          </div>
          <h1 className="nc-h1" style={{ fontSize: isMobile ? 24 : 30, marginBottom: 6 }}>
            Watched folders
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--nc-mut)' }}>
            Dropbox folders MusicSync pulls tracks from.
          </p>
        </div>
        <button className="nc-btn nc-btn-accent" onClick={() => setShowAdd(true)}>
          <Icon name="plus" size={15} />
          Add folder
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}>
          <div className="nc-spinner" />
        </div>
      ) : folders.length === 0 ? (
        <div className="nc-panel" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <h3 className="nc-h2" style={{ marginBottom: 8 }}>
            No folders yet
          </h3>
          <p style={{ margin: '0 0 20px', fontSize: 13.5, color: 'var(--nc-mut)' }}>
            Point MusicSync at a Dropbox folder and its bounces show up here.
          </p>
          <button className="nc-btn nc-btn-accent" onClick={() => setShowAdd(true)}>
            <Icon name="plus" size={15} />
            Add your first folder
          </button>
        </div>
      ) : (
        <div className="nc-table">
          {/*
            Four fixed columns need ~424px before padding, so on a phone the row
            folds into a stack instead: name and path on their own lines, then
            files, status and the actions on one footer line. The header only
            labels the desktop columns, so it goes with them.
          */}
          {!isMobile && (
            <div
              className="nc-table-head"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 120px 116px 140px',
                gap: 16,
                padding: '11px 18px',
              }}
            >
              <span>DROPBOX PATH</span>
              <span>FILES</span>
              <span>STATUS</span>
              <span style={{ textAlign: 'right' }}>ACTIONS</span>
            </div>
          )}

          {folders.map((folder) => {
            const status = STATUS[folder.status || 'pending'] || STATUS.pending;
            const isSyncing = syncingIds.has(folder.id) || folder.status === 'syncing';

            const name = (
              <div style={{ minWidth: 0 }}>
                <div
                  className={isMobile ? 'nc-clamp2' : 'nc-truncate'}
                  dir="auto"
                  style={{ fontSize: 13.5, fontWeight: 500, lineHeight: isMobile ? 1.3 : undefined }}
                >
                  {folder.displayName || folder.name}
                </div>
                <div
                  className={isMobile ? 'nc-clamp2 nc-mono' : 'nc-truncate nc-mono'}
                  dir="auto"
                  style={{ fontSize: 11.5, color: 'var(--nc-dim)', lineHeight: isMobile ? 1.35 : undefined }}
                >
                  {folder.dropboxPath}
                  {folder.includeSubfolders && ' · incl. subfolders'}
                  {formatLastSync(folder.lastSyncAt) && ` · ${formatLastSync(folder.lastSyncAt)}`}
                </div>
              </div>
            );

            const files = (
              <span className="nc-mono" style={{ fontSize: 11.5, color: 'var(--nc-muted)' }}>
                {folder.syncedFiles || 0}/{folder.totalFiles || 0}
              </span>
            );

            const state = (
              <span
                className="nc-mono"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  color: status.color,
                }}
              >
                <Icon
                  name={status.icon}
                  size={13}
                  style={isSyncing ? { animation: 'ms-spin 0.8s linear infinite' } : undefined}
                />
                {isSyncing ? 'SYNCING' : status.label}
              </span>
            );

            const actions = (
              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                <button
                  className="nc-btn nc-btn-ghost nc-btn-icon"
                  onClick={() => openFolder(folder)}
                  title="View files"
                  aria-label={`View files in ${folder.displayName || folder.name}`}
                >
                  <Icon name="eye" size={15} />
                </button>
                <button
                  className="nc-btn nc-btn-ghost nc-btn-icon"
                  onClick={() => markSynced(folder.id)}
                  disabled={isSyncing}
                  title="Sync now"
                  aria-label={`Sync ${folder.displayName || folder.name} now`}
                >
                  <Icon
                    name="refresh"
                    size={15}
                    style={isSyncing ? { animation: 'ms-spin 0.8s linear infinite' } : undefined}
                  />
                </button>
                <button
                  className="nc-btn nc-btn-ghost nc-btn-icon"
                  onClick={() => setEditing(folder)}
                  title="Edit"
                  aria-label={`Edit ${folder.displayName || folder.name}`}
                >
                  <Icon name="pencil" size={15} />
                </button>
                <button
                  className="nc-btn nc-btn-ghost nc-btn-icon"
                  style={{ color: 'var(--nc-danger)' }}
                  onClick={() => removeFolder(folder)}
                  title="Stop syncing"
                  aria-label={`Stop syncing ${folder.displayName || folder.name}`}
                >
                  <Icon name="trash" size={15} />
                </button>
              </div>
            );

            if (isMobile) {
              return (
                <div
                  key={folder.id}
                  className="nc-table-row"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    padding: '13px 12px',
                  }}
                >
                  {name}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      {state}
                      {files}
                    </div>
                    {actions}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={folder.id}
                className="nc-table-row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 120px 116px 140px',
                  gap: 16,
                  padding: '13px 18px',
                  alignItems: 'center',
                }}
              >
                {name}
                {files}
                {state}
                {actions}
              </div>
            );
          })}
        </div>
      )}

      <AddFolderModal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        onSuccess={(added: FolderRecord) => setFolders((prev) => [...prev, added])}
      />

      <Modal
        isOpen={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit folder sync"
        kicker="Watched folder"
        width={440}
      >
        {editing && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="nc-field">
              <label className="nc-label" htmlFor="folder-name">
                Display name
              </label>
              <input
                id="folder-name"
                className="nc-input"
                value={editing.displayName || editing.name}
                onChange={(e) => setEditing({ ...editing, displayName: e.target.value })}
              />
            </div>

            <div className="nc-field">
              <label className="nc-label" htmlFor="folder-frequency">
                Sync frequency
              </label>
              <select
                id="folder-frequency"
                className="nc-select"
                value={editing.syncFrequency || 'manual'}
                onChange={(e) => setEditing({ ...editing, syncFrequency: e.target.value })}
              >
                <option value="manual">Manual</option>
                <option value="hourly">Every hour</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>

            <ToggleRow
              checked={editing.isActive ?? true}
              onChange={(isActive) => setEditing({ ...editing, isActive })}
              label="Keep this folder in sync"
            />

            {adminData.capabilities.recursiveFolderSync && (
              <ToggleRow
                checked={editing.includeSubfolders ?? false}
                onChange={(includeSubfolders) => setEditing({ ...editing, includeSubfolders })}
                label="Include subfolders"
                hint="Also pull audio files from every folder inside this one. Takes effect on the next sync."
              />
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <button
                className="nc-btn"
                style={{ flex: 1, height: 38 }}
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button
                className="nc-btn nc-btn-accent"
                style={{ flex: 1, height: 38 }}
                onClick={saveFolder}
              >
                Save changes
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
