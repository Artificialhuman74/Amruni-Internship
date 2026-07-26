import { useCallback, useEffect, useState } from 'react';

/**
 * Where the SOS button lives, and the rules for moving it.
 *
 * It has two homes. Docked, it sits in a well in the middle of the tab bar,
 * where it is always in the same place and always in reach. Undocked, it rides
 * either side edge at a height she chose — for a woman who holds her phone in
 * one hand, or who wants it clear of the dock while she reads.
 *
 * The vertical position is stored as a ratio of the travel rather than a pixel
 * offset, so rotating the phone or opening the keyboard moves the button
 * proportionally instead of pinning it to a coordinate that no longer exists.
 */

const STORAGE_KEY = 'amruni_sos_dock';

export const SOS_SIZE = 56;

// How close to the well a drop has to land to re-dock. Generous on purpose:
// putting the button back should feel like the dock is catching it, not like
// hitting a target.
const DOCK_CATCH_RADIUS = 96;

// Breathing room between the button and the surfaces it must never overlap —
// the notch and status bar above, the tab bar below.
const EDGE_MARGIN = 12;

const DEFAULT = { docked: true, side: 'right', yRatio: 0.62 };

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw);
    return {
      docked: parsed.docked !== false,
      side: parsed.side === 'left' ? 'left' : 'right',
      yRatio: typeof parsed.yRatio === 'number' && parsed.yRatio >= 0 && parsed.yRatio <= 1
        ? parsed.yRatio
        : DEFAULT.yRatio,
    };
  } catch {
    return DEFAULT;
  }
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * The rectangle the button is allowed to rest in, in viewport coordinates.
 * `columnEl` is the app shell, so on a wide screen the button hugs the phone
 * column's edges rather than flying off to the window's.
 */
export function travelBounds(columnEl) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const rect = columnEl?.getBoundingClientRect();
  const left = rect ? rect.left : 0;
  const right = rect ? rect.right : vw;

  const styles = getComputedStyle(document.documentElement);
  const navHeight = parseFloat(styles.getPropertyValue('--nav-height')) || 72;
  const safeTop = parseFloat(styles.getPropertyValue('--safe-top')) || 0;
  const safeBottom = parseFloat(styles.getPropertyValue('--safe-bottom')) || 0;

  return {
    left: left + EDGE_MARGIN,
    right: right - EDGE_MARGIN - SOS_SIZE,
    top: safeTop + EDGE_MARGIN,
    bottom: vh - navHeight - safeBottom - EDGE_MARGIN - SOS_SIZE,
    centerX: (left + right) / 2,
  };
}

// How far below the tab bar's top edge the docked button's centre sits. Less
// than half its height, so the disc breaks the bar's top line and reads as
// seated *in* the well rather than floating over it.
const DOCK_RAISE = 18;

/**
 * Where the button rests when docked. Measured from the nav bar rather than
 * from the well element, because the well is mid-layout-animation at exactly
 * the moment the button needs its target — the bar isn't.
 */
export function dockAnchor(navEl) {
  if (!navEl) return null;
  const n = navEl.getBoundingClientRect();
  return {
    x: n.left + n.width / 2 - SOS_SIZE / 2,
    y: n.top + DOCK_RAISE - SOS_SIZE / 2,
  };
}

/** Top-left viewport coordinate for a given resting place. */
export function positionFor(state, columnEl, navEl) {
  if (state.docked) {
    const anchor = dockAnchor(navEl);
    if (anchor) return anchor;
  }
  const b = travelBounds(columnEl);
  const travel = Math.max(0, b.bottom - b.top);
  return {
    x: state.side === 'left' ? b.left : b.right,
    y: b.top + travel * state.yRatio,
  };
}

/**
 * Whether a point is inside the well's catch zone. Read live during the drag
 * so the dock can visibly reach for the button before she lets go — the whole
 * difference between "it snapped" and "I aimed and hit it".
 */
export function isNearDock(centerX, centerY, navEl) {
  const anchor = dockAnchor(navEl);
  if (!anchor) return false;
  const dx = centerX - (anchor.x + SOS_SIZE / 2);
  const dy = centerY - (anchor.y + SOS_SIZE / 2);
  return Math.hypot(dx, dy) <= DOCK_CATCH_RADIUS;
}

/**
 * Turns a drop point into a resting place. Landing near the well re-docks;
 * anywhere else snaps to whichever side edge is closer, at the height it was
 * released — the horizontal axis is decided for her, the vertical one isn't.
 */
export function resolveDrop(centerX, centerY, columnEl, navEl) {
  if (isNearDock(centerX, centerY, navEl)) return { docked: true };
  const b = travelBounds(columnEl);
  const travel = Math.max(1, b.bottom - b.top);
  const topY = clamp(centerY - SOS_SIZE / 2, b.top, b.bottom);
  return {
    docked: false,
    side: centerX < b.centerX ? 'left' : 'right',
    yRatio: clamp((topY - b.top) / travel, 0, 1),
  };
}

export function useSosDock() {
  const [state, setState] = useState(readStored);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // A private-mode browser refusing storage must not break the button.
    }
  }, [state]);

  const dock = useCallback(() => setState((s) => ({ ...s, docked: true })), []);
  const place = useCallback((next) => {
    setState((s) => (next.docked ? { ...s, docked: true } : { ...s, ...next, docked: false }));
  }, []);

  return { dockState: state, dock, place };
}
