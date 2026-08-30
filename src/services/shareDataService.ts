import { Collection, Playlist, PlaylistSyncResult, Track } from '../types';

/**
 * Reads one shared collection through /api/public/share/:token.
 *
 * A mirror of `publicDataService` — same caching behaviour, same return shapes —
 * scoped to a single collection instead of the published catalogue. The token
 * comes from the URL and is held here so the audio player and the track hooks
 * can resolve stream URLs without every component threading it through.
 *
 * Container mode only: Firebase mode has no share endpoints.
 */

export interface ShareBundle {
  collection: Collection;
  playlists: Playlist[];
}

/** A token that resolved to nothing — revoked, mistyped, or never existed. */
export class ShareUnavailableError extends Error {
  constructor() {
    super('This link is no longer available');
    this.name = 'ShareUnavailableError';
  }
}

const STREAM_URL_TTL_MS = 3 * 60 * 60 * 1000;

/**
 * The `error` a failed response carries, falling back to `fallback`.
 *
 * Never throws: this runs on the failure path, where a body that isn't JSON
 * must not turn a useful error into an unrelated parse error.
 */
const serverMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const body = await response.json();
    return typeof body?.error === 'string' && body.error ? body.error : fallback;
  } catch {
    return fallback;
  }
};

class ShareDataService {
  private baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

  private token: string | null = null;

  /** Point the service at a token. Switching tokens drops the previous caches. */
  activate(token: string): void {
    if (this.token === token) return;
    this.token = token;
    this.bundle = null;
    this.tracksByPlaylist.clear();
    this.streamUrlCache.clear();
  }

  /** Leaving the share view; later reads must not silently reuse the token. */
  deactivate(): void {
    this.token = null;
    this.bundle = null;
    this.tracksByPlaylist.clear();
    this.streamUrlCache.clear();
  }

  /** True while a share is being browsed — what picks share over public reads. */
  isActive(): boolean {
    return this.token !== null;
  }

  private get root(): string {
    if (!this.token) throw new ShareUnavailableError();
    return `${this.baseUrl}/public/share/${encodeURIComponent(this.token)}`;
  }

  // --- collection + playlists -------------------------------------------------

  private bundle: ShareBundle | null = null;

  /**
   * The collection and its playlists in one request.
   *
   * A 404 here is the whole answer for the view: unknown and revoked tokens are
   * indistinguishable by design, so both surface as "no longer available".
   */
  async getShare(): Promise<ShareBundle> {
    if (this.bundle) return this.bundle;

    const response = await fetch(this.root);
    if (response.status === 404) throw new ShareUnavailableError();
    if (!response.ok) throw new Error('Failed to load shared collection');

    const data = (await response.json()) as ShareBundle;
    this.bundle = data;
    return data;
  }

  // --- tracks -----------------------------------------------------------------

  private tracksByPlaylist = new Map<string, Track[]>();

  async getPlaylistTracks(playlistId: string): Promise<Track[]> {
    const cached = this.tracksByPlaylist.get(playlistId);
    if (cached) return cached;

    const response = await fetch(`${this.root}/playlists/${playlistId}/tracks`);
    if (response.status === 404) throw new ShareUnavailableError();
    if (!response.ok) throw new Error('Failed to fetch tracks');

    const tracks = (await response.json()) as Track[];
    this.tracksByPlaylist.set(playlistId, tracks);
    return tracks;
  }

  /**
   * Ask the backend to re-pull this playlist's Dropbox folders.
   *
   * Drops the cached track list first, so the reload that follows can't be
   * answered out of a cache that predates the sync. The backend applies its own
   * per-folder cooldown, so pressing this repeatedly is cheap rather than
   * abusive.
   */
  async syncPlaylist(playlistId: string): Promise<PlaylistSyncResult> {
    const response = await fetch(`${this.root}/playlists/${playlistId}/sync`, {
      method: 'POST',
    });
    if (response.status === 404) throw new ShareUnavailableError();
    // The backend sends a sentence meant for the listener when Dropbox is
    // unreachable; showing "Failed to sync playlist" over the top of it would
    // throw away the only part that says what to do about it.
    if (!response.ok) throw new Error(await serverMessage(response, 'Failed to sync playlist'));

    this.tracksByPlaylist.delete(playlistId);
    return response.json();
  }

  /**
   * Save a new running order for everyone holding the link.
   *
   * The cached list is rewritten to match rather than dropped: the caller has
   * already moved the row on screen, so re-fetching would only risk the list
   * flickering back to the old order and then forward again.
   */
  async setTrackOrder(playlistId: string, tracks: Track[]): Promise<void> {
    const response = await fetch(`${this.root}/playlists/${playlistId}/track-order`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackIds: tracks.map((track) => track.id) }),
    });
    if (response.status === 404) throw new ShareUnavailableError();
    if (!response.ok) throw new Error('Failed to save track order');

    this.tracksByPlaylist.set(playlistId, tracks);
  }

  // --- stream URLs ------------------------------------------------------------

  // Dropbox temporary links last ~4h and the backend caches them; this keeps the
  // resolved URL for a shorter window so a repeat play skips the round-trip.
  private streamUrlCache = new Map<string, { url: string; expiresAt: number }>();

  private getCachedStreamUrl(filePath: string): string | null {
    const hit = this.streamUrlCache.get(filePath);
    if (hit && hit.expiresAt > Date.now()) return hit.url;
    this.streamUrlCache.delete(filePath);
    return null;
  }

  private setCachedStreamUrl(filePath: string, url: string): void {
    this.streamUrlCache.set(filePath, { url, expiresAt: Date.now() + STREAM_URL_TTL_MS });
  }

  async getTrackStreamUrl(filePath: string, fresh = false): Promise<string> {
    if (!fresh) {
      const cached = this.getCachedStreamUrl(filePath);
      if (cached) return cached;
    } else {
      // The cached link is dead — drop it before fetching its replacement.
      this.streamUrlCache.delete(filePath);
    }

    const response = await fetch(`${this.root}/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath, ...(fresh ? { fresh: true } : {}) }),
    });
    if (!response.ok) throw new Error('Failed to get stream URL');

    const data = await response.json();
    this.setCachedStreamUrl(filePath, data.streamUrl);
    return data.streamUrl;
  }

  /** Warm the next few tracks so a skip starts immediately. Fire-and-forget. */
  async prefetchStreamUrls(filePaths: string[]): Promise<void> {
    const missing = filePaths.filter((p) => p && !this.getCachedStreamUrl(p));
    if (missing.length === 0) return;

    try {
      const response = await fetch(`${this.root}/streams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePaths: missing.slice(0, 25) }),
      });
      if (!response.ok) return;

      const data = await response.json();
      for (const [path, url] of Object.entries<string | null>(data.urls || {})) {
        if (url) this.setCachedStreamUrl(path, url);
      }
    } catch (error) {
      console.warn('Share stream URL prefetch failed (non-fatal):', error);
    }
  }

  /**
   * Deliberately a no-op.
   *
   * The share tier writes sync and track order, but not this: the public
   * endpoint that accepts durations is public-playlist-only and there is no
   * share equivalent. A shared-only track keeps showing the duration the studio
   * knows about — which, since the duration sweep now measures tracks
   * server-side, is usually the right one anyway.
   */
  async reportTrackDuration(): Promise<void> {
    // Intentionally empty — see above.
  }
}

export const shareDataService = new ShareDataService();
