import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import FertileWindow from '../components/cycle/FertileWindow';
import { ageFromDob } from '../lib/lifeStage';
import {
  fertilityModel, windowHeadline, todayIso,
  CONCEIVE_EVIDENCE, SEEK_HELP_SOONER, seekHelpAfter,
} from '../lib/fertility';
import { tap } from '../lib/haptics';
import { IconSprout, IconAppointment, IconStethoscope } from '../icons.jsx';

/**
 * Trying to conceive.
 *
 * The screen answers one question first — does this week matter — and only
 * then explains itself. That order is deliberate: a woman opening this on a
 * Tuesday morning wants the timing, not a lesson, and burying the date under
 * education is how apps get closed before the useful part is read.
 *
 * The tone underneath it is the harder problem. Trying to conceive is the
 * context in which a health app is most likely to be read as a scoreboard,
 * and a screen that congratulates a well-timed month implies a verdict on the
 * months that did not work. So: nothing here counts cycles she has "failed",
 * nothing streaks, and the evidence section leads with how long conception
 * normally takes rather than with what she should be doing differently.
 */

const EXPO = [0.16, 1, 0.3, 1];

function fmt(iso) {
  return new Date(`${iso}T00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function Conceive() {
  const { state } = useApp();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const [openTip, setOpenTip] = useState(null);

  const today = todayIso();
  const model = useMemo(() => fertilityModel(state.cycle, today), [state.cycle, today]);
  const headline = windowHeadline(model);
  const help = seekHelpAfter(ageFromDob(state.user?.dob));

  if (!model.known) {
    return (
      <div className="ttc">
        <div className="ttc-empty">
          <span className="ttc-empty__mark" aria-hidden="true"><IconSprout size={36} /></span>
          <p className="ttc-empty__title">
            {model.reason === 'stale' ? 'These dates have gone out of date' : 'One date, and the rest follows'}
          </p>
          <p className="ttc-empty__body">
            {model.reason === 'stale'
              ? `The last period here is from ${fmt(model.lastPeriodStart)} — too far back to count a window from without guessing. Add your most recent one and the six days come straight back.`
              : 'The window is counted back from the first day of your last period, using your usual cycle length. Add that one date and it appears.'}
          </p>
          <button className="btn btn--primary" onClick={() => { tap(); navigate('/track'); }}>
            {model.reason === 'stale' ? 'Update your period dates' : 'Add your last period'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ttc">
      {/* The answer, first. */}
      <motion.header
        className={`ttc-hero${headline.urgent ? ' ttc-hero--open' : ''}`}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EXPO }}
      >
        <p className="ttc-hero__title">{headline.title}</p>
        <p className="ttc-hero__body">{headline.body}</p>
        <p className="ttc-hero__dates">
          {fmt(model.windowStart)} – {fmt(model.windowEnd)} · day {model.cycleDay} of your cycle
        </p>
      </motion.header>

      <FertileWindow days={model.days} today={today} />

      {/* The caveat, next to the thing it qualifies rather than in a footnote.
          A window drawn from an average cycle is a starting place, and a woman
          planning around it should know that before she plans around it. */}
      <p className="ttc-caveat">
        These six days are arithmetic, not observation. Even among women with regular
        cycles, only about a third ovulate on the days a calendar expects — so start here,
        and let your own body have the last word.
      </p>

      <section className="ttc-section" aria-label="What raises the chance">
        <h2 className="ttc-section__title">What actually helps</h2>
        <p className="ttc-section__lede">
          All of it from fertility guidelines rather than folklore — including two entries
          that give you permission to stop doing something.
        </p>
        <div className="ttc-list">
          {CONCEIVE_EVIDENCE.map((item) => {
            const open = openTip === item.id;
            return (
              <div key={item.id} className={`ttc-item${open ? ' ttc-item--open' : ''}`}>
                <button
                  className="ttc-item__head"
                  aria-expanded={open}
                  onClick={() => { tap(); setOpenTip(open ? null : item.id); }}
                >
                  <span className="ttc-item__title">{item.title}</span>
                  <span className="ttc-item__chev" aria-hidden="true">▾</span>
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      transition={{ duration: 0.24, ease: EXPO }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div className="ttc-item__body">
                        <p>{item.body}</p>
                        <p className="ttc-item__source">{item.source}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </section>

      {/* Kept last and kept calm. It is the most useful thing on the screen for
          the minority who need it, and the most frightening for everyone else,
          so it states thresholds rather than raising an alarm. */}
      <section className="ttc-section" aria-label="When to ask for help">
        <h2 className="ttc-section__title">When to bring someone in</h2>
        <p className="ttc-help__line">{help.line}</p>
        <p className="ttc-help__sub">Sooner than that, without waiting out the clock, if any of these apply:</p>
        <ul className="ttc-help__list">
          {SEEK_HELP_SOONER.map((s) => <li key={s}>{s}</li>)}
        </ul>
        <div className="ttc-help__actions">
          <button className="btn btn--secondary" onClick={() => { tap(); navigate('/consult'); }}>
            <IconStethoscope size={17} /> Talk to a specialist
          </button>
          <button className="btn btn--ghost" onClick={() => { tap(); navigate('/track'); }}>
            <IconAppointment size={17} /> Update your cycle dates
          </button>
        </div>
      </section>
    </div>
  );
}
