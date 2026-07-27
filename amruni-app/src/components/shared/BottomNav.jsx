import { motion, useReducedMotion } from 'framer-motion';

/**
 * The tab bar, the gap the SOS button sits in, and the socket that receives it.
 *
 * Two separate mechanisms, because they answer two different questions:
 *
 *   The well is pure layout. It mounts and unmounts, and the tabs carry
 *   `layout` so framer FLIPs them into the space with transforms. Nothing
 *   animates a width or a flex-basis — the bar is laid out twice and the
 *   difference is played back on the GPU, which is why four icons closing a
 *   gap costs nothing and lands exactly where a static bar would put them.
 *
 *   The socket is pure paint, absolutely positioned and always mounted. It
 *   never participates in layout, so it can fade and contract on its own
 *   timeline while the tabs are still moving — and, being permanent, it has
 *   something to animate *from* the moment the button comes near.
 *
 * The authored moment is the ring: it starts wide and slightly off-axis, then
 * contracts square onto the seat as the button enters catch range. The dock
 * reaches for the button rather than waiting to be hit.
 */

// Firm, barely-overshooting: the tabs should read as being drawn into the gap,
// not as springing. Bounce here would make an emergency control feel playful.
const PLUNGE = { type: 'spring', stiffness: 520, damping: 38, mass: 0.9 };

// Arrival is authored; departure gets out of the way. Expo ease-out, per the
// app's own curve.
const EXPO = [0.16, 1, 0.3, 1];

// `ref` arrives as an ordinary prop (React 19) — the shell needs the bar's box
// to work out where the docked button sits.
export default function BottomNav({ ref, tabs, active, onTab, showWell, wellRef, wellArmed }) {
  const reduce = useReducedMotion();
  const transition = reduce ? { duration: 0 } : PLUNGE;

  // Splits the tabs around the well so SOS sits in the middle of the bar.
  const mid = Math.ceil(tabs.length / 2);
  const before = tabs.slice(0, mid);
  const after = tabs.slice(mid);

  const renderTab = ({ path, label, icon: Icon, className: tabClass }) => {
    const isActive = active === path;
    return (
      <motion.button
        key={path}
        layout
        transition={transition}
        role="tab"
        aria-selected={isActive}
        aria-label={label}
        className={`bottom-nav__tab${isActive ? ' bottom-nav__tab--active' : ''}${tabClass ? ` ${tabClass}` : ''}`}
        onClick={() => onTab(path)}
      >
        <motion.span
          className="bottom-nav__tab-icon"
          animate={{ scale: isActive ? 1.1 : 1 }}
          transition={{ duration: 0.15, ease: EXPO }}
        >
          <Icon active={isActive} />
        </motion.span>
        <span className="bottom-nav__tab-label">{label}</span>
      </motion.button>
    );
  };

  return (
    <nav className="bottom-nav" role="tablist" ref={ref}>
      {before.map(renderTab)}

      {showWell && (
        <motion.div layout ref={wellRef} transition={transition} className="bottom-nav__well" aria-hidden="true" />
      )}

      {after.map(renderTab)}

      {/* The socket. Outside the flex flow entirely, so showing it costs one
          composited layer and never a reflow of the bar. */}
      <div className="bottom-nav__socket" aria-hidden="true">
        <motion.span
          className="bottom-nav__socket-seat"
          initial={false}
          animate={wellArmed ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
          transition={reduce ? { duration: 0 } : { duration: wellArmed ? 0.26 : 0.16, ease: EXPO }}
        />
        <motion.span
          className="bottom-nav__socket-ring"
          initial={false}
          animate={wellArmed
            ? { opacity: 0.9, scale: 1, rotate: 0 }
            : { opacity: 0, scale: 1.45, rotate: -14 }}
          transition={reduce ? { duration: 0 } : { duration: wellArmed ? 0.4 : 0.18, ease: EXPO }}
        />
      </div>
    </nav>
  );
}
