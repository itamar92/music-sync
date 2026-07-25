import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Music, LogOut, FolderSync, Trash2, Eye, EyeOff, RefreshCw,
  ChevronRight, ArrowLeft, Plus, Home,
} from 'lucide-react';
import { adminApi, DropboxFolderEntry } from '../services/adminApiService';
import { Collection, Playlist } from '../types';
import { LoadingSpinner } from '../components/LoadingSpinner';

/**
 * Admin dashboard for container mode (VITE_DATA_MODE=server).
 * Talks exclusively to the Express backend (/api/admin/*) with JWT auth —
 * no Firebase. The legacy Firebase dashboard remains at AdminDashboard.tsx.
 */
export const ServerAdminDashboard: React.FC = () => {
  const [loggedIn, setLoggedIn] = useState(adminApi.isLoggedIn());
  return loggedIn
    ? <Dashboard onLogout={() => { adminApi.logout(); setLoggedIn(false); }} />
    : <LoginScreen onSuccess={() => setLoggedIn(true)} />;
};

const LoginScreen: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminApi.login(email, password);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-blue-900 to-black flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-black/60 border border-blue-500/20 rounded-xl p-8 w-full max-w-sm space-y-4">
        <div className="flex items-center space-x-3 mb-2">
          <Music className="w-8 h-8 text-blue-400" />
          <h1 className="text-xl font-bold text-white">Admin Login</h1>
        </div>
        <input
          type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="Email" required autoFocus
          className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 border border-gray-700 focus:border-blue-500 outline-none"
        />
        <input
          type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Password" required
          className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 border border-gray-700 focus:border-blue-500 outline-none"
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          type="submit" disabled={busy}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg py-2 font-medium transition-colors"
        >
          {busy ? 'Signing in…' : 'Sign In'}
        </button>
        <button
          type="button" onClick={() => navigate('/')}
          className="w-full text-gray-400 hover:text-white text-sm transition-colors"
        >
          ← Back to site
        </button>
      </form>
    </div>
  );
};

const Dashboard: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const navigate = useNavigate();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  const reload = useCallback(async () => {
    setError(null);
    try {
      const [cols, pls] = await Promise.all([
        adminApi.listCollections(),
        adminApi.listPlaylists(),
      ]);
      setCollections(cols);
      setPlaylists(pls);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load data';
      setError(message);
      if (message.includes('log in')) onLogout();
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  useEffect(() => { reload(); }, [reload]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-blue-900 to-black flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-blue-900 to-black text-white">
      <header className="bg-black/50 backdrop-blur-sm border-b border-blue-500/20 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Music className="w-7 h-7 text-blue-400" />
            <span className="text-lg font-medium">MusicSync Admin</span>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={() => navigate('/')} title="View site"
              className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm transition-colors">
              <Home className="w-4 h-4" /><span className="hidden sm:inline">Site</span>
            </button>
            <button onClick={reload} title="Refresh"
              className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={onLogout}
              className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm transition-colors">
              <LogOut className="w-4 h-4" /><span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-8 space-y-8">
        {notice && (
          <div className="bg-green-600/20 border border-green-500/40 text-green-300 rounded-lg px-4 py-2">{notice}</div>
        )}
        {error && (
          <div className="bg-red-600/20 border border-red-500/40 text-red-300 rounded-lg px-4 py-2">{error}</div>
        )}

        <CollectionsPanel collections={collections} onChanged={reload} onError={setError} onNotice={flash} />
        <PlaylistsPanel playlists={playlists} collections={collections} onChanged={reload} onError={setError} onNotice={flash} />
        <SyncPanel collections={collections} onChanged={reload} onError={setError} onNotice={flash} />
      </main>
    </div>
  );
};

interface PanelProps {
  onChanged: () => void;
  onError: (msg: string) => void;
  onNotice: (msg: string) => void;
}

const panelClass = 'bg-black/40 border border-blue-500/20 rounded-xl p-6';
const inputClass = 'bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:border-blue-500 outline-none';

const CollectionsPanel: React.FC<PanelProps & { collections: Collection[] }> = ({
  collections, onChanged, onError, onNotice,
}) => {
  const [newName, setNewName] = useState('');

  const act = async (fn: () => Promise<unknown>, done: string) => {
    try { await fn(); onNotice(done); onChanged(); } catch (err) {
      onError(err instanceof Error ? err.message : 'Operation failed');
    }
  };

  return (
    <section className={panelClass}>
      <h2 className="text-xl font-bold mb-4">Collections</h2>
      <form
        className="flex space-x-2 mb-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newName.trim()) return;
          act(() => adminApi.createCollection({ name: newName.trim() }), 'Collection created');
          setNewName('');
        }}
      >
        <input value={newName} onChange={(e) => setNewName(e.target.value)}
          placeholder="New collection name" className={`flex-1 ${inputClass}`} />
        <button type="submit" className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg flex items-center space-x-1">
          <Plus className="w-4 h-4" /><span>Add</span>
        </button>
      </form>

      <div className="space-y-2">
        {collections.length === 0 && <p className="text-gray-400">No collections yet.</p>}
        {collections.map((col) => (
          <div key={col.id} className="flex items-center justify-between bg-gray-800/50 rounded-lg px-4 py-3">
            <div>
              <p className="font-medium">{col.displayName || col.name}</p>
              <p className="text-xs text-gray-400">{col.isPublic ? 'Public' : 'Hidden'}</p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                title={col.isPublic ? 'Hide from public site' : 'Publish'}
                onClick={() => act(
                  () => adminApi.updateCollection(col.id, { isPublic: !col.isPublic }),
                  col.isPublic ? 'Collection hidden' : 'Collection published')}
                className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600"
              >
                {col.isPublic ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
              <button
                title="Rename"
                onClick={() => {
                  const name = prompt('Display name', col.displayName || col.name);
                  if (name) act(() => adminApi.updateCollection(col.id, { displayName: name }), 'Collection renamed');
                }}
                className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm"
              >
                Rename
              </button>
              <button
                title="Delete"
                onClick={() => {
                  if (confirm(`Delete collection "${col.displayName || col.name}"? Playlists inside it are kept but unassigned.`)) {
                    act(() => adminApi.deleteCollection(col.id), 'Collection deleted');
                  }
                }}
                className="p-2 rounded-lg bg-red-600/70 hover:bg-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

const PlaylistsPanel: React.FC<PanelProps & { playlists: Playlist[]; collections: Collection[] }> = ({
  playlists, collections, onChanged, onError, onNotice,
}) => {
  const act = async (fn: () => Promise<unknown>, done: string) => {
    try { await fn(); onNotice(done); onChanged(); } catch (err) {
      onError(err instanceof Error ? err.message : 'Operation failed');
    }
  };

  return (
    <section className={panelClass}>
      <h2 className="text-xl font-bold mb-4">Playlists</h2>
      <div className="space-y-2">
        {playlists.length === 0 && (
          <p className="text-gray-400">No playlists yet — sync a Dropbox folder below.</p>
        )}
        {playlists.map((pl) => (
          <div key={pl.id} className="flex flex-wrap items-center justify-between gap-2 bg-gray-800/50 rounded-lg px-4 py-3">
            <div className="min-w-0">
              <p className="font-medium truncate">{pl.displayName || pl.name}</p>
              <p className="text-xs text-gray-400 truncate">
                {pl.totalTracks} tracks · {pl.folderPath || 'custom'} · {pl.isPublic ? 'Public' : 'Hidden'}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <select
                value={pl.collectionId || ''}
                onChange={(e) => act(
                  () => adminApi.updatePlaylist(pl.id, { collectionId: e.target.value || undefined }),
                  'Playlist moved')}
                className={`${inputClass} text-sm`}
              >
                <option value="">No collection</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>{c.displayName || c.name}</option>
                ))}
              </select>
              <button
                title={pl.isPublic ? 'Hide from public site' : 'Publish'}
                onClick={() => act(
                  () => adminApi.updatePlaylist(pl.id, { isPublic: !pl.isPublic }),
                  pl.isPublic ? 'Playlist hidden' : 'Playlist published')}
                className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600"
              >
                {pl.isPublic ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
              <button
                title="Rename"
                onClick={() => {
                  const name = prompt('Display name', pl.displayName || pl.name);
                  if (name) act(() => adminApi.updatePlaylist(pl.id, { displayName: name }), 'Playlist renamed');
                }}
                className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm"
              >
                Rename
              </button>
              <button
                title="Delete playlist (Dropbox files are untouched)"
                onClick={() => {
                  if (confirm(`Delete playlist "${pl.displayName || pl.name}"? Files in Dropbox are not affected.`)) {
                    act(() => adminApi.deletePlaylist(pl.id), 'Playlist deleted');
                  }
                }}
                className="p-2 rounded-lg bg-red-600/70 hover:bg-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

const SyncPanel: React.FC<PanelProps & { collections: Collection[] }> = ({
  collections, onChanged, onError, onNotice,
}) => {
  const [path, setPath] = useState('');
  const [folders, setFolders] = useState<DropboxFolderEntry[]>([]);
  const [browsing, setBrowsing] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [targetCollection, setTargetCollection] = useState('');

  const browse = useCallback(async (nextPath: string) => {
    setBrowsing(true);
    try {
      setFolders(await adminApi.listDropboxFolders(nextPath));
      setPath(nextPath);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to browse Dropbox');
    } finally {
      setBrowsing(false);
    }
  }, [onError]);

  useEffect(() => { browse(''); }, [browse]);

  const sync = async (folderPath: string) => {
    setSyncing(folderPath);
    try {
      const result = await adminApi.syncFolder({
        folderPath,
        collectionId: targetCollection || undefined,
      });
      onNotice(`Synced ${result.trackCount} tracks from ${folderPath}`);
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(null);
    }
  };

  const parentPath = path.split('/').slice(0, -1).join('/');

  return (
    <section className={panelClass}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-xl font-bold flex items-center space-x-2">
          <FolderSync className="w-5 h-5" /><span>Sync Dropbox Folder</span>
        </h2>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-400">Into collection:</span>
          <select value={targetCollection} onChange={(e) => setTargetCollection(e.target.value)}
            className={`${inputClass} text-sm`}>
            <option value="">None</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>{c.displayName || c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center space-x-2 mb-3 text-sm text-gray-300">
        {path && (
          <button onClick={() => browse(parentPath)}
            className="p-1.5 rounded bg-gray-700 hover:bg-gray-600" title="Up one level">
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <span className="font-mono">{path || '/'}</span>
        {browsing && <RefreshCw className="w-4 h-4 animate-spin text-gray-500" />}
      </div>

      <div className="space-y-1">
        {!browsing && folders.length === 0 && (
          <p className="text-gray-400 text-sm">No subfolders here.</p>
        )}
        {folders.map((folder) => (
          <div key={folder.path} className="flex items-center justify-between bg-gray-800/50 rounded-lg px-4 py-2">
            <button onClick={() => browse(folder.path)}
              className="flex items-center space-x-2 text-left hover:text-blue-300 transition-colors min-w-0">
              <ChevronRight className="w-4 h-4 shrink-0" />
              <span className="truncate">{folder.name}</span>
            </button>
            <button
              onClick={() => sync(folder.path)}
              disabled={syncing !== null}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3 py-1.5 rounded-lg text-sm shrink-0"
            >
              {syncing === folder.path ? 'Syncing…' : 'Sync'}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
};
