import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion';
import MoodFlower from './MoodFlower';
import { visualAt, labelAt, clampBand } from '../lib/moodScale';
import {
  orderedWords, orderedFactorGroups, cleanCustom, loadUsage, refreshMoodVocabulary,
  CUSTOM_MAX_LENGTH,
} from '../lib/moodVocabulary';
import { useBodyOverlay } from '../lib/useBodyOverlay';
import { tap, confirm } from '../lib/haptics';
import { IconClose, IconPlus } from '../icons.jsx';

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
const SPRING = { stiffness: 240, damping: 28, mass: 0.9 };
const ORDER = [-3, -2, -1, 0, 1, 2, 3];

/**
 * How finely she can place herself.
 *
 * The scale still runs −3…3 and still resolves to the same seven named states
 * — that vocabulary is shared with the chart, the doctor's chart and the
 * insight engine, and it is the part that means something. What changed is the
 * grain underneath it: 0.25 gives twenty-five places to stand instead of
 * seven, so "not quite unpleasant, but heading that way" is somewhere she can
 * actually put her thumb rather than a rounding decision the app makes for
 * her. Both the exact position and the band it rounds to are stored.
 */
const STEP = 0.25;   // twenty-five stops across the scale

const snap = (v) => Math.round(clampBand(v) / STEP) * STEP;

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

/**
 * A chip that becomes a text field.
 *
 * Kept as a chip rather than a button below the list, because what she is
 * doing is picking a word — it belongs in the row of words, in the same shape
 * as the others, not in a separate "advanced" affordance underneath them.
 */
function CustomChip({ open, label, placeholder, draft, onDraft, onOpen, onCommit, onCancel }) {
  if (!open) {
    return (
      <button type="button" className="mood-chip mood-chip--add" onClick={onOpen}>
        <IconPlus size={14} /> {label}
      </button>
    );
  }
  return (
    <input
      autoFocus
      className="mood-chip mood-chip--field"
      value={draft}
      placeholder={placeholder}
      maxLength={CUSTOM_MAX_LENGTH}
      aria-label={placeholder}
      onChange={(e) => onDraft(e.target.value)}
      onBlur={onCommit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); onCommit(); }
        if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
      }}
    />
  );
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
  const [value, setValue] = useState(0); // continuous, −3…3
  const [word, setWord] = useState(null);
  const [factors, setFactors] = useState([]);
  const [usage, setUsage] = useState({ words: {}, factors: {} });
  // Written this session and not yet saved, so a new word stays on screen as a
  // chip the moment she adds it rather than after a round trip.
  const [minted, setMinted] = useState([]);
  const [writing, setWriting] = useState(null);   // 'word' | 'factor' | null
  const [draft, setDraft] = useState('');

  const trackRef = useRef(null);

  // One spring behind the whole field. The bloom, the wash, the thumb and the
  // button all read it, so the surface moves as one object under her thumb
  // instead of four things each running their own half-second tween.
  const raw = useMotionValue(0);
  const springed = useSpring(raw, SPRING);
  const live = reduce ? raw : springed;
  useEffect(() => { raw.set(value); }, [value, raw]);

  const fieldBg = useTransform(live, (v) => {
    const c = visualAt(v);
    return `linear-gradient(178deg, ${c.wash2} 0%, ${c.wash} 62%, ${c.wash} 100%)`;
  });
  const inkColor = useTransform(live, (v) => visualAt(v).ink);
  const ctaBg = useTransform(live, (v) => visualAt(v).btn);
  const thumbLeft = useTransform(live, (v) => `${((clampBand(v) + 3) / 6) * 100}%`);

  useBodyOverlay(open);

  // Every open starts clean unless it's editing something that already exists.
  // Adjusted during render rather than in an effect, so the first frame of the
  // sheet is already the reset one — an effect would paint the previous
  // session's answers for a frame before clearing them.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      const start = snap(initial?.intensity ?? initial?.valence ?? 0);
      setStep(0);
      setValue(start);
      // Both, not just the source: a spring *told* to move would travel there.
      // Reopening an entry should show where she left it, already arrived.
      raw.jump(start);
      springed.jump(start);
      setWord(initial?.word ?? null);
      setFactors(initial?.factors ?? []);
      setMinted([]);
      setWriting(null);
      setDraft('');
    }
  }

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    loadUsage().then((u) => { if (!cancelled) setUsage(u); });
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // The band is what gets named, stored and reasoned about; the value is where
  // she actually put her thumb.
  const band = Math.round(clampBand(value));
  const tone = visualAt(value);
  const label = labelAt(value);
  const words = orderedWords(band, { pregnancyMode, usage: usage.words });
  const factorGroups = orderedFactorGroups({
    pregnancyMode, usage: usage.factors, extra: minted,
  });

  const isDay = scope === 'day';
  const title = isDay ? 'How today felt' : 'Right now';
  const headline = isDay
    ? 'Taking today as a whole, how did it feel?'
    : 'Choose how you’re feeling right now';

  /**
   * Moves to a new position, and buzzes only when the *named* state changes.
   *
   * A tick on all twenty-five stops would turn one slow drag into a burr of
   * twenty-five vibrations. Firing on band boundaries instead makes the haptic
   * mean something — it is the moment the word under her thumb changes.
   */
  function moveTo(next) {
    const v = snap(next);
    if (v === value) return;
    if (Math.round(v) !== Math.round(value)) tap();
    setValue(v);
  }

  function setFromPointer(clientX) {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const frac = rect.width ? (clientX - rect.left) / rect.width : 0.5;
    moveTo(-3 + Math.min(1, Math.max(0, frac)) * 6);
  }

  function onKeyDown(e) {
    // Arrow nudges one fine step; shift or page jumps a whole named state, so
    // a keyboard user is not made to press right twenty-four times.
    const jump = e.shiftKey ? 1 : STEP;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); moveTo(value + jump); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); moveTo(value - jump); }
    else if (e.key === 'PageUp') { e.preventDefault(); moveTo(Math.floor(value + 1)); }
    else if (e.key === 'PageDown') { e.preventDefault(); moveTo(Math.ceil(value - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); moveTo(-3); }
    else if (e.key === 'End') { e.preventDefault(); moveTo(3); }
  }

  /**
   * Commits a word or a reason she wrote herself.
   *
   * It is selected immediately, because someone who has just typed "Homesick"
   * has already answered the question — making her tap the chip she just made
   * would be asking twice.
   */
  function commitCustom() {
    const value = cleanCustom(draft);
    if (!value) { setWriting(null); setDraft(''); return; }
    confirm();
    if (writing === 'word') {
      setWord(value);
    } else {
      setMinted((prev) => (prev.includes(value) ? prev : [...prev, value]));
      setFactors((prev) => (prev.includes(value) ? prev : [...prev, value]));
    }
    setWriting(null);
    setDraft('');
  }

  function toggleFactor(f) {
    tap();
    setFactors((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  }

  function finish() {
    confirm();
    // `valence` stays the integer band every other reader already speaks;
    // `intensity` carries the exact place she chose, so reopening this entry
    // returns her thumb to where she left it.
    // Next open should already know about the word she just chose.
    refreshMoodVocabulary();
    onSave({ valence: band, intensity: value, word, factors, scope });
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
            style={{ color: inkColor }}
          >
            <motion.div
              className="mood-sheet__field"
              aria-hidden="true"
              style={{ background: fieldBg }}
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
                      <MoodFlower band={value} size={bloomSize} />
                    </div>

                    <p className="mood-sheet__verdict" aria-hidden="true">{label}</p>

                    <div className="mood-slider">
                      <div
                        ref={trackRef}
                        className="mood-slider__track"
                        role="slider"
                        tabIndex={0}
                        aria-label="How you're feeling"
                        aria-valuemin={-3}
                        aria-valuemax={3}
                        aria-valuenow={value}
                        aria-valuetext={label}
                        onKeyDown={onKeyDown}
                        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setFromPointer(e.clientX); }}
                        onPointerMove={(e) => { if (e.buttons) setFromPointer(e.clientX); }}
                      >
                        <span className="mood-slider__rail" aria-hidden="true">
                          {/* Seven faint notches. The travel between them is
                              continuous, but the named states are still findable
                              by feel — without them a smooth rail hides the fact
                              that "Pleasant" has a place on it. */}
                          {ORDER.map((o) => (
                            <span
                              key={o}
                              className={`mood-slider__notch${o === band ? ' mood-slider__notch--on' : ''}`}
                              style={{ left: `${((o + 3) / 6) * 100}%` }}
                            />
                          ))}
                          <motion.span
                            className="mood-slider__thumb"
                            style={{ left: thumbLeft }}
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
                      <MoodFlower band={value} size={Math.min(112, bloomSize)} breathe={false} />
                      <p className="mood-sheet__verdict mood-sheet__verdict--sm">{label}</p>
                    </div>

                    <h3 className="mood-sheet__question">Which word fits it best?</h3>
                    <div className="mood-chips" role="group" aria-label={`Words for ${label}`}>
                      {/* Her own words lead. Anything she has written before is
                          simply a word she has used, so it arrives here with
                          the rest of them and needs no special case. */}
                      {words.map((w) => (
                        <button
                          key={w}
                          type="button"
                          className={`mood-chip${word === w ? ' mood-chip--on' : ''}`}
                          aria-pressed={word === w}
                          onClick={() => { tap(); setWord(w); }}
                          style={word === w ? { background: tone.btn, borderColor: tone.btn } : undefined}
                        >
                          {w}
                        </button>
                      ))}
                      {word && !words.includes(word) && (
                        <button
                          type="button"
                          className="mood-chip mood-chip--on"
                          aria-pressed="true"
                          onClick={() => { tap(); setWord(null); }}
                          style={{ background: tone.btn, borderColor: tone.btn }}
                        >
                          {word}
                        </button>
                      )}
                      <CustomChip
                        open={writing === 'word'}
                        label="Another word"
                        placeholder="In your own words"
                        draft={draft}
                        onDraft={setDraft}
                        onOpen={() => { tap(); setDraft(''); setWriting('word'); }}
                        onCommit={commitCustom}
                        onCancel={() => { setWriting(null); setDraft(''); }}
                      />
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
                      <MoodFlower band={value} size={Math.min(112, bloomSize)} breathe={false} />
                      <p className="mood-sheet__verdict mood-sheet__verdict--sm">{word || label}</p>
                    </div>

                    <h3 className="mood-sheet__question">What&rsquo;s behind it?</h3>
                    {/* Labelled now that there are thirty-three. Four short
                        headed lists scan; one wall of chips does not. */}
                    {factorGroups.map((group) => (
                      <div className="mood-group" key={group.label}>
                        <p className="mood-group__label" id={`mg-${group.label}`}>{group.label}</p>
                        <div className="mood-chips" role="group" aria-labelledby={`mg-${group.label}`}>
                          {group.items.map((f) => {
                            const on = factors.includes(f);
                            return (
                              <button
                                key={f}
                                type="button"
                                className={`mood-chip${on ? ' mood-chip--on' : ''}`}
                                aria-pressed={on}
                                onClick={() => toggleFactor(f)}
                                style={on ? { background: tone.btn, borderColor: tone.btn } : undefined}
                              >
                                {f}
                              </button>
                            );
                          })}
                          {group.label === 'Yours' && (
                            <CustomChip
                              open={writing === 'factor'}
                              label="Add one"
                              placeholder="Something else"
                              draft={draft}
                              onDraft={setDraft}
                              onOpen={() => { tap(); setDraft(''); setWriting('factor'); }}
                              onCommit={commitCustom}
                              onCancel={() => { setWriting(null); setDraft(''); }}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                    {!factorGroups.some((g) => g.label === 'Yours') && (
                      <div className="mood-chips">
                        <CustomChip
                          open={writing === 'factor'}
                          label="Something else"
                          placeholder="Something else"
                          draft={draft}
                          onDraft={setDraft}
                          onOpen={() => { tap(); setDraft(''); setWriting('factor'); }}
                          onCommit={commitCustom}
                          onCancel={() => { setWriting(null); setDraft(''); }}
                        />
                      </div>
                    )}
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
                style={{ backgroundColor: ctaBg }}
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
