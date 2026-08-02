/**
 * How fresh is the Dropbox file behind a track?
 *
 * The studio and the public players both surface this, so the window and the
 * predicate live here rather than in either view — otherwise the two would
 * drift and "recently updated" would mean two different things.
 *
 * The indicator is self-clearing: a track is "recently updated" only while its
 * Dropbox timestamp is inside the window, with no acknowledge step. The
 * comparison is Dropbox's clock against the browser's, which at a seven-day
 * window makes a few minutes of skew irrelevant.
 */

/** Days a track counts as recently updated after Dropbox last modified it. */
export const RECENTLY_UPDATED_DAYS = 7;

const WINDOW_MS = RECENTLY_UPDATED_DAYS * 24 * 60 * 60 * 1000;

interface HasFreshness {
  dropboxModified?: string | null;
}

/** Parsed timestamp, or null when absent or unparseable. */
const modifiedAt = (track: HasFreshness): Date | null => {
  if (!track.dropboxModified) return null;
  const date = new Date(track.dropboxModified);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** True while the file's last Dropbox change is inside the window. */
export const isRecentlyUpdated = (track: HasFreshness): boolean => {
  const date = modifiedAt(track);
  if (!date) return false;
  return Date.now() - date.getTime() <= WINDOW_MS;
};

/**
 * "File updated: 2 August 2026, 14:30" in the viewer's locale, or null when
 * there's nothing to report. Callers use it verbatim as a tooltip.
 */
export const describeFileUpdated = (track: HasFreshness): string | null => {
  const date = modifiedAt(track);
  if (!date) return null;
  return `File updated: ${date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })}`;
};
