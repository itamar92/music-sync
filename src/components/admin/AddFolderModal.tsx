import React, { useCallback, useState, useEffect } from 'react';
import { useDropbox } from '../../hooks/useDropbox';
import { adminData, DropboxEntry, FolderFile } from '../../services/adminData';
import { FolderRecord } from './types';
import { Modal } from '../Modal';
import { DialogActions, FormError, ToggleRow } from '../nocturne/Picker';
import { Icon } from '../nocturne/icons';

/**
 * Browse Dropbox and start watching a folder.
 *
 * Where the Dropbox credential lives decides how this behaves. In Firebase mode
 * the browser holds the user's own OAuth token, so the modal may have to send
 * them through Dropbox first. In container mode the backend holds a refresh
 * token, the browser never authenticates, and browsing is simply a server call
 * — so none of the connect flow renders at all.
 */

interface AddFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (folder: FolderRecord) => void;
}

/** Counts fill in per row as they resolve, rather than blocking the listing. */
interface FolderStatsState {
  [path: string]: { trackCount: number; hasSubfolders: boolean } | 'loading';
}

export const AddFolderModal: React.FC<AddFolderModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { clientDropboxAuth, recursiveFolderSync } = adminData.capabilities;
  const clientDropbox = useDropbox();

  const [path, setPath] = useState('');
  const [entries, setEntries] = useState<DropboxEntry[]>([]);
  const [stats, setStats] = useState<FolderStatsState>({});
  const [selected, setSelected] = useState<DropboxEntry | null>(null);
  const [frequency, setFrequency] = useState('manual');
  const [includeSubfolders, setIncludeSubfolders] = useState(false);
  const [preview, setPreview] = useState<FolderFile[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [browsing, setBrowsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Container mode has nothing to connect; treat it as always ready.
  const connected = clientDropboxAuth ? clientDropbox.isConnected : true;
  const connecting = clientDropboxAuth ? clientDropbox.isConnecting : false;
  const connectionError = clientDropboxAuth ? clientDropbox.error : null;

  const browse = useCallback(async (nextPath: string) => {
    setBrowsing(true);
    setError('');
    try {
      const rows = await adminData.browseDropbox(nextPath);
      setEntries(rows);
      setPath(nextPath);
      setStats({});
    } catch (browseError) {
      console.error('Failed to browse Dropbox:', browseError);
      setError(browseError instanceof Error ? browseError.message : 'Failed to browse Dropbox');
    } finally {
      setBrowsing(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && connected) browse('');
  }, [isOpen, connected, browse]);

  // Ask for each visible folder's contents once the listing is on screen.
  useEffect(() => {
    if (!entries.length) return;

    let cancelled = false;
    (async () => {
      for (const entry of entries) {
        if (cancelled) return;
        setStats((prev) => (prev[entry.path] ? prev : { ...prev, [entry.path]: 'loading' }));
        try {
          const result = await adminData.folderStats(entry.path);
          if (!cancelled) setStats((prev) => ({ ...prev, [entry.path]: result }));
        } catch {
          // A folder we can't inspect is still selectable; leave it unlabelled.
          if (!cancelled) {
            setStats((prev) => ({
              ...prev,
              [entry.path]: { trackCount: 0, hasSubfolders: false },
            }));
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [entries]);

  // Preview what the selected folder would sync, so subfolder tracks aren't a surprise.
  useEffect(() => {
    if (!selected) {
      setPreview(null);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    (async () => {
      try {
        const files = await adminData.previewFolderFiles(selected.path, includeSubfolders);
        if (!cancelled) setPreview(files);
      } catch (previewError) {
        console.error('Failed to preview folder contents:', previewError);
        if (!cancelled) setPreview([]);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selected, includeSubfolders]);

  const close = () => {
    setSelected(null);
    setFrequency('manual');
    setIncludeSubfolders(false);
    setPreview(null);
    setSearch('');
    setError('');
    setEntries([]);
    setStats({});
    onClose();
  };

  const connect = async () => {
    setError('');
    try {
      const { dropboxService } = await import('../../services/dropboxService');
      const authUrl = await dropboxService.authenticate(false);
      if (authUrl && typeof authUrl === 'string') {
        // Remembered so FolderSyncManagement can reopen this modal on return.
        localStorage.setItem('dropbox_auth_in_progress', 'true');
        localStorage.setItem('dropbox_auth_modal', 'folder_add');
        window.location.href = authUrl;
      }
    } catch (err) {
      console.error('Failed to get auth URL:', err);
      setError(`Failed to start authentication: ${err}`);
    }
  };

  /**
   * Escape hatch for when the OAuth redirect can't return to the app — strict
   * popup blockers, or a mismatched redirect URI. The user pastes the URL they
   * landed on and the code is read out of it.
   */
  const pasteCallback = async () => {
    const callbackUrl = window.prompt(
      'Paste the full URL you were redirected to after Dropbox authentication:'
    );
    if (!callbackUrl) return;

    try {
      const url = new URL(callbackUrl);
      const code = url.searchParams.get('code');
      const accessToken = url.hash.match(/access_token=([^&]+)/)?.[1];
      const { dropboxService } = await import('../../services/dropboxService');

      if (code) {
        if (!(await dropboxService.handleAuthCallback(code))) {
          setError('Failed to exchange the authorization code for an access token');
          return;
        }
      } else if (accessToken) {
        localStorage.setItem('dropbox_access_token', accessToken);
      } else {
        setError('No authorization code or access token found in that URL');
        return;
      }

      await browse('');
    } catch (err) {
      setError(`Authentication failed: ${err}`);
    }
  };

  const submit = async () => {
    if (!selected) {
      setError('Please select a folder to sync');
      return;
    }

    setSaving(true);
    setError('');
    try {
      onSuccess(
        await adminData.addFolder({
          dropboxPath: selected.path,
          name: selected.name,
          displayName: selected.name,
          syncFrequency: frequency,
          includeSubfolders,
        })
      );
      close();
    } catch (submitError) {
      console.error('Error adding folder:', submitError);
      setError(submitError instanceof Error ? submitError.message : 'Failed to add folder');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  // ── needs the browser to authenticate (Firebase mode only) ────────────────
  if (clientDropboxAuth && !connected) {
    const expired = connectionError?.includes('expired');

    return (
      <Modal
        isOpen
        onClose={close}
        title={expired ? 'Dropbox session expired' : 'Connect to Dropbox'}
        kicker="Folder sync"
        width={420}
      >
        <p style={{ margin: '0 0 8px', fontSize: 13.5, color: 'var(--nc-mut)', lineHeight: 1.6 }}>
          {connectionError || 'Connect your Dropbox account to browse and sync folders.'}
        </p>
        <p style={{ margin: '0 0 18px', fontSize: 12.5, color: 'var(--nc-dim)' }}>
          {expired
            ? 'Reconnect to continue where you left off.'
            : 'You will be sent to Dropbox and returned here afterwards.'}
        </p>

        <FormError message={error} />

        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button
            className="nc-btn"
            style={{ flex: 1, height: 38 }}
            onClick={() => {
              setError('');
              clientDropbox.retry();
            }}
            disabled={connecting}
          >
            {connecting ? 'Checking…' : 'Retry'}
          </button>
          <button className="nc-btn nc-btn-accent" style={{ flex: 1, height: 38 }} onClick={connect}>
            Connect Dropbox
          </button>
        </div>

        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--nc-line)' }}>
          <button className="nc-link" style={{ fontSize: 12.5 }} onClick={pasteCallback}>
            <Icon name="warning" size={13} />
            Redirect didn&apos;t come back? Paste the callback URL
          </button>
        </div>
      </Modal>
    );
  }

  // ── browser ───────────────────────────────────────────────────────────────
  const filtered = entries.filter(
    (entry) =>
      entry.name.toLowerCase().includes(search.toLowerCase()) ||
      entry.path.toLowerCase().includes(search.toLowerCase())
  );

  const crumbs = path ? ['Home', ...path.split('/').filter(Boolean)] : ['Home'];

  const goToCrumb = (index: number) => {
    if (index === 0) {
      browse('');
      return;
    }
    browse(`/${path.split('/').filter(Boolean).slice(0, index).join('/')}`);
  };

  const describe = (entry: DropboxEntry): string => {
    const stat = stats[entry.path];
    if (!stat || stat === 'loading') return 'COUNTING…';
    const parts = [stat.trackCount > 0 ? `${stat.trackCount} TRACKS` : 'NO TRACKS'];
    if (stat.hasSubfolders) parts.push('HAS SUBFOLDERS');
    if (search) parts.push(entry.path);
    return parts.join(' · ');
  };

  return (
    <Modal isOpen onClose={close} title="Browse Dropbox" kicker="Folder sync" width={720}>
      {selected && (
        <div style={{ marginBottom: 14 }}>
          <div className="nc-notice">
            <Icon name="folder" size={16} color="var(--nc-accent-text)" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="nc-truncate" style={{ fontSize: 13.5, fontWeight: 500 }}>
                {selected.name}
              </div>
              <div className="nc-truncate nc-mono" style={{ fontSize: 11.5, color: 'var(--nc-dim)' }}>
                {selected.path}
              </div>
            </div>
            <button
              className="nc-btn nc-btn-ghost nc-btn-icon"
              style={{ width: 26, height: 26 }}
              onClick={() => setSelected(null)}
              aria-label="Clear selection"
            >
              <Icon name="x" size={13} />
            </button>
          </div>

          <div style={{ marginTop: 8, padding: '10px 12px', border: '1px solid var(--nc-line)', borderRadius: 8 }}>
            <div className="nc-mono" style={{ fontSize: 11, color: 'var(--nc-dim)', marginBottom: 6 }}>
              {previewLoading
                ? 'READING FOLDER…'
                : `${preview?.length ?? 0} TRACKS WILL SYNC${includeSubfolders ? ' (INCLUDING SUBFOLDERS)' : ''}`}
            </div>
            {!previewLoading && preview && preview.length > 0 && (
              <div
                className="nc-scroll"
                style={{ maxHeight: 120, overflowY: 'auto', paddingRight: 4 }}
              >
                {preview.map((file) => (
                  <div
                    key={file.id}
                    className="nc-truncate"
                    style={{ fontSize: 12, color: 'var(--nc-mut)', lineHeight: 1.7 }}
                    title={file.path}
                  >
                    {file.name}
                  </div>
                ))}
              </div>
            )}
            {!previewLoading && preview && preview.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--nc-mut)' }}>
                No audio files here{recursiveFolderSync && !includeSubfolders
                  ? ' — try including subfolders below.'
                  : '.'}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="nc-search" style={{ height: 38, marginBottom: 14 }}>
        <Icon name="search" size={14} color="var(--nc-mut)" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search folders"
          aria-label="Search folders"
        />
      </div>

      {!search && (
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}
        >
          {path && (
            <button
              className="nc-btn nc-btn-ghost nc-btn-icon"
              style={{ width: 26, height: 26, marginRight: 4 }}
              onClick={() => browse(path.split('/').slice(0, -1).join('/'))}
              aria-label="Up one level"
            >
              <Icon name="arrowLeft" size={14} />
            </button>
          )}
          {crumbs.map((crumb, index) => (
            <React.Fragment key={`${crumb}-${index}`}>
              {index > 0 && <Icon name="caretRight" size={12} color="var(--nc-faint)" />}
              <button
                onClick={() => goToCrumb(index)}
                className="nc-mono"
                style={{
                  padding: '3px 7px',
                  borderRadius: 6,
                  background: 'none',
                  border: 'none',
                  fontSize: 11.5,
                  cursor: 'pointer',
                  color:
                    index === crumbs.length - 1 ? 'var(--nc-accent-text-bright)' : 'var(--nc-mut)',
                }}
              >
                {crumb}
              </button>
            </React.Fragment>
          ))}
          {browsing && (
            <Icon
              name="refresh"
              size={13}
              color="var(--nc-dim)"
              style={{ animation: 'ms-spin 0.8s linear infinite', marginLeft: 6 }}
            />
          )}
        </div>
      )}

      <div
        className="nc-scroll"
        style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 340, paddingRight: 4 }}
      >
        {filtered.length === 0 ? (
          <p style={{ padding: '24px 0', fontSize: 13, color: 'var(--nc-mut)', textAlign: 'center' }}>
            {browsing
              ? 'Loading…'
              : search
                ? 'No folders match that search.'
                : 'No folders in this location.'}
          </p>
        ) : (
          filtered.map((entry) => {
            const stat = stats[entry.path];
            const hasSubfolders = stat && stat !== 'loading' ? stat.hasSubfolders : false;

            return (
              <button
                key={entry.id || entry.path}
                type="button"
                className="nc-pick"
                aria-pressed={selected?.path === entry.path}
                onClick={() => setSelected(entry)}
                onDoubleClick={() => hasSubfolders && browse(entry.path)}
              >
                <Icon
                  name="folder"
                  size={16}
                  color={hasSubfolders ? 'var(--nc-accent-text)' : 'var(--nc-mut)'}
                />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    className="nc-truncate"
                    style={{ display: 'block', fontSize: 13.5, fontWeight: 500 }}
                  >
                    {entry.name}
                  </span>
                  <span
                    className="nc-truncate nc-mono"
                    style={{ display: 'block', fontSize: 11, color: 'var(--nc-dim)' }}
                  >
                    {describe(entry)}
                  </span>
                </span>

                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    browse(entry.path);
                  }}
                  title="Open folder"
                  style={{ color: 'var(--nc-mut)', display: 'flex', padding: 2 }}
                >
                  <Icon name="caretRight" size={14} />
                </span>

                <span className="nc-pick-tick">
                  <Icon name="check" size={11} />
                </span>
              </button>
            );
          })
        )}
      </div>

      <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--nc-line)' }}>
        <div className="nc-field" style={{ marginBottom: 14 }}>
          <label className="nc-label" htmlFor="af-frequency">
            Sync frequency
          </label>
          <select
            id="af-frequency"
            className="nc-select"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
          >
            <option value="manual">Manual</option>
            <option value="hourly">Every hour</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>

        {recursiveFolderSync && (
          <div style={{ marginBottom: 14 }}>
            <ToggleRow
              checked={includeSubfolders}
              onChange={setIncludeSubfolders}
              label="Include subfolders"
              hint="Also pull audio files from every folder inside this one."
            />
          </div>
        )}

        <FormError message={error} />

        <DialogActions
          onCancel={close}
          onConfirm={submit}
          confirmLabel={selected ? `Watch “${selected.name}”` : 'Add folder'}
          busy={saving}
          disabled={!selected}
        />
      </div>
    </Modal>
  );
};
