import React, { useCallback, useEffect, useRef } from 'react';

/**
 * The waveform is the app's signature mark: a bar chart of deterministic
 * "peaks" derived from a track's name, painted in the cyan→violet spectrum up
 * to the playhead and in a flat idle grey after it.
 *
 * Peaks are synthesised rather than decoded. Real peak data would mean pulling
 * every audio file down before it can be drawn — the whole point of this app is
 * that files stay in Dropbox until you press play. A hash of the file name
 * gives a stable shape instead: the same track always draws the same waveform,
 * which is what makes it read as identity rather than decoration.
 */

export type WaveKind = 'transport' | 'hero' | 'row' | 'playlist' | 'cover';

interface WaveformProps {
  /** Any stable string for this track/playlist — the shape is hashed from it. */
  seed: string;
  kind: WaveKind;
  /** 0–1. Bars before this point are painted in the spectrum. */
  progress?: number;
  /** Draws the playhead and brightens the unplayed bars. */
  live?: boolean;
  /** Called with a 0–1 position when the user clicks or drags to scrub. */
  onSeek?: (position: number) => void;
  height: number;
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
}

/** FNV-1a. Cheap, stable, and well spread for short strings. */
const hashSeed = (value: string): number => {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

/**
 * A shaped envelope (loud in the middle, tapering at both ends) roughened by a
 * seeded PRNG, so the result looks like a bounce rather than noise.
 */
const buildPeaks = (seed: number, count: number): number[] => {
  let s = seed >>> 0;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const peaks: number[] = [];
  for (let i = 0; i < count; i++) {
    const x = i / count;
    const envelope =
      0.42 + 0.5 * Math.sin(Math.PI * Math.pow(x, 0.8)) + 0.16 * Math.sin(x * 22 + (seed % 7));
    peaks.push(Math.max(0.07, Math.min(1, envelope * (0.55 + 0.6 * rnd()))));
  }
  return peaks;
};

/** Bar width and gap per context — denser in a row, chunkier in the hero. */
const GEOMETRY: Record<WaveKind, { bar: number; gap: number }> = {
  transport: { bar: 2, gap: 2 },
  hero: { bar: 4, gap: 3 },
  row: { bar: 2, gap: 2 },
  playlist: { bar: 2, gap: 2 },
  cover: { bar: 2, gap: 2 },
};

export const Waveform: React.FC<WaveformProps> = ({
  seed,
  kind,
  progress = 0,
  live = false,
  onSeek,
  height,
  className,
  style,
  ariaLabel,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;

    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(w * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const { bar, gap } = GEOMETRY[kind];
    const step = bar + gap;
    const count = Math.max(8, Math.floor(w / step));
    const peaks = buildPeaks(hashSeed(seed), count);
    const mid = h / 2;

    const played = ctx.createLinearGradient(0, 0, w, 0);
    played.addColorStop(0, '#16e0e0');
    played.addColorStop(0.45, '#22b8d6');
    played.addColorStop(0.75, '#4a54c9');
    played.addColorStop(1, '#7a4fb5');

    // On artwork the idle bars sit on a coloured ground, so they read as a
    // translucent pale rather than the usual grey.
    const idle = kind === 'cover' ? 'rgba(220,231,245,0.30)' : live ? '#343a4f' : '#2a2f42';

    const clamped = Math.max(0, Math.min(1, progress));
    for (let i = 0; i < count; i++) {
      const x = i * step;
      const amp = peaks[i] * (h / 2 - 1);
      ctx.fillStyle = i / count < clamped ? played : idle;
      const y = mid - amp;
      const barHeight = Math.max(2, amp * 2);
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(x, y, bar, barHeight, bar / 2);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, bar, barHeight);
      }
    }

    if (live && clamped > 0) {
      const px = Math.round(clamped * w) + 0.5;
      ctx.fillStyle = 'rgba(22,224,224,0.9)';
      ctx.fillRect(px, 0, 1, h);
      ctx.fillStyle = '#dce7f5';
      ctx.fillRect(px - 1, 0, 2, 5);
    }
  }, [seed, kind, progress, live]);

  useEffect(() => {
    paint();
  }, [paint]);

  // Repaint on any size change, not just window resize — these sit in flex
  // and grid cells that move when a rail collapses or a sheet opens.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', paint);
      return () => window.removeEventListener('resize', paint);
    }
    const observer = new ResizeObserver(() => paint());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [paint]);

  const positionFrom = (clientX: number): number => {
    const canvas = canvasRef.current;
    if (!canvas) return 0;
    const rect = canvas.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!onSeek) return;
    e.preventDefault();
    onSeek(positionFrom(e.clientX));

    // Drag-to-scrub: track the pointer until release, wherever it goes.
    const move = (ev: PointerEvent) => onSeek(positionFrom(ev.clientX));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={onSeek ? handlePointerDown : undefined}
      role={onSeek ? 'slider' : 'img'}
      aria-label={ariaLabel ?? (onSeek ? 'Seek' : 'Waveform')}
      aria-valuemin={onSeek ? 0 : undefined}
      aria-valuemax={onSeek ? 100 : undefined}
      aria-valuenow={onSeek ? Math.round(Math.max(0, Math.min(1, progress)) * 100) : undefined}
      tabIndex={onSeek ? 0 : undefined}
      onKeyDown={
        onSeek
          ? (e) => {
              if (e.key === 'ArrowRight') onSeek(Math.min(1, progress + 0.02));
              if (e.key === 'ArrowLeft') onSeek(Math.max(0, progress - 0.02));
            }
          : undefined
      }
      className={className}
      style={{
        display: 'block',
        width: '100%',
        height,
        cursor: onSeek ? 'crosshair' : undefined,
        touchAction: onSeek ? 'none' : undefined,
        ...style,
      }}
    />
  );
};
