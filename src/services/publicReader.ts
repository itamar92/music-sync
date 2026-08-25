import { Track } from '../types';
import { publicDataService } from './publicDataService';
import { shareDataService } from './shareDataService';
import { studioDataService } from './studioDataService';

/**
 * Which backend reads playback data: the public catalogue, a share link, or the
 * studio.
 *
 * The track list hook and the audio engine sit above all three — the same
 * components render the public site, a shared collection and the studio's
 * preview — so instead of threading a token or a session through them, they ask
 * here. Each alternative reader is active only while its own view is mounted, so
 * the public site is unaffected by either.
 *
 * The studio needs its own reader because the public endpoints serve published
 * playlists only, and the studio exists to work on playlists before they are
 * published. See `studioDataService`.
 */
export interface PublicReader {
  getPlaylistTracks(playlistId: string): Promise<Track[]>;
  /** `fresh` skips every cache tier — used to recover from a dead cached link. */
  getTrackStreamUrl(filePath: string, fresh?: boolean): Promise<string>;
  prefetchStreamUrls(filePaths: string[]): Promise<void>;
  reportTrackDuration(trackId: string, durationSeconds: number): Promise<void>;
}

export const publicReader = (): PublicReader => {
  if (shareDataService.isActive()) return shareDataService;
  if (studioDataService.isActive()) return studioDataService;
  return publicDataService;
};
