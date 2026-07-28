import React from 'react';

/**
 * The three dancing bars that replace a track's number while it plays.
 * Rendered at the same box size as the number so rows never reflow on play.
 */
export const EqBars: React.FC<{ height?: number; opacity?: number }> = ({
  height = 14,
  opacity = 1,
}) => (
  <span
    aria-hidden="true"
    style={{
      position: 'absolute',
      display: 'flex',
      alignItems: 'flex-end',
      gap: 2,
      height,
      opacity,
      transition: 'opacity 0.15s ease',
    }}
  >
    {[
      ['var(--nc-cy)', '60%', '0s'],
      ['var(--nc-tl)', '100%', '0.15s'],
      ['#6f63b4', '45%', '0.3s'],
    ].map(([color, h, delay]) => (
      <span
        key={delay}
        style={{
          width: 2,
          height: h,
          background: color,
          animation: `ms-eq 1.1s ease-in-out ${delay} infinite`,
        }}
      />
    ))}
  </span>
);

/**
 * The two-bar output meter in the transport's right cluster. It reads as
 * "signal present" rather than a real level — there is no analyser node on the
 * stream, and adding one would force the audio through a same-origin proxy.
 */
export const LevelMeter: React.FC<{ active: boolean }> = ({ active }) => (
  <div
    aria-hidden="true"
    style={{
      display: 'flex',
      alignItems: 'flex-end',
      gap: 3,
      height: 20,
      opacity: active ? 1 : 0.22,
      transition: 'opacity 0.2s ease',
    }}
  >
    {['0.55s', '0.7s'].map((duration, i) => (
      <span
        key={duration}
        style={{
          width: 3,
          height: '100%',
          background: 'linear-gradient(to top, var(--nc-cy), var(--nc-pu))',
          borderRadius: 1,
          transformOrigin: 'bottom',
          animation: active
            ? `ms-meter ${duration} ease-in-out ${i * 0.1}s infinite alternate`
            : 'none',
          transform: active ? undefined : 'scaleY(0.25)',
        }}
      />
    ))}
  </div>
);
