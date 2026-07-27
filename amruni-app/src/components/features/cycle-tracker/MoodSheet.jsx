import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { MoodFlower, BANDS } from './';
import { useBodyOverlay } from '../../../lib/useBodyOverlay';
import { tap, confirm } from '../../../lib/haptics';
import { IconClose, IconCheck } from '../../../icons.jsx';

/**
 * State of Mind — one surface, two scopes.
 *
 * `moment` asks how she feels right now and can be logged as often as she
 * likes. `day` asks how the whole day landed and there is only ever one per
 * date. The distinction is Apple Health's, and it is the right one: an hour of
 * dread on a good day is true, and so is the good day.
 *
 * The entire field — background, bloom, type colour, button — is mixed from
 * the chosen valence, so the screen has already answered before the label
 * does. That whole-surface response is the point, and it's why this is a
 * takeover rather than a card.
 *
 * Rendered through a portal to <body>. It used to mount inside the scrolling
 * screen, where an ancestor's stacking context left its Next button pinned
 * behind the tab bar — a full-screen surface cannot live inside the layout it
 * covers.
 */

const EXPO = [0.16, 1, 0.3, 1];
const ORDER = [-3, -2, -1, 0, 1, 2, 3];

const WORDS = {
  '-3': ['Overwhelmed', 'Exhausted', 'Frightened', 'Alone', 'Hopeless', 'Panicked'],
  '-2': ['Drained', 'Irritable', 'Anxious', 'Achy', 'Worried', 'Restless'],
  '-1': ['Tired', 'Uneasy', 'Sensitive', 'Low', 'Distracted', 'Impatient'],
  '0': ['Calm', 'Steady', 'Quiet', 'Reflective', 'Unsure', 'Waiting'],
  '1': ['Content', 'Hopeful', 'Relieved', 'Comfortable', 'Grateful', 'Rested'],
  '2': ['Peaceful', 'Joyful', 'Connected', 'Energised', 'Warm', 'Confident'],
  '3': ['Radiant', 'Elated', 'Amazed', 'Overjoyed', 'Powerful', 'Free'],
};

// Pregnancy replaces a few words rather than the whole vocabulary — the fear
// has a specific object then, and naming it is most of the relief.
const PREGNANCY_WORDS = {
  '-3': ['Frightened for the baby', 'Overwhelmed', 'Exhausted', 'Nauseous', 'Alone', 'Panicked'],
  '-2': ['Uncomfortable', 'Drained', 'Anxious', 'Achy', 'Worried', 'Restless'],
  '2': ['Peaceful', 'Joyful', 'Connected', 'Energised', 'Glowing', 'Confident'],
  '3': ['Radiant', 'Elated', 'Blessed', 'Amazed', 'Overjoyed', 'Powerful'],
};

// Grouped body / people / life, so the eye lands on three short lists rather
// than one wall of chips.
const FACTORS = [
  ['Sleep', 'Energy', 'Pain', 'Health', 'Appetite', 'Hormones'],
  ['Partner', 'Family', 'Friends', 'Being alone'],
  ['Work', 'Studies', 'Money', 'Appointments', 'Travel', 'Weather'],
];

const PREGNANCY_FACTORS = [
  ['Sleep', 'Energy', 'Nausea', 'Pain', 'Body changes', 'Baby movement'],
  ['Baby', 'Partner', 'Family', 'Friends'],
  ['Work', 'Money', 'Appointments', 'Travel', 'Weather'],
];

/** The bloom is the subject, but never at the cost of the control below it. */
function useBloomSize() {
  const [size, setSize] = useState(() => bloom());
  useEffect(() => {
    const onResize = () => setSize(bloom());
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);
  return size;
}

function bloom() {
  if (typeof window === 'undefined') return 230;
  return Math.round(Math.max(96, Math.min(250, window.innerWidth * 0.6, window.innerHeight * 0.29)));
}

export default function MoodSheet({
  open,
  onClose,
  onSave,
  scope = 'moment',
  pregnancyMode = false,
  saving = false,
  initial = null,
}) {
  const reduce = useReducedMotion();
  const bloomSize = useBloomSize();

  const [step, setStep] = useState(0);   // 0 feel · 1 word · 2 factors
  const [band, setBand] = useState(0);
  const [word, setWord] = useState(null);
  const [factors, setFactors] = useState([]);

  const trackRef = useRef(null);

  useBodyOverlay(open);

  // Every open starts clean unless it's editing something that already exists.
  // Adjusted during render rather than in an effect, so the first frame of the
  // sheet is already the reset one — an effect would paint the previous
  // session's answers for a frame before clearing them.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStep(0);
      setBand(initial?.valence ?? 0);
      setWord(initial?.word ?? null);
      setFactors(initial?.factors ?? []);
    }
  }

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const b = BANDS[String(band)];
  const words = (pregnancyMode && PREGNANCY_WORDS[String(band)]) || WORDS[String(band)];
  const factorGroups = pregnancyMode ? PREGNANCY_FACTORS : FACTORS;

  const isDay = scope === 'day';
  const title = isDay ? 'How today felt' : 'Right now';
  const headline = isDay
    ? 'Taking today as a whole, how did it feel?'
    : 'Choose how you’re feeling right now';

  function bandFromClientX(clientX) {
    const el = trackRef.current;
    if (!el) return band;
    const rect = el.getBoundingClientRect();
    const frac = rect.width ? (clientX - rect.left) / rect.width : 0.5;
    return ORDER[Math.round(Math.min(1, Math.max(0, frac)) * 6)];
  }

  function setFromPointer(clientX) {
    const next = bandFromClientX(clientX);
    if (next !== band) { tap(); setBand(next); }
  }

  function onKeyDown(e) {
    const i = ORDER.indexOf(band);
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); setBand(ORDER[Math.min(6, i + 1)]); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); setBand(ORDER[Math.max(0, i - 1)]); }
    else if (e.key === 'Home') { e.preventDefault(); setBand(-3); }
    else if (e.key === 'End') { e.preventDefault(); setBand(3); }
  }

  function toggleFactor(f) {
    tap();
    setFactors((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  }

  function finish() {
    confirm();
    onSave({ valence: band, word, factors, scope });
  }

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            className="mood-scrim"
            aria-hidden="true"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0.18 : 0.4, ease: EXPO }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            className="mood-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={isDay ? 'Log how today felt' : 'Log how you feel right now'}
            initial={reduce ? { opacity: 0 } : { y: '100%' }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: '100%' }}
            transition={{ duration: reduce ? 0.18 : 0.54, ease: EXPO }}
            style={{ color: b.ink }}
          >
            <motion.div
              className="mood-sheet__field"
              aria-hidden="true"
              animate={{ background: `linear-gradient(178deg, ${b.wash2} 0%, ${b.wash} 62%, ${b.wash} 100%)` }}
              transition={{ duration: reduce ? 0 : 0.62, ease: EXPO }}
            />

            <header className="mood-sheet__bar">
              {step > 0 ? (
                <button type="button" className="mood-sheet__circle" onClick={() => setStep(step - 1)} aria-label="Back a step">
                  <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M10 3l-5 5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ) : <span className="mood-sheet__circle mood-sheet__circle--ghost" aria-hidden="true" />}

              <span className="mood-sheet__bar-title">{title}</span>

              <button type="button" className="mood-sheet__circle" onClick={onClose} aria-label="Close without logging">
                <IconClose size={17} strokeWidth={2} />
              </button>
            </header>

            <div className="mood-sheet__body">
              <AnimatePresence mode="wait" initial={false}>
                {step === 0 && (
                  <motion.div
                    key="feel"
                    className="mood-step mood-step--feel"
                    initial={reduce ? { opacity: 0 } : { opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, x: -16 }}
                    transition={{ duration: reduce ? 0.15 : 0.34, ease: EXPO }}
                  >
                    <h2 className="mood-sheet__headline">{headline}</h2>

                    <div className="mood-step__stage">
                      <MoodFlower band={band} size={bloomSize} />
                    </div>

                    <p className="mood-sheet__verdict" aria-hidden="true">{b.label}</p>

                    <div className="mood-slider">
                      <div
                        ref={trackRef}
                        className="mood-slider__track"
                        role="slider"
                        tabIndex={0}
                        aria-label="How you're feeling"
                        aria-valuemin={-3}
                        aria-valuemax={3}
                        aria-valuenow={band}
                        aria-valuetext={b.label}
                        onKeyDown={onKeyDown}
                        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setFromPointer(e.clientX); }}
                        onPointerMove={(e) => { if (e.buttons) setFromPointer(e.clientX); }}
                      >
                        <span className="mood-slider__rail" aria-hidden="true">
                          <motion.span
                            className="mood-slider__thumb"
                            animate={{ left: `${((band + 3) / 6) * 100}%` }}
                            transition={{ duration: reduce ? 0 : 0.32, ease: EXPO }}
                          />
                        </span>
                      </div>
                      <div className="mood-slider__ends" aria-hidden="true">
                        <span>Very unpleasant</span>
                        <span>Very pleasant</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 1 && (
                  <motion.div
                    key="word"
                    className="mood-step"
                    initial={reduce ? { opacity: 0 } : { opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, x: -16 }}
                    transition={{ duration: reduce ? 0.15 : 0.34, ease: EXPO }}
                  >
                    <div className="mood-step__crown">
                      <MoodFlower band={band} size={Math.min(112, bloomSize)} breathe={false} />
                      <p className="mood-sheet__verdict mood-sheet__verdict--sm">{b.label}</p>
                    </div>

                    <h3 className="mood-sheet__question">Which word fits it best?</h3>
                    <div className="mood-chips" role="group" aria-label={`Words for ${b.label}`}>
                      {words.map((w) => (
                        <button
                          key={w}
                          type="button"
                          className={`mood-chip${word === w ? ' mood-chip--on' : ''}`}
                          aria-pressed={word === w}
                          onClick={() => { tap(); setWord(w); }}
                          style={word === w ? { background: b.btn, borderColor: b.btn } : undefined}
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="factors"
                    className="mood-step"
                    initial={reduce ? { opacity: 0 } : { opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, x: -16 }}
                    transition={{ duration: reduce ? 0.15 : 0.34, ease: EXPO }}
                  >
                    <div className="mood-step__crown">
                      <MoodFlower band={band} size={Math.min(112, bloomSize)} breathe={false} />
                      <p className="mood-sheet__verdict mood-sheet__verdict--sm">{word || b.label}</p>
                    </div>

                    <h3 className="mood-sheet__question">What&rsquo;s behind it?</h3>
                    {factorGroups.map((group, gi) => (
                      <div className="mood-chips" key={gi} role="group" aria-label={`Factors, group ${gi + 1}`}>
                        {group.map((f) => {
                          const on = factors.includes(f);
                          return (
                            <button
                              key={f}
                              type="button"
                              className={`mood-chip${on ? ' mood-chip--on' : ''}`}
                              aria-pressed={on}
                              onClick={() => toggleFactor(f)}
                              style={on ? { background: b.btn, borderColor: b.btn } : undefined}
                            >
                              {on && <IconCheck size={14} />}
                              {f}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                    <p className="mood-sheet__optional">Skip this if nothing stands out.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <footer className="mood-sheet__foot">
              <motion.button
                type="button"
                className="mood-sheet__cta"
                onClick={() => (step === 2 ? finish() : setStep(step + 1))}
                disabled={(step === 1 && !word) || saving}
                animate={{ backgroundColor: b.btn }}
                transition={{ duration: reduce ? 0 : 0.5, ease: EXPO }}
              >
                {step === 2 ? (saving ? 'Saving…' : 'Done') : 'Next'}
              </motion.button>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body,
  );
}
