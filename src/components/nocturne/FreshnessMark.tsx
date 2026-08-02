import React from 'react';
import { Icon } from './icons';
import { describeFileUpdated, isRecentlyUpdated } from '../../utils/trackFreshness';

/**
 * "This file changed in Dropbox recently" — a lit green LED, and in the studio
 * an ⓘ carrying the exact date.
 *
 * Deliberately quiet: a dot the eye can skip, never a badge that competes with
 * the track name. Renders nothing at all when there is no timestamp to report,
 * so pre-migration rows and hand-picked files simply look unremarkable rather
 * than looking stale.
 */

interface FreshnessMarkProps {
  track: { dropboxModified?: string | null };
  /** Add the ⓘ affordance, which shows the date even outside the window. */
  withInfo?: boolean;
}

export const FreshnessMark: React.FC<FreshnessMarkProps> = ({ track, withInfo = false }) => {
  const updated = describeFileUpdated(track);
  if (!updated) return null;

  const fresh = isRecentlyUpdated(track);
  if (!fresh && !withInfo) return null;

  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0 }}
      title={updated}
    >
      {fresh && (
        <span
          className="nc-dot nc-dot-fresh"
          style={{ width: 6, height: 6 }}
          role="img"
          aria-label={`Recently updated. ${updated}`}
        />
      )}
      {withInfo && <Icon name="info" size={13} color="var(--nc-dim)" label={updated} />}
    </span>
  );
};
