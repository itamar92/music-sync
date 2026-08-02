import React from 'react';
import { Icon } from './icons';
import { describeFileUpdated, isRecentlyUpdated } from '../../utils/trackFreshness';

/**
 * When the Dropbox file behind a track last changed: a lit green LED while that
 * was recent, plus an ⓘ carrying the exact date.
 *
 * Shown to listeners as well as to the owner. The date is the point — a listener
 * wants to know whether they're hearing the latest mix — and gating the ⓘ to the
 * studio meant a track outside the freshness window showed nothing at all on the
 * public site.
 *
 * Renders nothing when there is no timestamp to report, so rows that predate the
 * feature and hand-picked files no sync has covered look unremarkable rather
 * than looking stale.
 */

interface FreshnessMarkProps {
  track: { dropboxModified?: string | null };
}

export const FreshnessMark: React.FC<FreshnessMarkProps> = ({ track }) => {
  const updated = describeFileUpdated(track);
  if (!updated) return null;

  const fresh = isRecentlyUpdated(track);

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
      <Icon
        name="info"
        size={13}
        color={fresh ? 'var(--nc-fresh)' : 'var(--nc-dim)'}
        label={updated}
      />
    </span>
  );
};
