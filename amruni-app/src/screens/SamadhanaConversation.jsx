import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup, useReducedMotion } from 'framer-motion';
import { COUNSELLING, SRQ20, srqResult, SRQ_BANDS } from '../data/counselling';
import { intakeApi } from '../services/intakeApi';
import { appointmentApi } from '../services/appointmentApi';
import { apiError } from '../services/api';
import { useToast } from '../components/Toast';
import BottomSheet from '../components/BottomSheet';
import { IconPhone, IconLock } from '../icons.jsx';
import { tap, confirm as confirmHaptic } from '../lib/haptics';

/**
 * The Samadhana Center intake, as a conversation.
 *
 * The paper version is two sides of A4 handed across a desk to someone who is
 * already having a hard week. The same questions asked one at a time, in the
 * rhythm of someone talking to her, are a different experience of identical
 * content — which is the only kind of redesign a validated questionnaire
 * allows. Nothing is reworded here: every question comes from data/counselling.js
 * exactly as it is there, and the SRQ-20 keeps its order.
 *
 * ── How the thread is built ─────────────────────────────────────────────
 *
 * There is no message list in state. The thread is DERIVED on every render
 * from a fixed script and her answers: walk the script, render everything up
 * to the first question she has not answered, stop. That one decision makes
 * three hard things free —
 *
 *   · changing an earlier answer re-derives the thread, so "Do you have a
 *     physical illness? → No" makes the "If yes, what?" question disappear
 *     without any bookkeeping;
 *   · resuming a draft is just loading answers;
 *   · the item-17 support card appears because a condition became true, not
 *     because an event handler remembered to push it.
 *
 * ── The motion, and why only this ───────────────────────────────────────
 *
 * Two moments carry it. A counsellor message arrives as a typing bubble that
 * grows into the message (a shared layoutId), so the pause reads as someone
 * composing a reply rather than a spinner. Her answer is the chip she tapped
 * travelling up into the thread and becoming her bubble (the same trick in
 * reverse), so cause and effect are one continuous object. Everything else is
 * still. On a questionnaire that asks about suicidal thoughts, delight is
 * calm and responsiveness — never celebration.
 *
 * Reduced motion removes the typing delay and every travel, and keeps the
 * conversation intact.
 */

const SAMADHANA_NAME = 'Samadhana Center';
const DRAFT_KEY = 'amruni_samadhana_draft';
const YES = { kn: 'ಹೌದು', en: 'Yes' };
const NO = { kn: 'ಇಲ್ಲ', en: 'No' };

/** Follow-up questions that only make sense after a particular answer. */
const SHOW_IF = {
  physicalWhat: (a) => a.physicalIllness === true,
  earlierWhere: (a) => a.earlierConsult === true,
  earlierMedicines: (a) => a.earlierConsult === true,
};

const SRQ_IDS = new Set(SRQ20.map((i) => i.id));
const isPrivate = (id) => id.startsWith('_');

/**
 * The conversation, as data. `say` is the counsellor speaking, `ask` is a
 * question from the form, `care` is a message that appears only when its
 * condition holds.
 */
function buildScript() {
  const script = [
    { type: 'say', id: 'hello', text: 'Namaskara. This is Samadhana Center.', kn: 'ನಮಸ್ಕಾರ. ಇದು ಸಮಾಧಾನ ಆಪ್ತ ಸಲಹಾ ಕೇಂದ್ರ.' },
    { type: 'say', id: 'why', text: 'Before you meet a counsellor, I’ll ask a little about what has been happening, and then twenty short yes-or-no questions. It takes about ten minutes.' },
    { type: 'say', id: 'private', text: 'Only your counsellor reads this. Anything marked optional, you can skip.', lock: true },
    { type: 'ask', id: '_begin', field: { id: '_begin', kind: 'ack', label: 'Ready when you are.', action: 'I’m ready', actionKn: 'ನಾನು ಸಿದ್ಧ' } },
  ];

  for (const section of COUNSELLING.sections) {
    if (section.id === 'srq') {
      script.push(
        { type: 'say', id: 'srq-in', text: 'Thank you. Now twenty short questions. Answer yes or no, thinking about the last month.', kn: 'ಗಮನವಿಟ್ಟು ಓದಿ, ನಂತರ ಹೌದು ಅಥವಾ ಇಲ್ಲ ಗುರುತು ಹಾಕಿ.' },
        { type: 'say', id: 'srq-safe', text: 'There are no right or wrong answers, and these are not saved on this phone until you send them.', lock: true },
      );
      for (const field of section.fields) {
        script.push({ type: 'ask', id: field.id, field, srq: true });
        if (field.id === 'srq17') script.push({ type: 'care', id: 'care17', when: (a) => a.srq17 === true });
      }
      continue;
    }
    if (section.note) script.push({ type: 'say', id: `${section.id}-note`, text: section.note });
    for (const field of section.fields) script.push({ type: 'ask', id: field.id, field });
  }

  script.push({ type: 'say', id: 'end', text: 'That’s everything. Thank you for telling me all of this — it is not easy.' });
  script.push({ type: 'ask', id: '_send', field: { id: '_send', kind: 'send', label: 'Send your answers to Samadhana Center?' } });
  return script;
}

const SCRIPT = buildScript();
const ASKS = SCRIPT.filter((s) => s.type === 'ask' && !isPrivate(s.id));
const CASE_ASKS = ASKS.filter((s) => !s.srq);

function readDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : { answers: {}, skipped: [] };
  } catch {
    return { answers: {}, skipped: [] };
  }
}

function answered(answers, skipped, id) {
  return Object.prototype.hasOwnProperty.call(answers, id) || skipped.includes(id);
}

function formatAnswer(field, value) {
  if (field.kind === 'bool') return value ? `${YES.en} · ${YES.kn}` : `${NO.en} · ${NO.kn}`;
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

/** Walk the script up to the first unanswered question. */
function deriveThread(answers, skipped) {
  const items = [];
  let current = null;
  for (const step of SCRIPT) {
    if (step.type === 'ask') {
      if (SHOW_IF[step.id] && !SHOW_IF[step.id](answers)) continue;
      items.push(step);
      if (!answered(answers, skipped, step.id)) { current = step; break; }
    } else if (step.type === 'care') {
      if (step.when(answers)) items.push(step);
    } else {
      items.push(step);
    }
  }
  return { items, current };
}

function typingDelay(text = '') {
  return Math.min(1100, Math.max(420, 300 + text.length * 11));
}

export default function SamadhanaConversation() {
  const navigate = useNavigate();
  const toast = useToast();
  const reduce = useReducedMotion();

  const [initial] = useState(readDraft);
  const [answers, setAnswers] = useState(initial.answers);
  const [skipped, setSkipped] = useState(initial.skipped);
  const [resumed] = useState(() => Object.keys(initial.answers).some((k) => !isPrivate(k)));
  /**
   * Which counsellor messages have already been "typed". Tracked by id, not
   * by count: after she changes an earlier answer the thread re-derives, and
   * every message she has already read must reappear instantly rather than
   * replaying thirty typing pauses back to where she was.
   */
  const [seen, setSeen] = useState(() => (
    resumed ? new Set(deriveThread(initial.answers, initial.skipped).items.map((s) => s.id)) : new Set()
  ));
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [samadhana, setSamadhana] = useState(null);

  const threadRef = useRef(null);

  useEffect(() => {
    appointmentApi.getDoctors()
      .then((docs) => setSamadhana(docs.find((d) => d.name === SAMADHANA_NAME) ?? null))
      .catch(() => {});
  }, []);

  // The draft keeps her case history across an interruption, and never the
  // twenty questions — the same rule as `sensitive` sections in useIntakeForm.
  useEffect(() => {
    if (sent) return;
    try {
      const keep = Object.fromEntries(Object.entries(answers).filter(([k]) => !SRQ_IDS.has(k)));
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ answers: keep, skipped: skipped.filter((s) => !SRQ_IDS.has(s)) }));
    } catch { /* private mode: the conversation still works, it just won't resume */ }
  }, [answers, skipped, sent]);

  // ── derive the thread ───────────────────────────────────────────
  const { items, current } = useMemo(() => deriveThread(answers, skipped), [answers, skipped]);

  // Everything before the first unseen message is on screen; that message is
  // the one being typed; nothing after it shows yet.
  const firstUnseen = items.findIndex((s) => !seen.has(s.id));
  const visible = firstUnseen === -1 ? items.length : firstUnseen;
  const typing = !sent && visible < items.length;
  const nextStep = typing ? items[visible] : null;

  useEffect(() => {
    if (!nextStep) return undefined;
    const reveal = () => setSeen((prev) => new Set(prev).add(nextStep.id));
    if (reduce) { reveal(); return undefined; }
    const text = nextStep.type === 'ask' ? nextStep.field.label : nextStep.type === 'care' ? 'x'.repeat(90) : nextStep.text;
    const timer = setTimeout(reveal, typingDelay(text));
    return () => clearTimeout(timer);
  }, [nextStep, reduce]);

  // Keep the newest message in view.
  useLayoutEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: reduce ? 'auto' : 'smooth' });
  }, [visible, typing, sent, reduce]);

  function answer(id, value) {
    if (id === '_send') { send(); return; }
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setSkipped((prev) => prev.filter((s) => s !== id));
    if (id === 'srq17' && value === true) confirmHaptic(); else tap();
  }

  function skip(id) {
    tap();
    setSkipped((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setAnswers((prev) => { const n = { ...prev }; delete n[id]; return n; });
  }

  async function send() {
    setSubmitting(true);
    // Only questions still in the conversation go. A follow-up to an answer
    // she later changed ("If yes, what?" after switching to No) is dropped.
    const live = new Set(ASKS.filter((s) => !SHOW_IF[s.id] || SHOW_IF[s.id](answers)).map((s) => s.id));
    const payload = Object.fromEntries(Object.entries(answers).filter(([k]) => live.has(k)));
    try {
      await intakeApi.submit({ formId: 'counselling', answers: payload, skippedSections: [] });
      confirmHaptic();
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* nothing to clear */ }
      setSent(true);
    } catch (err) {
      toast(apiError(err, 'That didn’t send. Your answers are still here — try again.'), { icon: 'warning' });
    } finally {
      setSubmitting(false);
    }
  }

  // ── progress ────────────────────────────────────────────────────
  const caseDone = CASE_ASKS.filter((s) => answered(answers, skipped, s.id)).length;
  const srqDone = SRQ20.filter((i) => answered(answers, skipped, i.id)).length;
  const inSrq = current?.srq || (caseDone === CASE_ASKS.length && srqDone > 0) || current?.id === '_send' || sent;
  const progress = sent ? 1 : (caseDone + srqDone) / (CASE_ASKS.length + SRQ20.length);

  const result = sent ? srqResult(answers) : null;
  const editField = editing ? ASKS.find((s) => s.id === editing)?.field : null;

  return (
    <div className="sam" data-part={inSrq ? 'two' : 'one'}>
      <header className="sam-head">
        <button className="sam-head__back" onClick={() => navigate(-1)} aria-label="Leave the conversation">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <SamadhanaMark />
        <div className="sam-head__who">
          <p className="sam-head__name">Samadhana Center</p>
          <p className="sam-head__status">
            {sent ? 'Answers received' : typing ? 'typing…' : inSrq ? `Twenty questions · ${srqDone} of 20` : 'Counselling intake'}
          </p>
        </div>
        <div
          className="sam-progress"
          role="progressbar"
          aria-label="Progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <span style={{ transform: `scaleX(${progress})` }} />
        </div>
      </header>

      <LayoutGroup>
        <div className="sam-thread" ref={threadRef} role="log" aria-live="polite" aria-relevant="additions">
          <p className="sam-day">Today · ಇಂದು</p>
          {resumed && <p className="sam-day">Picking up where you left off</p>}

          {items.map((step, i) => {
            if (i > visible) return null;
            if (i === visible) return typing ? <TypingBubble key={`typing-${step.id}`} stepId={step.id} reduce={reduce} /> : null;

            const hasAnswer = step.type === 'ask' && answered(answers, skipped, step.id);
            return (
              <div key={step.id} className="sam-turn">
                <CounsellorBubble step={step} reduce={reduce} />
                {hasAnswer && !isPrivate(step.id) && (
                  <ReplyBubble
                    field={step.field}
                    value={answers[step.id]}
                    skipped={skipped.includes(step.id)}
                    onEdit={sent ? null : () => { tap(); setEditing(step.id); }}
                  />
                )}
                {hasAnswer && step.id === '_begin' && (
                  <ReplyBubble field={step.field} value="I’m ready" plain />
                )}
              </div>
            );
          })}

          {sent && <SentPanel result={result} samadhana={samadhana} onBook={() => samadhana && navigate(`/appointment/${samadhana.id}`)} />}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {!sent && current && !typing && (
            <motion.div
              key={current.id}
              className="sam-composer"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, transition: { duration: 0.12 } }}
              transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            >
              <Composer
                field={current.field}
                value={answers[current.id]}
                busy={submitting}
                onAnswer={(v) => answer(current.id, v)}
                onSkip={current.field.optional ? () => skip(current.id) : null}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </LayoutGroup>

      <BottomSheet open={!!editField} onClose={() => setEditing(null)} title="Change your answer">
        {editField && (
          <div className="sam-edit">
            <p className="sam-edit__q">{editField.label}</p>
            {editField.sub && <p className="sam-edit__kn" lang="kn">{editField.sub}</p>}
            <Composer
              field={editField}
              value={answers[editField.id]}
              morph={false}
              onAnswer={(v) => { setAnswers((p) => ({ ...p, [editField.id]: v })); setSkipped((p) => p.filter((s) => s !== editField.id)); setEditing(null); tap(); }}
              onSkip={editField.optional ? () => { skip(editField.id); setEditing(null); } : null}
            />
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

/* ── pieces ─────────────────────────────────────────────────────────── */

function SamadhanaMark() {
  return (
    <span className="sam-mark" aria-hidden="true">
      <span lang="kn">ಸ</span>
    </span>
  );
}

const ARRIVE = { type: 'spring', stiffness: 420, damping: 34, mass: 0.8 };

function TypingBubble({ reduce, stepId }) {
  return (
    <motion.div
      layoutId={reduce ? undefined : `sam-msg-${stepId}`}
      className="sam-bubble sam-bubble--them sam-bubble--typing"
      aria-label="Samadhana is typing"
      role="status"
      initial={reduce ? false : { opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={ARRIVE}
    >
      <span /><span /><span />
    </motion.div>
  );
}

function CounsellorBubble({ step, reduce }) {
  // Each message owns a layoutId unique to it, and the typing bubble borrows
  // that same id while it waits — so the dots grow into exactly this message.
  // An id SHARED across messages looks equivalent and is not: the motion
  // library treats every holder of one id as the same element and hides all
  // but the newest, which blanked every earlier message in the thread.
  const motionProps = reduce
    ? {}
    : { layoutId: `sam-msg-${step.id}`, transition: { layout: ARRIVE } };

  if (step.type === 'care') {
    return (
      <motion.div {...motionProps} className="sam-bubble sam-bubble--them sam-bubble--care">
        <p className="sam-care__title">Thank you for telling me.</p>
        <p>
          That is the hardest question to answer honestly. You don’t have to wait for your
          appointment, and you don’t have to be in crisis to talk to someone. There is a person
          there right now.
        </p>
        <a href="tel:14416" className="sam-care__call" onClick={() => tap()}>
          <IconPhone size={17} /> Call Tele-MANAS · 14416
        </a>
        <p className="sam-care__note">Free, 24×7, in Kannada and other languages. We’ll carry on whenever you’re ready.</p>
      </motion.div>
    );
  }

  const text = step.type === 'ask' ? step.field.label : step.text;
  const kn = step.type === 'ask' ? step.field.sub : step.kn;
  const hint = step.type === 'ask' ? step.field.hint : null;

  return (
    <motion.div {...motionProps} className={`sam-bubble sam-bubble--them${step.srq ? ' sam-bubble--srq' : ''}`}>
      {/* The words fade in as the bubble finishes growing. Scaled with it,
          they squash mid-flight; this way the bubble grows and the message
          arrives inside it. */}
      <motion.div
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.22, delay: reduce ? 0 : 0.14, ease: 'easeOut' }}
      >
        {step.srq && <span className="sam-bubble__n">{SRQ20.findIndex((i) => i.id === step.id) + 1} / 20</span>}
        {step.lock && <IconLock size={13} className="sam-bubble__lock" />}
        <p className="sam-bubble__text">{text}</p>
        {kn && <p className="sam-bubble__kn" lang="kn">{kn}</p>}
        {hint && <p className="sam-bubble__hint">{hint}</p>}
      </motion.div>
    </motion.div>
  );
}

function ReplyBubble({ field, value, skipped, onEdit, plain }) {
  const single = field.kind === 'bool' || field.kind === 'choice';
  const layoutId = single && !skipped ? `ans-${field.id}-${String(value)}` : undefined;
  const label = plain ? value : skipped ? 'Skipped' : formatAnswer(field, value);
  const Tag = onEdit ? motion.button : motion.div;
  return (
    <Tag
      layoutId={layoutId}
      type={onEdit ? 'button' : undefined}
      className={`sam-bubble sam-bubble--me${skipped ? ' sam-bubble--skipped' : ''}`}
      onClick={onEdit ?? undefined}
      aria-label={onEdit ? `Your answer: ${label}. Tap to change.` : undefined}
      initial={layoutId ? false : { opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...ARRIVE, layout: ARRIVE }}
    >
      {label}
    </Tag>
  );
}

function Composer({ field, value, onAnswer, onSkip, busy, morph = true }) {
  const [draft, setDraft] = useState(() => (typeof value === 'string' ? value : ''));
  const [picked, setPicked] = useState(() => (Array.isArray(value) ? value : []));
  const inputRef = useRef(null);

  useEffect(() => {
    if ((field.kind === 'text' || field.kind === 'long') && morph) inputRef.current?.focus({ preventScroll: true });
  }, [field.kind, morph]);

  const skipBtn = onSkip && (
    <button type="button" className="sam-skip" onClick={onSkip}>Skip</button>
  );

  if (field.kind === 'ack') {
    return (
      <button type="button" className="sam-primary" onClick={() => onAnswer(true)}>
        {field.action} <span lang="kn">· {field.actionKn}</span>
      </button>
    );
  }

  if (field.kind === 'send') {
    return (
      <div className="sam-send">
        <p className="sam-send__note"><IconLock size={13} /> Encrypted before it’s stored. Only your counsellor reads it.</p>
        <button type="button" className="sam-primary" onClick={() => onAnswer(true)} disabled={busy}>
          {busy ? 'Sending…' : 'Send to Samadhana Center'}
        </button>
      </div>
    );
  }

  if (field.kind === 'bool') {
    return (
      <div className="sam-bool">
        {[[true, YES], [false, NO]].map(([v, l]) => (
          <motion.button
            key={String(v)}
            layoutId={morph ? `ans-${field.id}-${String(v)}` : undefined}
            type="button"
            className={`sam-choice sam-choice--big${value === v ? ' sam-choice--on' : ''}`}
            onClick={() => onAnswer(v)}
            whileTap={{ scale: 0.96 }}
          >
            <span lang="kn" className="sam-choice__kn">{l.kn}</span>
            <span>{l.en}</span>
          </motion.button>
        ))}
        {skipBtn}
      </div>
    );
  }

  if (field.kind === 'choice') {
    return (
      <div className="sam-chips">
        {field.options.map((opt) => (
          <motion.button
            key={opt}
            layoutId={morph ? `ans-${field.id}-${opt}` : undefined}
            type="button"
            className={`sam-choice${value === opt ? ' sam-choice--on' : ''}`}
            onClick={() => onAnswer(opt)}
            whileTap={{ scale: 0.96 }}
          >
            {opt}
          </motion.button>
        ))}
        {skipBtn}
      </div>
    );
  }

  if (field.kind === 'multi') {
    function toggle(opt) {
      tap();
      if (field.exclusive && opt === field.exclusive) { setPicked((p) => (p.includes(opt) ? [] : [opt])); return; }
      setPicked((p) => {
        const without = p.filter((x) => x !== field.exclusive);
        return without.includes(opt) ? without.filter((x) => x !== opt) : [...without, opt];
      });
    }
    return (
      <div className="sam-multi">
        <div className="sam-chips sam-chips--scroll">
          {field.options.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`sam-choice${picked.includes(opt) ? ' sam-choice--on' : ''}`}
              aria-pressed={picked.includes(opt)}
              onClick={() => toggle(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
        <div className="sam-row">
          {skipBtn}
          <button type="button" className="sam-primary sam-primary--sm" disabled={!picked.length} onClick={() => onAnswer(picked)}>
            {picked.length ? `Done · ${picked.length}` : 'Pick any that are true'}
          </button>
        </div>
      </div>
    );
  }

  // text / long
  const submitText = () => { const v = draft.trim(); if (v) onAnswer(v); };
  return (
    <div className="sam-write">
      {field.kind === 'long' ? (
        <textarea
          ref={inputRef}
          className="sam-input"
          rows={Math.min(5, Math.max(1, draft.split('\n').length + Math.floor(draft.length / 38)))}
          value={draft}
          placeholder={field.placeholder || 'Type here'}
          aria-label={field.label}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitText(); }}
        />
      ) : (
        <input
          ref={inputRef}
          className="sam-input"
          value={draft}
          placeholder={field.placeholder || 'Type here'}
          aria-label={field.label}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitText(); } }}
        />
      )}
      <div className="sam-row">
        {skipBtn}
        <button type="button" className="sam-send-btn" onClick={submitText} disabled={!draft.trim()} aria-label="Send answer">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function SentPanel({ result, samadhana, onBook }) {
  const band = result?.scoreable ? SRQ_BANDS[result.band] : null;
  return (
    <motion.div
      className="sam-sent"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="sam-bubble sam-bubble--them">
        <p className="sam-bubble__text">
          Received. Your counsellor will read this before you meet, so you won’t have to start from the beginning.
        </p>
        <p className="sam-bubble__kn" lang="kn">ಧನ್ಯವಾದಗಳು.</p>
      </div>

      {result?.urgent && (
        <div className="sam-bubble sam-bubble--them sam-bubble--care">
          <p className="sam-care__title">Please talk to someone today.</p>
          <p>You told us thoughts of ending your life have been on your mind. You don’t have to wait for your appointment.</p>
          <a href="tel:14416" className="sam-care__call" onClick={() => tap()}>
            <IconPhone size={17} /> Call Tele-MANAS · 14416
          </a>
        </div>
      )}

      {band && (
        <div className="sam-result">
          <div className="sam-result__score" aria-hidden="true">
            <span>{result.score}</span><small>/ 20</small>
          </div>
          <div>
            <p className="sam-result__title">{band.title}</p>
            <p className="sam-result__body">{band.body}</p>
            <p className="sam-result__foot">
              A screening questionnaire, not a diagnosis. You answered yes to {result.score} of 20.
            </p>
          </div>
        </div>
      )}

      <button type="button" className="sam-primary sam-primary--book" onClick={onBook} disabled={!samadhana}>
        {samadhana ? `Choose a time · ${samadhana.nextSlot ?? 'see openings'}` : 'Loading openings…'}
      </button>
      <p className="sam-sent__note">
        If you book anonymously, your counsellor won’t see these answers — anonymous bookings share nothing that identifies you.
      </p>
    </motion.div>
  );
}
