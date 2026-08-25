import { Track } from '../types';
import { adminApi } from './adminApiService';

/**
 * Playback reads for the studio, through the authenticated admin API.
 *
 * The studio can't use `publicDataService` for this. The public stream endpoints
 * only serve tracks that sit on a published playlist inside a published
 * collection — the right rule for the public site, and the wrong one here: an
 * admin has to be able to *listen before publishing*. A freshly synced folder is
 * unpublished by definition, so every play button in the studio answered
 * `404 Track not available` and played silence.
 *
 * A mirror of `shareDataService` — same caching behaviour, same return shapes —
 * scoped to an authenticated admin session instead of a share token.
 *
 * Container mode only: Firebase mode resolves stream URLs through Dropbox in the
 * browser and never reaches here.
 */

const STREAM_URL_TTL_MS = 3 * 60 * 60 * 1000;

class StudioDataService {
  private active = false;

  /** Entering the studio. Playback resolves through the admin API until we leave. */
  activate(): void {
    this.active = true;
  }

  /** Leaving the studio (or signing out); later reads must not keep using it. */
  deactivate(): void {
    this.active = false;
    this.streamUrlCache.clear();
  }

  /** True while the studio is open — what picks studio over public reads. */
  isActive(): boolean {
    return this.active;
  }

  // --- tracks -----------------------------------------------------------------

  /**
   * Excluded tracks are dropped so this matches the public reader's contract:
   * the studio's own lists come from `adminData`, which keeps them and marks
   * them, and the player should never queue one it wasn't handed deliberately.
   */
  async getPlaylistTracks(playlistId: string): Promise<Track[]> {
    const tracks = await adminApi.listPlaylistTracks(playlistId);
    return tracks.filter((track) => !track.isExcluded);
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

    const { streamUrl } = await adminApi.getStreamUrl(filePath, fresh);
    this.setCachedStreamUrl(filePath, streamUrl);
    return streamUrl;
  }

  /** Warm the next few tracks so a skip starts immediately. Fire-and-forget. */
  async prefetchStreamUrls(filePaths: string[]): Promise<void> {
    const missing = filePaths.filter((p) => p && !this.getCachedStreamUrl(p));
    if (missing.length === 0) return;

    try {
      const { urls } = await adminApi.getStreamUrls(missing.slice(0, 25));
      for (const [path, url] of Object.entries(urls || {})) {
        if (url) this.setCachedStreamUrl(path, url);
      }
    } catch (error) {
      console.warn('Studio stream URL prefetch failed (non-fatal):', error);
    }
  }

  /**
   * Record a duration the player just measured.
   *
   * The public endpoint for this is published-playlists-only, so without an
   * admin path an unpublished playlist could never learn its durations — the
   * studio would keep showing 0:00 for tracks it had just played. Writes go
   * through the ordinary track patch; the player only reports when the duration
   * is still unknown, so this never overwrites a good value.
   */
  async reportTrackDuration(trackId: string, durationSeconds: number): Promise<void> {
    try {
      await adminApi.updateTrack(trackId, { durationSeconds: Math.round(durationSeconds) });
    } catch (error) {
      console.warn('Studio duration report failed (non-fatal):', error);
    }
  }
}

export const studioDataService = new StudioDataService();
