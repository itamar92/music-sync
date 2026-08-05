import { Collection, Playlist, Track } from '../types';

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
   * Duration reporting writes to a track row, and the share tier is read-only:
   * the public endpoint that accepts durations is public-playlist-only and there
   * is no share equivalent. A shared-only track keeps showing the duration the
   * studio knows about.
   */
  async reportTrackDuration(): Promise<void> {
    // Intentionally empty — see above.
  }
}

export const shareDataService = new ShareDataService();
