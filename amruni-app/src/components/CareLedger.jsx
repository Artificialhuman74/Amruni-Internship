import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

/**
 * The care ledger — one thread, both people.
 *
 * A link that lets someone else act on your health record is only reasonable
 * if you can see every door they opened. So this is not an activity log tucked
 * behind a settings screen: it is the spine of the surface, and the caretaker
 * reads the same one the patient does.
 *
 * That symmetry is the whole design. Nobody is watching anybody — they are
 * both looking at the same page. An action taken here is announced here, and
 * the announcement is drawn rather than assumed: when something is booked, the
 * event lands in the thread and the line to "she was told" draws itself. You
 * can watch the accountability happen, which is what makes handing out the key
 * feel safe instead of leaky.
 */

const EXPO = [0.16, 1, 0.3, 1];

function whenLabel(iso) {
  const d = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`);
  if (Number.isNaN(d.getTime())) return '';
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function CareLedger({ events = [], patientName, freshId = null }) {
  const reduce = useReducedMotion();

  if (!events.length) {
    return (
      <p className="cl__empty">
        Nothing has happened yet. Anything anyone does here will appear in this thread —
        for both of you.
      </p>
    );
  }

  return (
    <ol className="cl">
      <AnimatePresence initial={false}>
        {events.map((e, i) => {
          const byCaretaker = e.actor === 'caretaker';
          const isFresh = freshId && e.id === freshId;
          return (
            <motion.li
              key={e.id ?? `${e.created_at}-${i}`}
              className={`cl__item${byCaretaker ? ' cl__item--them' : ''}`}
              layout={!reduce}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: reduce ? 0.15 : 0.5, ease: EXPO }}
            >
              <span className="cl__rail" aria-hidden="true">
                <motion.span
                  className={`cl__node${byCaretaker ? ' cl__node--them' : ''}`}
                  initial={reduce || !isFresh ? false : { scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.42, ease: EXPO, delay: 0.1 }}
                />
              </span>

              <div className="cl__body">
                <p className="cl__summary">{e.summary}</p>
                <p className="cl__meta">
                  {byCaretaker ? (e.actor_label || 'Someone with your link') : (patientName || 'She')}
                  {' · '}{whenLabel(e.created_at)}
                </p>

                {/* The notification, drawn rather than claimed. A caretaker
                    action is only acceptable because she is told about it, so
                    the telling is shown as part of the action itself. */}
                {byCaretaker && (
                  <motion.p
                    className="cl__trace"
                    initial={reduce || !isFresh ? false : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, ease: EXPO, delay: isFresh ? 0.55 : 0 }}
                  >
                    <span className="cl__trace-hook" aria-hidden="true" />
                    {patientName ? `${patientName} was told` : 'She was told'}
                  </motion.p>
                )}
              </div>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ol>
  );
}
