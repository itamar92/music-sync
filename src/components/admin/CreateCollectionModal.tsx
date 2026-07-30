import React, { useState, useEffect } from 'react';
import { adminData } from '../../services/adminData';
import { Modal } from '../Modal';
import { Segmented, PickRow, DialogActions, FormError, ToggleRow } from '../nocturne/Picker';
import { CollectionRecord, PickerOption } from './types';

interface CreateCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (collection: CollectionRecord) => void;
}

const EMPTY = { name: '', displayName: '', description: '', coverImageUrl: '', isPublic: true };

export const CreateCollectionModal: React.FC<CreateCollectionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [form, setForm] = useState(EMPTY);
  const [selected, setSelected] = useState<string[]>([]);
  const [available, setAvailable] = useState<PickerOption[]>([]);
  const [tab, setTab] = useState<'details' | 'content'>('details');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    (async () => {
      try {
        const rows = await adminData.listPlaylists();
        if (!cancelled) setAvailable(rows as PickerOption[]);
      } catch (loadError) {
        console.error('Error loading available playlists:', loadError);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const close = () => {
    setForm(EMPTY);
    setSelected([]);
    setTab('details');
    setError('');
    onClose();
  };

  const submit = async () => {
    if (!form.name.trim()) {
      setError('Collection name is required');
      setTab('details');
      return;
    }

    setLoading(true);
    setError('');

    try {
      onSuccess(
        await adminData.createCollection({
          name: form.name.trim(),
          displayName: form.displayName.trim(),
          description: form.description.trim(),
          coverImageUrl: form.coverImageUrl.trim(),
          isPublic: form.isPublic,
          playlistIds: selected,
        })
      );
      close();
    } catch (submitError) {
      console.error('Error creating collection:', submitError);
      setError('Failed to create collection. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={close} title="Create collection" kicker="Studio" width={560}>
      <Segmented<'details' | 'content'>
        label="Collection sections"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'details', label: 'Details' },
          { value: 'content', label: `Playlists (${selected.length})` },
        ]}
      />

      <div style={{ marginTop: 18 }}>
        {tab === 'details' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="nc-field">
              <label className="nc-label" htmlFor="cc-name">
                Collection name
              </label>
              <input
                id="cc-name"
                className="nc-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Client Mixdowns"
                required
              />
            </div>

            <div className="nc-field">
              <label className="nc-label" htmlFor="cc-display">
                Display name
              </label>
              <input
                id="cc-display"
                className="nc-input"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                placeholder="Optional — defaults to the name above"
              />
            </div>

            <div className="nc-field">
              <label className="nc-label" htmlFor="cc-description">
                Description
              </label>
              <textarea
                id="cc-description"
                className="nc-textarea"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What lives in this collection?"
              />
            </div>

            <div className="nc-field">
              <label className="nc-label" htmlFor="cc-cover">
                Cover image URL
              </label>
              <input
                id="cc-cover"
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
              hint="Private collections and their playlists are only reachable through share links."
            />

            <FormError message={error} />

            <DialogActions
              onCancel={close}
              onConfirm={() => setTab('content')}
              confirmLabel="Next: pick playlists"
            />
          </div>
        ) : (
          <div>
            {available.length === 0 ? (
              <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--nc-mut)' }}>
                No playlists yet. Sync a Dropbox folder first — you can always add them later.
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
                {available.map((playlist) => (
                  <PickRow
                    key={playlist.id}
                    selected={selected.includes(playlist.id)}
                    onToggle={() =>
                      setSelected((prev) =>
                        prev.includes(playlist.id)
                          ? prev.filter((id) => id !== playlist.id)
                          : [...prev, playlist.id]
                      )
                    }
                    title={playlist.displayName || playlist.name}
                    subtitle={`${playlist.trackCount || 0} tracks`}
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
              confirmLabel="Create collection"
              busy={loading}
            />
          </div>
        )}
      </div>
    </Modal>
  );
};
