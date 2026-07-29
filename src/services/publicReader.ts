import { Track } from '../types';
import { publicDataService } from './publicDataService';
import { shareDataService } from './shareDataService';

/**
 * Which backend reads playback data: the public catalogue, or a share link.
 *
 * The track list hook and the audio engine sit above both — the same components
 * render the public site and a shared collection — so instead of threading a
 * token through them, they ask here. A share is active only while the
 * `/share/:token` view is mounted, so the public site is unaffected.
 */
export interface PublicReader {
  getPlaylistTracks(playlistId: string): Promise<Track[]>;
  getTrackStreamUrl(filePath: string): Promise<string>;
  prefetchStreamUrls(filePaths: string[]): Promise<void>;
  reportTrackDuration(trackId: string, durationSeconds: number): Promise<void>;
}

export const publicReader = (): PublicReader =>
  shareDataService.isActive() ? shareDataService : publicDataService;
