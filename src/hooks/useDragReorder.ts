import { useCallback, useRef, useState } from 'react';

/**
 * Drag-to-reorder for a vertical list, on mouse and touch alike.
 *
 * Pointer events rather than HTML5 drag-and-drop, which fires no events on
 * touch — that is why the studio's `draggable` rows are gated on `!isMobile`
 * and do nothing on a phone. Pointer events are one code path for both.
 *
 * The drag is grabbed from a handle, never the row: these rows are already
 * click-to-play with a click-to-scrub waveform inside them, and on touch a
 * whole-row drag would also fight the page scroll.
 *
 * Positions are measured once at pointerdown and not re-read while dragging, so
 * a row that shifts under the pointer can't feed its own movement back in.
 */

export interface DragState {
  /** Index the drag started from. */
  from: number;
  /** Index it would land on if released now. */
  to: number;
  /** Vertical distance dragged, for translating the lifted row. */
  offset: number;
}

/** How one row should render during a drag. */
export interface RowDragState {
  /** This is the row being dragged: lift it and let it follow the pointer. */
  dragging: boolean;
  /** How far to translate it. */
  offset: number;
  /** Draw the drop indicator on this row's top or bottom edge. */
  line: 'before' | 'after' | null;
}

/**
 * What row `index` should look like given the live drag.
 *
 * The drop indicator marks the edge the row would land against — above the
 * target when moving up the list, below it when moving down — rather than
 * shifting every row in between, which would depend on all rows being the same
 * height.
 */
export const rowDragState = (drag: DragState | null, index: number): RowDragState => {
  if (!drag) return { dragging: false, offset: 0, line: null };
  if (drag.from === index) return { dragging: true, offset: drag.offset, line: null };
  if (drag.to !== index) return { dragging: false, offset: 0, line: null };
  return { dragging: false, offset: 0, line: drag.to < drag.from ? 'before' : 'after' };
};

interface UseDragReorderOptions {
  /** Persist the move. Called once, on release, only if the index changed. */
  onReorder: (from: number, to: number) => void;
  /** When false the handle props are inert, so a read-only view renders nothing. */
  enabled?: boolean;
}

interface UseDragReorderResult {
  /** Live drag, or null. Rows read this to render the gap and the lift. */
  drag: DragState | null;
  /** Spread onto each row's container so its position can be measured. */
  rowProps: (index: number) => { ref: (node: HTMLElement | null) => void };
  /** Spread onto the grip inside row `index`. */
  handleProps: (index: number) => {
    onPointerDown: (event: React.PointerEvent) => void;
    style: React.CSSProperties;
  };
}

export const useDragReorder = ({
  onReorder,
  enabled = true,
}: UseDragReorderOptions): UseDragReorderResult => {
  const [drag, setDrag] = useState<DragState | null>(null);

  const rows = useRef(new Map<number, HTMLElement>());
  // Read by the pointermove handler, which is registered once per drag and
  // would otherwise close over the first render's state.
  const live = useRef<DragState | null>(null);

  const rowProps = useCallback(
    (index: number) => ({
      ref: (node: HTMLElement | null) => {
        if (node) rows.current.set(index, node);
        else rows.current.delete(index);
      },
    }),
    []
  );

  const start = useCallback(
    (index: number, event: React.PointerEvent) => {
      // Secondary buttons open context menus; only a primary press drags.
      if (!enabled || (event.pointerType === 'mouse' && event.button !== 0)) return;

      // The handle owns this gesture: no scrolling, no text selection, no
      // click reaching the row underneath and starting playback.
      event.preventDefault();
      event.stopPropagation();

      // A snapshot of where every row sits right now. Midpoints are what a
      // drop tests against, so a row is taken over once the pointer passes its
      // centre rather than its edge.
      const startY = event.clientY;
      const midpoints = [...rows.current.entries()]
        .map(([rowIndex, node]) => {
          const box = node.getBoundingClientRect();
          return { index: rowIndex, middle: box.top + box.height / 2 };
        })
        .sort((a, b) => a.index - b.index);

      const begin: DragState = { from: index, to: index, offset: 0 };
      live.current = begin;
      setDrag(begin);

      const move = (moveEvent: PointerEvent) => {
        const offset = moveEvent.clientY - startY;

        // The last row whose midpoint the pointer has passed. Rows never move
        // during the drag, so this stays stable as the pointer travels.
        let to = 0;
        for (const row of midpoints) {
          if (moveEvent.clientY > row.middle) to = row.index + 1;
        }
        // Landing below its own slot means removing this row first, so the
        // target index shifts up by one.
        if (to > index) to -= 1;
        to = Math.max(0, Math.min(midpoints.length - 1, to));

        const next = { from: index, to, offset };
        live.current = next;
        setDrag(next);
      };

      const end = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', end);
        window.removeEventListener('pointercancel', end);

        const finished = live.current;
        live.current = null;
        setDrag(null);

        if (finished && finished.to !== finished.from) onReorder(finished.from, finished.to);
      };

      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
    },
    [enabled, onReorder]
  );

  const handleProps = useCallback(
    (index: number) => ({
      onPointerDown: (event: React.PointerEvent) => start(index, event),
      // `touch-action: none` is what stops the browser claiming the gesture as
      // a scroll before the first pointermove ever arrives.
      style: { touchAction: 'none' as const, cursor: 'grab' },
    }),
    [start]
  );

  return { drag, rowProps, handleProps };
};
