import { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import {
  motion, AnimatePresence, useMotionValue, animate, useReducedMotion,
} from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useSOSActivation } from '../lib/useSOSActivation';
import { positionFor, resolveDrop, isNearDock, SOS_SIZE } from '../lib/useSosDock';
import { tap, warn, confirm } from '../lib/haptics';

/**
 * The emergency button.
 *
 * Three gestures share one control, and the cost of confusing them is not
 * symmetric — a missed alert is bad, an alert she didn't ask for is worse,
 * because it calls her contacts and can call a stranger to her door. So the
 * separation is deliberate rather than incidental:
 *
 *   tap          → open the SOS page
 *   hold 1s      → arm the countdown
 *   drag         → move the button, and never anything else
 *
 * Any movement past MOVE_TOLERANCE cancels a pending hold outright. Carrying
 * the phone, adjusting a grip, or dragging the button to a new corner cannot
 * arm an alert, and the countdown still gives five seconds to take it back.
 */

// The distance a finger is allowed to wander before the press stops counting
// as a hold. Below a few pixels this fires on the tremor of just resting a
// thumb on the glass.
const MOVE_TOLERANCE = 8;

// One full second. Half was enough to arm it from a fumble in a pocket.
const HOLD_MS = 1000;

const COUNTDOWN_FROM = 5;

// Firm and quick: the button should feel like it's being caught by the edge,
// not floated over to it.
const SETTLE = { type: 'spring', stiffness: 420, damping: 32, mass: 0.9 };

export default function SOSButton({ dockState, place, columnRef, navRef, onNearDock, onDragging }) {
  const { state } = useApp();
  const { activateSOS } = useSOSActivation();
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  const [counting, setCounting] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_FROM);
  const [dragging, setDragging] = useState(false);
  const [nearDock, setNearDock] = useState(false);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const holdTimer = useRef(null);
  const countdownTimer = useRef(null);
  const holdFired = useRef(false);
  const didDrag = useRef(false);
  const pressOrigin = useRef({ x: 0, y: 0 });
  const placed = useRef(false);
  const nearDockRef = useRef(false);
  const draggingRef = useRef(false);
  const stopRef = useRef(null);

  const isActive = state.sos.activeSession !== null;

  const clearHold = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);

  // ── Placement ──────────────────────────────────────────────
  // The button is always `position: fixed` at the origin and moved by x/y, so
  // the drag gesture and the settle animation write to the same two values and
  // can never disagree about where it is.
  const settle = useCallback((animated) => {
    const p = positionFor(dockState, columnRef.current, navRef.current);
    if (animated && !reduce) {
      animate(x, p.x, SETTLE);
      animate(y, p.y, SETTLE);
    } else {
      x.set(p.x);
      y.set(p.y);
    }
  }, [dockState, columnRef, navRef, reduce, x, y]);

  useLayoutEffect(() => {
    settle(placed.current);
    placed.current = true;
  }, [settle]);

  // The bar's height isn't final until the web fonts land and the safe-area
  // insets resolve, so the first measurement can be a few pixels stale. One
  // silent correction on the next frame; nothing visible moves.
  useEffect(() => {
    const id = requestAnimationFrame(() => settle(false));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rotating the phone or opening the keyboard changes the travel; the button
  // moves proportionally rather than being left over the content.
  useEffect(() => {
    // Not while she's holding it — the keyboard opening mid-drag would
    // otherwise pull the button out from under her finger.
    const onResize = () => { if (!draggingRef.current) settle(false); };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [settle]);

  // ── Countdown ──────────────────────────────────────────────
  // `activateSOS` is rebuilt on every render by its hook, and this component
  // re-renders on every tick. Depending on it directly restarted the interval
  // — and with it the deadline — several times a second, which is why the
  // count visibly bounced 5-4-5-4 and never reached zero. Held in a ref so the
  // effect depends only on whether we're counting.
  const activateRef = useRef(activateSOS);
  useEffect(() => { activateRef.current = activateSOS; });

  // Driven off a wall-clock deadline rather than a timeout chain: a
  // backgrounded tab throttles timers, and five seconds of "sending" silently
  // becoming twenty is the one thing this must not do.
  useEffect(() => {
    if (!counting) return undefined;
    const deadline = Date.now() + COUNTDOWN_FROM * 1000;
    countdownTimer.current = setInterval(() => {
      const left = Math.ceil((deadline - Date.now()) / 1000);
      if (left <= 0) {
        clearInterval(countdownTimer.current);
        setCounting(false);
        activateRef.current();
      } else {
        setCountdown(left);
      }
    }, 200);
    return () => clearInterval(countdownTimer.current);
  }, [counting]);

  useEffect(() => () => {
    clearTimeout(holdTimer.current);
    clearInterval(countdownTimer.current);
  }, []);

  // ── Gestures ───────────────────────────────────────────────
  function onPointerDown(e) {
    if (counting || isActive) return;
    holdFired.current = false;
    didDrag.current = false;
    pressOrigin.current = { x: e.clientX, y: e.clientY };
    // Capture, so every later event for this pointer comes back here. Without
    // it, a press that slid off the button delivered no pointerup at all and
    // left the hold running — an alert arming under a finger that had already
    // moved on.
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not all pointers can be captured */ }
    holdTimer.current = setTimeout(() => {
      holdFired.current = true;
      warn();                    // the arming itself is felt, not just seen
      setCountdown(COUNTDOWN_FROM);
      setCounting(true);
    }, HOLD_MS);
  }

  // The guard that matters: a hold only survives while the finger stays put.
  function onPointerMove(e) {
    if (!holdTimer.current) return;
    const dx = e.clientX - pressOrigin.current.x;
    const dy = e.clientY - pressOrigin.current.y;
    if (Math.hypot(dx, dy) > MOVE_TOLERANCE) clearHold();
  }

  function onPointerUp() {
    clearHold();
  }

  // Activation lives on click, not pointerup: pointer events never fire for a
  // keyboard Enter or Space, so the emergency button could not be operated
  // from a keyboard at all. Click covers both, and the guards below keep a
  // drag or a completed hold from also counting as a press.
  function onClick() {
    if (didDrag.current || holdFired.current || counting) return;
    tap();
    // A live alert is never cancelled by a single tap on a button she may have
    // brushed while moving the phone. The tap opens the SOS page, where
    // stopping it is a deliberate, labelled action.
    navigate('/sos');
  }

  // The drag is pointer-only, so the keyboard gets its own way to move the
  // button: arrows to place it, Home to send it back to the dock. Without this
  // the position is simply unreachable for anyone not using a touchscreen.
  function onKeyDown(e) {
    const step = 0.12;
    if (e.key === 'Home') {
      e.preventDefault(); confirm(); place({ docked: true });
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault(); tap();
      place({ docked: false, side: e.key === 'ArrowLeft' ? 'left' : 'right', yRatio: dockState.yRatio });
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault(); tap();
      const delta = e.key === 'ArrowUp' ? -step : step;
      place({
        docked: false,
        side: dockState.side,
        yRatio: Math.min(1, Math.max(0, dockState.yRatio + delta)),
      });
    }
  }

  function handleDragStart() {
    clearHold();          // dragging can never arm an alert
    didDrag.current = true;
    draggingRef.current = true;
    setDragging(true);
    onDragging?.(true);
    // Seed proximity from where it actually is. Lifting it straight out of the
    // well starts `near` true, so the bar only closes once she's carried it
    // clear — the gap follows the button rather than the button's release.
    const near = isNearDock(x.get() + SOS_SIZE / 2, y.get() + SOS_SIZE / 2, navRef.current);
    nearDockRef.current = near;
    setNearDock(near);
    onNearDock?.(near);
    tap();
  }

  function handleDrag() {
    const near = isNearDock(x.get() + SOS_SIZE / 2, y.get() + SOS_SIZE / 2, navRef.current);
    if (near === nearDockRef.current) return;
    nearDockRef.current = near;
    setNearDock(near);
    onNearDock?.(near);
    if (near) tap();   // the click of the well taking hold
  }

  function handleDragEnd() {
    draggingRef.current = false;
    setDragging(false);
    onDragging?.(false);
    const next = resolveDrop(
      x.get() + SOS_SIZE / 2,
      y.get() + SOS_SIZE / 2,
      columnRef.current,
      navRef.current,
    );
    nearDockRef.current = false;
    setNearDock(false);
    onNearDock?.(!!next.docked);
    // Landing in the well is confirmed in the hand, not just on screen.
    if (next.docked) confirm(); else tap();
    // `place` alone finishes this. Settling here as well would animate to the
    // position held in *this* closure — the one it just left — and only then
    // pick up the new one, which is the bounce-back it used to do.
    place(next);
  }

  // Focus goes to Stop the moment the countdown opens, and Escape works from
  // anywhere. Five seconds is not long enough to go looking for the way out.
  useEffect(() => {
    if (!counting) return undefined;
    stopRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); cancelCountdown(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [counting]);

  function cancelCountdown() {
    setCounting(false);
    clearInterval(countdownTimer.current);
    setCountdown(COUNTDOWN_FROM);
    tap();
  }

  // Undocked and idle, it leans a little past the column edge — enough to stop
  // covering what she's reading, never enough to hide what it is or shrink
  // where she can hit it.
  const tucked = !dockState.docked && !dragging && !counting;
  const lean = tucked ? (dockState.side === 'left' ? -13 : 13) : 0;

  const label = isActive ? 'Cancel the active SOS alert' : 'SOS — tap to open, hold to send an alert';

  return (
    <>
      {/* Two elements, because they animate on different axes and must not
          share a transform: the outer one is *where the button is* (drag and
          settle both write x/y), the inner one is *how it's behaving* (the
          lean at rest, the lift while carried). Collapsing them would have the
          lean overwrite the drag position. */}
      <motion.div
        drag
        dragMomentum={false}
        dragElastic={0.12}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        style={{ x, y, width: SOS_SIZE, height: SOS_SIZE, position: 'fixed', top: 0, left: 0 }}
        className="sos-orb-carrier"
      >
        <motion.button
          type="button"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={clearHold}
          onClick={onClick}
          onKeyDown={onKeyDown}
          animate={{ x: lean, scale: dragging ? (nearDock ? 0.94 : 1.12) : 1 }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 28 }}
          className={`sos-orb${isActive ? ' sos-orb--active' : ''}${dragging ? ' sos-orb--dragging' : ''}${dockState.docked ? ' sos-orb--docked' : ''}`}
          aria-label={label}
        >
          <span className="sos-orb__label">{isActive ? 'ON' : 'SOS'}</span>
        </motion.button>
      </motion.div>

      <AnimatePresence>
        {counting && (
          <motion.div
            className="sos-countdown"
            role="alertdialog"
            aria-modal="true"
            aria-label="Sending an emergency alert"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0.15 : 0.28 }}
          >
            <AnimatePresence mode="popLayout">
              <motion.p
                key={countdown}
                className="sos-countdown__digit"
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.35 }}
                transition={{ duration: reduce ? 0.12 : 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                {countdown}
              </motion.p>
            </AnimatePresence>

            <p className="sos-countdown__text">
              Sending your location to your trusted contacts.
            </p>

            {/* The digit above is decorative motion; this is what actually
                reaches a screen reader. Polite, not assertive — assertive
                re-interrupts on every tick and talks over the Stop button. */}
            <p className="sr-only" aria-live="polite">
              {`Sending in ${countdown} second${countdown === 1 ? '' : 's'}. Activate Stop to cancel.`}
            </p>

            <button
              ref={stopRef}
              type="button"
              className="sos-countdown__cancel"
              onClick={cancelCountdown}
            >
              Stop
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
