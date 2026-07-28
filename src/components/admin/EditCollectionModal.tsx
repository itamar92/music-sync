import React, { useState, useEffect } from 'react';
import { adminData } from '../../services/adminData';
import { Modal } from '../Modal';
import { Segmented, PickRow, DialogActions, FormError } from '../nocturne/Picker';
import { CollectionRecord, PickerOption } from './types';

interface EditCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (collection: CollectionRecord) => void;
  collection: CollectionRecord | null;
}

export const EditCollectionModal: React.FC<EditCollectionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  collection,
}) => {
  const [form, setForm] = useState({ displayName: '', description: '', coverImageUrl: '' });
  const [selected, setSelected] = useState<string[]>([]);
  const [available, setAvailable] = useState<PickerOption[]>([]);
  const [tab, setTab] = useState<'details' | 'content'>('details');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!collection) return;
    setForm({
      displayName: collection.displayName || collection.name || '',
      description: collection.description || '',
      coverImageUrl: collection.coverImageUrl || '',
    });
    setSelected(collection.playlistIds || []);
  }, [collection]);

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
    setError('');
    setTab('details');
    onClose();
  };

  const submit = async () => {
    if (!collection) {
      setError('No collection selected');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const updated = await adminData.updateCollection(collection.id, {
        displayName: form.displayName.trim() || collection.name,
        description: form.description.trim(),
        coverImageUrl: form.coverImageUrl.trim(),
        playlistIds: selected,
      });
      onSuccess({ ...collection, ...updated });
      close();
    } catch (submitError) {
      console.error('Error updating collection:', submitError);
      setError('Failed to update collection. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!collection) return null;

  return (
    <Modal isOpen={isOpen} onClose={close} title="Edit collection" kicker="Studio" width={560}>
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
              <label className="nc-label" htmlFor="ec-display">
                Display name
              </label>
              <input
                id="ec-display"
                className="nc-input"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              />
            </div>

            <div className="nc-field">
              <label className="nc-label" htmlFor="ec-description">
                Description
              </label>
              <textarea
                id="ec-description"
                className="nc-textarea"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="nc-field">
              <label className="nc-label" htmlFor="ec-cover">
                Cover image URL
              </label>
              <input
                id="ec-cover"
                className="nc-input"
                type="url"
                value={form.coverImageUrl}
                onChange={(e) => setForm({ ...form, coverImageUrl: e.target.value })}
                placeholder="https://…"
              />
            </div>

            <FormError message={error} />
            <DialogActions onCancel={close} onConfirm={submit} confirmLabel="Save changes" busy={loading} />
          </div>
        ) : (
          <div>
            {available.length === 0 ? (
              <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--nc-mut)' }}>
                No playlists available yet.
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
              confirmLabel="Save changes"
              busy={loading}
            />
          </div>
        )}
      </div>
    </Modal>
  );
};
