import React, { useCallback, useEffect, useState } from 'react';
import { adminData, DropboxEntry, FolderFile, PickedFile } from '../../services/adminData';
import { PickRow } from '../nocturne/Picker';
import { Icon } from '../nocturne/icons';
import { FolderRecord } from './types';

interface TrackPickerProps {
  /** Files picked so far; the picker only ever adds to or removes from this. */
  selected: PickedFile[];
  onChange: (next: PickedFile[]) => void;
}

/**
 * Browse Dropbox and check individual audio files into a playlist.
 *
 * Starts at the Dropbox root with the already-watched folders offered as
 * shortcuts; selections survive navigation, so picks can span any number of
 * folders — synced or not — without syncing anything.
 */
export const TrackPicker: React.FC<TrackPickerProps> = ({ selected, onChange }) => {
  const [path, setPath] = useState('');
  const [folders, setFolders] = useState<DropboxEntry[]>([]);
  const [files, setFiles] = useState<FolderFile[]>([]);
  const [shortcuts, setShortcuts] = useState<FolderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [folderRows, fileRows] = await Promise.all([
          adminData.browseDropbox(path),
          // The backend rejects an empty path, and the root holds no audio anyway.
          path ? adminData.previewFolderFiles(path) : Promise.resolve([]),
        ]);
        if (cancelled) return;
        setFolders(folderRows);
        setFiles(fileRows);
      } catch (loadError) {
        console.error('Error browsing Dropbox:', loadError);
        if (!cancelled) setError('Could not read this folder from Dropbox. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [path]);

  // Watched folders double as shortcuts at the root; a failure here only
  // costs the shortcuts, so it stays silent.
  useEffect(() => {
    let cancelled = false;
    adminData
      .listFolders()
      .then((rows) => {
        if (!cancelled) setShortcuts(rows);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const isPicked = useCallback(
    (file: FolderFile) => selected.some((pick) => pick.path === file.path),
    [selected]
  );

  const toggleFile = (file: FolderFile) => {
    onChange(
      isPicked(file)
        ? selected.filter((pick) => pick.path !== file.path)
        : [...selected, { path: file.path, name: file.name }]
    );
  };

  const parentPath = path.split('/').slice(0, -1).join('/');

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        {path ? (
          <button className="nc-link" onClick={() => setPath(parentPath)}>
            <Icon name="arrowLeft" size={13} />
            Back
          </button>
        ) : (
          <span style={{ fontSize: 12.5, color: 'var(--nc-mut)' }}>Dropbox</span>
        )}
        <span
          className="nc-truncate nc-mono"
          dir="auto"
          style={{ fontSize: 11.5, color: 'var(--nc-dim)', minWidth: 0, flex: 1 }}
        >
          {path || '/'}
        </span>
        <span style={{ fontSize: 12, color: 'var(--nc-mut)', whiteSpace: 'nowrap' }}>
          {selected.length} picked
        </span>
      </div>

      {loading ? (
        <div style={{ padding: 32, display: 'flex', justifyContent: 'center' }}>
          <div className="nc-spinner" />
        </div>
      ) : error ? (
        <div className="nc-notice nc-notice-danger" style={{ fontSize: 12.5 }}>
          <Icon name="warning" size={15} />
          {error}
        </div>
      ) : (
        <div
          className="nc-scroll"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            maxHeight: 320,
            paddingRight: 4,
          }}
        >
          {!path && shortcuts.length > 0 && (
            <>
              <div className="nc-kicker" style={{ margin: '2px 0 2px' }}>
                Watched folders
              </div>
              {shortcuts.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  className="nc-pick"
                  onClick={() => setPath(folder.dropboxPath)}
                >
                  <span className="nc-truncate" dir="auto" style={{ fontSize: 13.5, minWidth: 0 }}>
                    {folder.displayName || folder.name}
                  </span>
                  <Icon name="arrowLeft" size={13} style={{ transform: 'rotate(180deg)' }} />
                </button>
              ))}
              <div className="nc-kicker" style={{ margin: '8px 0 2px' }}>
                All of Dropbox
              </div>
            </>
          )}

          {folders.map((folder) => (
            <button
              key={folder.id}
              type="button"
              className="nc-pick"
              onClick={() => setPath(folder.path)}
            >
              <span className="nc-truncate" dir="auto" style={{ fontSize: 13.5, minWidth: 0 }}>
                {folder.name}
              </span>
              <Icon name="arrowLeft" size={13} style={{ transform: 'rotate(180deg)' }} />
            </button>
          ))}

          {files.map((file) => (
            <PickRow
              key={file.id}
              selected={isPicked(file)}
              onToggle={() => toggleFile(file)}
              title={file.name}
            />
          ))}

          {folders.length === 0 && files.length === 0 && (
            <p style={{ margin: '8px 0', fontSize: 13, color: 'var(--nc-mut)' }}>
              Nothing playable in this folder.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
