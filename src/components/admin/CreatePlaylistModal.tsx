import React, { useState, useEffect } from 'react';
import { adminData } from '../../services/adminData';
import { Modal } from '../Modal';
import { Segmented, PickRow, DialogActions, FormError, ToggleRow } from '../nocturne/Picker';
import { PlaylistRecord, PickerOption } from './types';

interface CreatePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (playlist: PlaylistRecord) => void;
}

const EMPTY = {
  name: '',
  displayName: '',
  description: '',
  coverImageUrl: '',
  collectionId: '',
  isPublic: true,
};

export const CreatePlaylistModal: React.FC<CreatePlaylistModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [collections, setCollections] = useState<PickerOption[]>([]);
  const [folders, setFolders] = useState<PickerOption[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [tab, setTab] = useState<'details' | 'folders'>('details');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    if (!form.name.trim()) {
      setError('Playlist name is required');
      setTab('details');
      return;
    }

    setLoading(true);
    setError('');

    try {
      onSuccess(
        await adminData.createPlaylist({
          name: form.name.trim(),
          displayName: form.displayName.trim(),
          description: form.description.trim(),
          coverImageUrl: form.coverImageUrl.trim(),
          collectionId: form.collectionId || null,
          isPublic: form.isPublic,
          folderIds: selectedFolders,
        })
      );
      close();
    } catch (submitError) {
      console.error('Error creating playlist:', submitError);
      setError('Failed to create playlist. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={close} title="Create playlist" kicker="Studio" width={560}>
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
              <label className="nc-label" htmlFor="cp-name">
                Playlist name
              </label>
              <input
                id="cp-name"
                className="nc-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nightshift — Rough Mixes"
                required
              />
            </div>

            <div className="nc-field">
              <label className="nc-label" htmlFor="cp-display">
                Display name
              </label>
              <input
                id="cp-display"
                className="nc-input"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                placeholder="Optional — defaults to the name above"
              />
            </div>

            <div className="nc-field">
              <label className="nc-label" htmlFor="cp-collection">
                Collection
              </label>
              <select
                id="cp-collection"
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
              <label className="nc-label" htmlFor="cp-description">
                Description
              </label>
              <textarea
                id="cp-description"
                className="nc-textarea"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Who is this for, and what version is it?"
              />
            </div>

            <div className="nc-field">
              <label className="nc-label" htmlFor="cp-cover">
                Cover image URL
              </label>
              <input
                id="cp-cover"
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
            <DialogActions
              onCancel={close}
              onConfirm={() => setTab('folders')}
              confirmLabel="Next: pick folders"
            />
          </div>
        ) : (
          <div>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--nc-mut)' }}>
              Tracks come from the Dropbox folders you attach here.
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
              confirmLabel="Create playlist"
              busy={loading}
            />
          </div>
        )}
      </div>
    </Modal>
  );
};
