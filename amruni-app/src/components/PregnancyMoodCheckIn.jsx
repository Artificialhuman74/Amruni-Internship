import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useApp, usePregnancyData } from '../context/AppContext';
import { useToast } from './Toast';
import { tap, confirm } from '../lib/haptics';
import MoodFlower, { BANDS } from './MoodFlower';
import { IconClose, IconCheck } from '../icons.jsx';

/**
 * Daily pregnancy mood check-in, built on the Apple Health "State of Mind"
 * mechanic: choose a valence, name the feeling, then name what's driving it.
 *
 * Home carries only a quiet invitation. The choosing happens in a full-bleed
 * surface whose entire field — background, bloom, type colour, button — is
 * mixed from the valence, so the screen answers before the label does. That
 * whole-field response is the point of the reference, and it cannot be done
 * inside a card.
 *
 * What's logged stays what the product already stores: a word, a valence, and
 * the factors behind it (persisted in the day's existing `symptoms` list).
 */

const EXPO = [0.16, 1, 0.3, 1];
const ORDER = [-3, -2, -1, 0, 1, 2, 3];

const WORD_BANDS = {
  '-3': ['Anxious about baby', 'Overwhelmed', 'Exhausted', 'Nauseous', 'Scared', 'Alone'],
  '-2': ['Uncomfortable', 'Irritable', 'Drained', 'Achy', 'Worried', 'Restless'],
  '-1': ['Tired', 'Uneasy', 'Sensitive', 'Low', 'Distracted', 'Impatient'],
  '0': ['Calm', 'Steady', 'Quiet', 'Reflective', 'Unsure', 'Waiting'],
  '1': ['Content', 'Hopeful', 'Relieved', 'Comfortable', 'Grateful', 'Rested'],
  '2': ['Peaceful', 'Joyful', 'Connected', 'Energised', 'Glowing', 'Confident'],
  '3': ['Radiant', 'Elated', 'Blessed', 'Amazed', 'Overjoyed', 'Powerful'],
};

// Grouped the way the reference groups them — body, people, life — so the eye
// lands on a short list rather than one long wall of chips.
const FACTOR_GROUPS = [
  ['Health', 'Sleep', 'Energy', 'Body changes', 'Nausea', 'Pain'],
  ['Baby', 'Partner', 'Family', 'Friends'],
  ['Work', 'Money', 'Appointments', 'Travel', 'Weather'],
];

export default function PregnancyMoodCheckIn() {
  const { state, dispatch } = useApp();
  const pregnancyData = usePregnancyData(state);
  const toast = useToast();
  const reduce = useReducedMotion();

  const today = new Date().toISOString().split('T')[0];
  const alreadyLogged = !!state.pregnancy?.loggedDays?.[today]?.mood;
  const gating = Boolean(state.settings?.pregnancyMode) && Boolean(pregnancyData?.known) && !alreadyLogged;

  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0); // 0 feel · 1 word · 2 factors
  const [band, setBand] = useState(0);
  const [word, setWord] = useState(null);
  const [factors, setFactors] = useState([]);

  const trackRef = useRef(null);
  const sliderRef = useRef(null);
  const openerRef = useRef(null);

  const b = BANDS[String(band)];

  // The sheet owns the screen while it's up: lock the page behind it, focus the
  // control that matters, and let Escape out.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open && step === 0) sliderRef.current?.focus();
  }, [open, step]);

  function launch() {
    tap();
    setStep(0);
    setWord(null);
    setFactors([]);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    openerRef.current?.focus();
  }

  function bandFromClientX(clientX) {
    const el = trackRef.current;
    if (!el) return band;
    const rect = el.getBoundingClientRect();
    const frac = rect.width ? (clientX - rect.left) / rect.width : 0.5;
    const idx = Math.round(Math.min(1, Math.max(0, frac)) * 6);
    return ORDER[idx];
  }

  function setFromPointer(clientX) {
    const next = bandFromClientX(clientX);
    if (next !== band) { tap(); setBand(next); }
  }

  function onKeyDown(e) {
    const i = ORDER.indexOf(band);
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault(); setBand(ORDER[Math.min(6, i + 1)]);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault(); setBand(ORDER[Math.max(0, i - 1)]);
    } else if (e.key === 'Home') { e.preventDefault(); setBand(-3); }
    else if (e.key === 'End') { e.preventDefault(); setBand(3); }
  }

  function toggleFactor(f) {
    tap();
    setFactors((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  }

  function finish() {
    dispatch({
      type: 'LOG_PREGNANCY_DAY',
      date: today,
      data: { mood: word, valence: band, symptoms: factors },
    });
    confirm();
    toast('Logged. Thank you for sharing.', { icon: 'heart' });
    setOpen(false);
    setDismissed(true);
  }

  if (!gating && !dismissed) return null;
  const visible = gating && !dismissed;

  return (
    <div className="preg-tint">
      <AnimatePresence>
        {visible && (
          <motion.button
            key="mood-entry"
            ref={openerRef}
            type="button"
            className="mood-entry"
            onClick={launch}
            aria-label="Start today's mood check-in"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: reduce ? 0.18 : 0.46, ease: EXPO }}
          >
            <span className="mood-entry__bloom" aria-hidden="true">
              <MoodFlower band={2} size={64} />
            </span>
            <span className="mood-entry__text">
              <span className="mood-entry__eyebrow">Daily check-in</span>
              <span className="mood-entry__title">How are you feeling today?</span>
              <span className="mood-entry__hint">Takes about a minute</span>
            </span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="mood-entry__chev">
              <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            className="mood-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Daily mood check-in"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: '4%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: '3%' }}
            transition={{ duration: reduce ? 0.18 : 0.5, ease: EXPO }}
            style={{ color: b.ink }}
          >
            {/* The field itself carries the answer — it re-mixes on every change. */}
            <motion.div
              className="mood-sheet__field"
              aria-hidden="true"
              animate={{ background: `linear-gradient(178deg, ${b.wash2} 0%, ${b.wash} 62%, ${b.wash} 100%)` }}
              transition={{ duration: reduce ? 0 : 0.62, ease: EXPO }}
            />

            <header className="mood-sheet__bar">
              {step > 0 ? (
                <button type="button" className="mood-sheet__circle" onClick={() => setStep(step - 1)} aria-label="Go back">
                  <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M10 3l-5 5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ) : <span className="mood-sheet__circle mood-sheet__circle--ghost" aria-hidden="true" />}

              <span className="mood-sheet__bar-title">Daily check-in</span>

              <button type="button" className="mood-sheet__circle" onClick={close} aria-label="Close check-in">
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
                    <h2 className="mood-sheet__headline">Choose how you&rsquo;re feeling right now</h2>

                    <div className="mood-step__stage">
                      <MoodFlower band={band} size={250} />
                    </div>

                    <p className="mood-sheet__verdict" aria-hidden="true">{b.label}</p>

                    <div className="mood-slider">
                      <div
                        ref={(el) => { trackRef.current = el; sliderRef.current = el; }}
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
                        <span>Very Unpleasant</span>
                        <span>Very Pleasant</span>
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
                      <MoodFlower band={band} size={112} breathe={false} />
                      <p className="mood-sheet__verdict mood-sheet__verdict--sm">{b.label}</p>
                    </div>

                    <h3 className="mood-sheet__question">What best describes this feeling?</h3>
                    <div className="mood-chips" role="group" aria-label={`Words for ${b.label}`}>
                      {WORD_BANDS[String(band)].map((w) => (
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
                      <MoodFlower band={band} size={112} breathe={false} />
                      <p className="mood-sheet__verdict mood-sheet__verdict--sm">{word || b.label}</p>
                    </div>

                    <h3 className="mood-sheet__question">What&rsquo;s having the biggest impact on you?</h3>
                    {FACTOR_GROUPS.map((group, gi) => (
                      <div className="mood-chips" key={gi} role="group" aria-label={`Factor group ${gi + 1}`}>
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
                    <p className="mood-sheet__optional">Optional — skip if nothing stands out.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <footer className="mood-sheet__foot">
              <motion.button
                type="button"
                className="mood-sheet__cta"
                onClick={() => (step === 2 ? finish() : setStep(step + 1))}
                disabled={step === 1 && !word}
                animate={{ backgroundColor: b.btn }}
                transition={{ duration: reduce ? 0 : 0.5, ease: EXPO }}
              >
                {step === 2 ? 'Done' : 'Next'}
              </motion.button>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
