import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate, useReducedMotion } from 'framer-motion';
import { useApp, usePregnancyData } from '../context/AppContext';
import { useToast } from './Toast';
import { tap, confirm } from '../lib/haptics';

/**
 * Daily pregnancy mood check-in — Amruni's own take on the Apple Health
 * "State of Mind" mechanic: drag a valence slider, then pick the word that
 * fits. The live feedback during the drag is a small camellia bud built from
 * the same petal generator as PregnancyBloom — closed and cool-toned at the
 * unpleasant end, open and warm gold at the pleasant end — rather than
 * Apple's blob. Shows once a day on Home, then fades itself out on submit.
 */

const EXPO = [0.16, 1, 0.3, 1];

// One camellia petal (teardrop pointing up from the origin) — same generator
// convention as PregnancyBloom's petalPath, rebuilt locally at a smaller scale
// for this in-card element.
function petalPath(len, w) {
  return `M0 0 C ${-w / 2} ${-len * 0.35}, ${-w / 2} ${-len * 0.82}, 0 ${-len} C ${w / 2} ${-len * 0.82}, ${w / 2} ${-len * 0.35}, 0 0 Z`;
}

const BUD_PETALS = Array.from({ length: 5 }, (_, i) => ({ angle: i * 72, len: 20, w: 13 }));

// Purple/cool → blue/neutral → warm gold, muted and dignified rather than
// saturated — three anchor stops the live drag position interpolates across.
const MOOD_HUES = {
  wash: ['#59507c', '#7c8ca8', '#c9a868'],
  fill: ['#8b7fa8', '#a7b6c8', '#dcc08c'],
  stroke: ['#453c61', '#5c6c84', '#a3823f'],
};

const WORD_BANDS = {
  '-3': { label: 'Very Unpleasant', words: ['Anxious about baby', 'Overwhelmed', 'Exhausted', 'Nauseous', 'Scared'] },
  '-2': { label: 'Unpleasant', words: ['Uncomfortable', 'Irritable', 'Drained', 'Achy', 'Worried'] },
  '-1': { label: 'Slightly Unpleasant', words: ['Restless', 'Tired', 'Uneasy', 'Sensitive', 'Low'] },
  '0': { label: 'Neutral', words: ['Calm', 'Steady', 'Quiet', 'Reflective', 'Unsure'] },
  '1': { label: 'Slightly Pleasant', words: ['Content', 'Hopeful', 'Relieved', 'Comfortable', 'Grateful'] },
  '2': { label: 'Pleasant', words: ['Peaceful', 'Joyful', 'Connected', 'Energised', 'Glowing'] },
  '3': { label: 'Very Pleasant', words: ['Radiant', 'Elated', 'Blessed', 'Amazed', 'Overjoyed'] },
};

function valenceFromT(v) {
  return Math.max(-3, Math.min(3, Math.round(v * 6) - 3));
}
function tFromValence(value) {
  return (value + 3) / 6;
}

function BackChevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function PregnancyMoodCheckIn() {
  const { state, dispatch } = useApp();
  const pregnancyData = usePregnancyData(state);
  const toast = useToast();
  const reduce = useReducedMotion();

  const today = new Date().toISOString().split('T')[0];
  const alreadyLogged = !!state.pregnancy?.loggedDays?.[today]?.mood;
  const gating = Boolean(state.settings?.pregnancyMode) && Boolean(pregnancyData?.known) && !alreadyLogged;

  const [dismissed, setDismissed] = useState(false);
  const [phase, setPhase] = useState('slider'); // 'slider' | 'words'
  const [selectedBand, setSelectedBand] = useState(0);
  const [liveBand, setLiveBand] = useState(0);

  const trackRef = useRef(null);
  const firstWordRef = useRef(null);
  const pendingValenceRef = useRef(0);

  const t = useMotionValue(0.5); // 0 = very unpleasant, 1 = very pleasant

  const thumbLeft = useTransform(t, (v) => `${v * 100}%`);
  const washColor = useTransform(t, [0, 0.5, 1], MOOD_HUES.wash);
  const petalFill = useTransform(t, [0, 0.5, 1], MOOD_HUES.fill);
  const petalStroke = useTransform(t, [0, 0.5, 1], MOOD_HUES.stroke);
  const budScale = useTransform(t, [0, 1], [0.82, 1.06]);
  const petalSpread = useTransform(t, [0, 1], [0.55, 1]);
  const budSwirl = useTransform(t, [0, 1], [-12, 0]);

  // Keep the accessible value + the pending commit target in sync with the
  // live drag/keyboard position, without forcing a re-render on every pixel.
  useEffect(() => {
    const unsubscribe = t.on('change', (v) => {
      const band = valenceFromT(v);
      pendingValenceRef.current = band;
      setLiveBand((prev) => (prev === band ? prev : band));
    });
    return unsubscribe;
  }, [t]);

  useEffect(() => {
    if (phase === 'words') firstWordRef.current?.focus();
  }, [phase]);

  if (!gating && !dismissed) return null;

  function updateFromClientX(clientX) {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const frac = rect.width ? (clientX - rect.left) / rect.width : 0.5;
    t.set(Math.min(1, Math.max(0, frac)));
  }

  function handlePanStart(_event, info) {
    updateFromClientX(info.point.x);
  }
  function handlePan(_event, info) {
    updateFromClientX(info.point.x);
  }

  function stepTo(value) {
    pendingValenceRef.current = value;
    const target = tFromValence(value);
    if (reduce) t.set(target);
    else animate(t, target, { duration: 0.22, ease: EXPO });
  }

  function commit() {
    const band = pendingValenceRef.current;
    const target = tFromValence(band);
    if (reduce) t.set(target);
    else animate(t, target, { duration: 0.35, ease: EXPO });
    setSelectedBand(band);
    setPhase('words');
  }

  function handleKeyDown(event) {
    const current = valenceFromT(t.get());
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      stepTo(Math.min(3, current + 1));
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      stepTo(Math.max(-3, current - 1));
    } else if (event.key === 'Home') {
      event.preventDefault();
      stepTo(-3);
    } else if (event.key === 'End') {
      event.preventDefault();
      stepTo(3);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      commit();
    }
  }

  function handleBack() {
    setPhase('slider');
  }

  function handleSelectWord(word) {
    tap();
    dispatch({ type: 'LOG_PREGNANCY_DAY', date: today, data: { mood: word, valence: selectedBand } });
    confirm();
    toast('Logged. Thank you for sharing.', { icon: 'heart' });
    setDismissed(true);
  }

  const visible = gating && !dismissed;
  const bandInfo = WORD_BANDS[String(selectedBand)];
  const liveLabel = WORD_BANDS[String(liveBand)].label;

  return (
    <div className="preg-tint">
      <AnimatePresence>
        {visible && (
          <motion.div
            key="mood-checkin"
            className="mood-checkin"
            role="group"
            aria-label="Daily mood check-in"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: reduce ? 0.18 : 0.46, ease: EXPO }}
          >
            <motion.div className="mood-checkin__wash" aria-hidden="true" style={{ backgroundColor: washColor }} />

            <div className="mood-checkin__content">
              <AnimatePresence mode="wait">
                {phase === 'slider' ? (
                  <motion.div
                    key="step-slider"
                    initial={reduce ? { opacity: 0 } : { opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, x: -12 }}
                    transition={{ duration: reduce ? 0.15 : 0.32, ease: EXPO }}
                  >
                    <p className="mood-checkin__eyebrow">Daily check-in</p>
                    <h2 className="mood-checkin__title">How are you feeling today?</h2>

                    <div className="mood-checkin__stage">
                      <p className="mood-checkin__live-label" aria-hidden="true">{liveLabel}</p>

                      <motion.div
                        ref={trackRef}
                        className="mood-checkin__track"
                        role="slider"
                        tabIndex={0}
                        aria-label="Today's mood"
                        aria-valuemin={-3}
                        aria-valuemax={3}
                        aria-valuenow={liveBand}
                        aria-valuetext={liveLabel}
                        aria-describedby="mood-checkin-hint"
                        onPanStart={handlePanStart}
                        onPan={handlePan}
                        onPanEnd={commit}
                        onKeyDown={handleKeyDown}
                        style={{ touchAction: 'none' }}
                      >
                        <div className="mood-checkin__track-fill" aria-hidden="true" />
                        <motion.div
                          className="mood-checkin__bud"
                          aria-hidden="true"
                          style={{ left: thumbLeft, scale: reduce ? 1 : budScale, rotate: reduce ? 0 : budSwirl }}
                        >
                          <svg viewBox="-30 -30 60 60" width="44" height="44">
                            {BUD_PETALS.map((p) => (
                              <g key={p.angle} transform={`rotate(${p.angle})`}>
                                <motion.path
                                  d={petalPath(p.len, p.w)}
                                  strokeWidth="1.2"
                                  style={{
                                    fill: petalFill,
                                    stroke: petalStroke,
                                    scale: reduce ? 0.85 : petalSpread,
                                    transformBox: 'fill-box',
                                    transformOrigin: '50% 100%',
                                  }}
                                />
                              </g>
                            ))}
                            <motion.circle cx="0" cy="0" r="4" style={{ fill: petalStroke }} />
                          </svg>
                        </motion.div>
                      </motion.div>

                      <p id="mood-checkin-hint" className="mood-checkin__hint">
                        Drag to choose, or use the arrow keys — then press Enter.
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="step-words"
                    initial={reduce ? { opacity: 0 } : { opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, x: -12 }}
                    transition={{ duration: reduce ? 0.15 : 0.32, ease: EXPO }}
                  >
                    <button type="button" className="mood-checkin__back" onClick={handleBack} aria-label="Change your mood">
                      <BackChevron />
                      Change
                    </button>
                    <p className="mood-checkin__eyebrow">{bandInfo.label}</p>
                    <h2 className="mood-checkin__title">What&rsquo;s behind it?</h2>
                    <p className="mood-checkin__hint" style={{ textAlign: 'left', marginTop: 2 }}>
                      Choose the word that feels closest.
                    </p>

                    <div className="mood-checkin__word-grid" role="group" aria-label={`Words for ${bandInfo.label}`}>
                      {bandInfo.words.map((word, i) => (
                        <button
                          key={word}
                          type="button"
                          ref={i === 0 ? firstWordRef : undefined}
                          className="mood-checkin__word"
                          onClick={() => handleSelectWord(word)}
                        >
                          {word}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
