import React, { useState, useEffect } from 'react';
import { adminData } from '../../services/adminData';
import { Modal } from '../Modal';
import { Segmented, PickRow, DialogActions, FormError, ToggleRow } from '../nocturne/Picker';
import { PlaylistRecord, PickerOption } from './types';

interface EditPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (playlist: PlaylistRecord) => void;
  playlist: PlaylistRecord | null;
}

const EMPTY = {
  name: '',
  displayName: '',
  description: '',
  coverImageUrl: '',
  collectionId: '',
  isPublic: true,
};

export const EditPlaylistModal: React.FC<EditPlaylistModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  playlist,
}) => {
  const [collections, setCollections] = useState<PickerOption[]>([]);
  const [folders, setFolders] = useState<PickerOption[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [tab, setTab] = useState<'details' | 'folders'>('details');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !playlist) return;
    setForm({
      name: playlist.name || '',
      displayName: playlist.displayName || '',
      description: playlist.description || '',
      coverImageUrl: playlist.coverImageUrl || '',
      collectionId: playlist.collectionId || '',
      isPublic: playlist.isPublic ?? true,
    });
    setSelectedFolders(playlist.folderIds || []);
  }, [isOpen, playlist]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    (async () => {
      try {
        const [collectionRows, folderRows] = await Promise.all([
          adminData.listCollections(),
          adminData.listFolders(),
        ]);
        if (cancelled) return;
        setCollections(collectionRows as PickerOption[]);
        setFolders(folderRows as PickerOption[]);
      } catch (loadError) {
        console.error('Error loading data:', loadError);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const close = () => {
    setForm(EMPTY);
    setSelectedFolders([]);
    setTab('details');
    setError('');
    onClose();
  };

  const submit = async () => {
    if (!playlist) {
      setError('No playlist selected');
      return;
    }
    if (!form.name.trim()) {
      setError('Playlist name is required');
      setTab('details');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const updated = await adminData.updatePlaylist(playlist.id, {
        name: form.name.trim(),
        displayName: form.displayName.trim() || form.name.trim(),
        description: form.description.trim(),
        coverImageUrl: form.coverImageUrl.trim(),
        collectionId: form.collectionId || null,
        isPublic: form.isPublic,
        folderIds: selectedFolders,
      });
      onSuccess({ ...playlist, ...updated });
      close();
    } catch (submitError) {
      console.error('Error updating playlist:', submitError);
      setError('Failed to update playlist. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!playlist) return null;

  return (
    <Modal isOpen={isOpen} onClose={close} title="Edit playlist" kicker="Studio" width={560}>
      <Segmented<'details' | 'folders'>
        label="Playlist sections"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'details', label: 'Details' },
          { value: 'folders', label: `Folders (${selectedFolders.length})` },
        ]}
      />

      <div style={{ marginTop: 18 }}>
        {tab === 'details' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="nc-field">
              <label className="nc-label" htmlFor="ep-name">
                Playlist name
              </label>
              <input
                id="ep-name"
                className="nc-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div className="nc-field">
              <label className="nc-label" htmlFor="ep-display">
                Display name
              </label>
              <input
                id="ep-display"
                className="nc-input"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              />
            </div>

            <div className="nc-field">
              <label className="nc-label" htmlFor="ep-collection">
                Collection
              </label>
              <select
                id="ep-collection"
                className="nc-select"
                value={form.collectionId}
                onChange={(e) => setForm({ ...form, collectionId: e.target.value })}
              >
                <option value="">No collection</option>
                {collections.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.displayName || item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="nc-field">
              <label className="nc-label" htmlFor="ep-description">
                Description
              </label>
              <textarea
                id="ep-description"
                className="nc-textarea"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="nc-field">
              <label className="nc-label" htmlFor="ep-cover">
                Cover image URL
              </label>
              <input
                id="ep-cover"
                className="nc-input"
                type="url"
                value={form.coverImageUrl}
                onChange={(e) => setForm({ ...form, coverImageUrl: e.target.value })}
                placeholder="https://…"
              />
            </div>

            <ToggleRow
              checked={form.isPublic}
              onChange={(isPublic) => setForm({ ...form, isPublic })}
              label="Visible on the public site"
              hint="Private playlists never appear to visitors, even inside a public collection."
            />

            <FormError message={error} />
            <DialogActions onCancel={close} onConfirm={submit} confirmLabel="Save changes" busy={loading} />
          </div>
        ) : (
          <div>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--nc-mut)' }}>
              Tracks come from the Dropbox folders attached here.
            </p>

            {folders.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--nc-mut)' }}>
                No synced folders yet — add one under Folder sync first.
              </p>
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
                {folders.map((folder) => (
                  <PickRow
                    key={folder.id}
                    selected={selectedFolders.includes(folder.id)}
                    onToggle={() =>
                      setSelectedFolders((prev) =>
                        prev.includes(folder.id)
                          ? prev.filter((id) => id !== folder.id)
                          : [...prev, folder.id]
                      )
                    }
                    title={folder.displayName || folder.name}
                    subtitle={folder.dropboxPath}
                  />
                ))}
              </div>
            )}

            <div style={{ marginTop: 14 }}>
              <FormError message={error} />
            </div>

            <DialogActions
              onCancel={() => setTab('details')}
              secondaryLabel="Back"
              onConfirm={submit}
              confirmLabel="Save changes"
              busy={loading}
            />
          </div>
        )}
      </div>
    </Modal>
  );
};
