import React from 'react';

/**
 * The MusicSync mark: a row of bars sweeping cyan → violet, each animating on
 * its own delay so the whole thing breathes. Two sizes — a compact one for the
 * header, and a display one with the "im" counterform sitting inside it.
 */

/** Bar colours across the spectrum, paired with their resting height. */
const COMPACT_BARS: Array<[color: string, height: string]> = [
  ['#16e0e0', '34%'],
  ['#1ad2dd', '56%'],
  ['#22b8d6', '80%'],
  ['#1f6fc4', '100%'],
  ['#2b46a5', '74%'],
  ['#3a2585', '52%'],
  ['#3d0d60', '30%'],
];

const DISPLAY_BARS: Array<[color: string, height: string]> = [
  ['#16e0e0', '22%'],
  ['#18dade', '38%'],
  ['#1ccfdb', '30%'],
  ['#22b8d6', '62%'],
  ['#2497c9', '80%'],
  ['#2280c4', '52%'],
  ['#1f6fc4', '88%'],
  ['#1c58b4', '100%'],
  ['#2f2a90', '70%'],
  ['#3d0d60', '44%'],
];

interface WaveMarkProps {
  height?: number;
  barWidth?: number;
  gap?: number;
  className?: string;
}

/** The header lockup mark — small, seven bars, no wordform. */
export const WaveMark: React.FC<WaveMarkProps> = ({
  height = 24,
  barWidth = 2,
  gap = 2,
  className,
}) => (
  <div
    className={className}
    aria-hidden="true"
    style={{ display: 'flex', alignItems: 'center', gap, height }}
  >
    {COMPACT_BARS.map(([color, h], i) => (
      <span
        key={color}
        style={{
          width: barWidth,
          height: h,
          borderRadius: barWidth / 2,
          background: color,
          transformOrigin: 'center',
          animation: `ms-bar 1.6s ease-in-out ${i * 0.1}s infinite`,
        }}
      />
    ))}
  </div>
);

interface DisplayMarkProps {
  /** Overall mark width; the bars and wordform scale from it. */
  width: number;
  height: number;
  /** Backdrop colour the "im" glows against, so it stays legible on any ground. */
  glowGround?: string;
}

/**
 * The hero mark — ten bars with "im" laid over the middle of them. The
 * wordform carries a tight text-shadow in the page's own ground colour so it
 * punches a hole through the bars rather than colliding with them.
 */
export const DisplayMark: React.FC<DisplayMarkProps> = ({
  width,
  height,
  glowGround = 'rgba(16,18,32,0.9)',
}) => {
  const barWidth = Math.round(width / 30);
  const gap = Math.round(width / 31);
  const fontSize = Math.round(height * 0.6);

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'relative',
        width,
        height,
        filter:
          'drop-shadow(0 0 22px rgba(34,184,214,0.35)) drop-shadow(0 0 60px rgba(61,13,96,0.45))',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', gap }}>
        {DISPLAY_BARS.map(([color, h], i) => (
          <span
            key={color}
            style={{
              width: barWidth,
              height: h,
              borderRadius: barWidth / 2,
              background: color,
              transformOrigin: 'center',
              animation: `ms-bar 2.4s ease-in-out ${i * 0.12}s infinite`,
            }}
          />
        ))}
      </div>
      <span
        style={{
          position: 'absolute',
          left: width * 0.218,
          top: '50%',
          transform: 'translateY(-46%)',
          fontSize,
          fontWeight: 500,
          letterSpacing: '-0.04em',
          lineHeight: 1,
          color: 'var(--nc-pale)',
          textShadow: `0 0 26px ${glowGround}, 0 0 8px ${glowGround}`,
        }}
      >
        im
      </span>
    </div>
  );
};

/**
 * The four-bar glyph that stands in for a collection's artwork — a miniature
 * of the mark, sitting in a navy well.
 */
export const CollectionGlyph: React.FC<{ size: number }> = ({ size }) => (
  <div
    aria-hidden="true"
    style={{
      position: 'relative',
      width: size,
      height: size,
      borderRadius: size * 0.2,
      flexShrink: 0,
      background: 'linear-gradient(150deg, var(--nc-nv), #0d1020)',
      border: '1px solid var(--nc-line)',
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: 2,
      paddingBottom: size * 0.26,
    }}
  >
    {[
      ['var(--nc-tl)', 0.24, 0.85],
      ['var(--nc-cy)', 0.41, 0.9],
      ['var(--nc-bl)', 0.18, 0.9],
      ['#6f63b4', 0.32, 0.9],
    ].map(([color, ratio, opacity], i) => (
      <span
        key={i}
        style={{
          width: 2,
          height: size * (ratio as number),
          borderRadius: 1,
          background: color as string,
          opacity: opacity as number,
        }}
      />
    ))}
  </div>
);
