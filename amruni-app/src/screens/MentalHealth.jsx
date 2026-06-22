import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import BottomSheet from '../components/BottomSheet';
import { PHQ9_QUESTIONS, PHQ9_OPTIONS, GAD7_QUESTIONS } from '../data/mock';

export default function MentalHealth() {
  const { state, dispatch } = useApp();
  const anonymous = state.settings.anonymousMode;

  const [view, setView] = useState('home'); // home | phq9 | gad7 | result
  const [tool, setTool] = useState(null);
  const [answers, setAnswers] = useState({});
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(null);
  const [nimhansOpen, setNimhansOpen] = useState(false);
  const [helpPressed, setHelpPressed] = useState(false);

  const questions = tool === 'phq9' ? PHQ9_QUESTIONS : GAD7_QUESTIONS;
  const toolLabel = tool === 'phq9' ? 'PHQ-9' : 'GAD-7';

  function startTool(t) {
    setTool(t);
    setAnswers({});
    setCurrentQ(0);
    setScore(null);
    setView('quiz');
  }

  function handleAnswer(val) {
    const next = { ...answers, [currentQ]: val };
    setAnswers(next);
    if (currentQ < questions.length - 1) {
      setTimeout(() => setCurrentQ(q => q + 1), 280);
    } else {
      const total = Object.values(next).reduce((a, b) => a + b, 0);
      setScore(total);
      setView('result');
    }
  }

  function getResult(s, t) {
    if (t === 'phq9') {
      if (s <= 4) return { level: 'Minimal', cls: 'minimal', msg: 'Your responses suggest minimal depression symptoms. Keep checking in with yourself regularly.' };
      if (s <= 9) return { level: 'Mild', cls: 'mild', msg: 'Mild symptoms detected. Talking to someone you trust or a counsellor can help.' };
      if (s <= 14) return { level: 'Moderate', cls: 'moderate', msg: 'Moderate symptoms. We recommend speaking with a mental health professional.' };
      return { level: 'Severe', cls: 'severe', msg: 'Your responses indicate severe symptoms. Please reach out to a professional — support is available now.' };
    } else {
      if (s <= 4) return { level: 'Minimal', cls: 'minimal', msg: 'Minimal anxiety. Your responses suggest you are managing well.' };
      if (s <= 9) return { level: 'Mild', cls: 'mild', msg: 'Mild anxiety. Breathing exercises and regular sleep can make a real difference.' };
      if (s <= 14) return { level: 'Moderate', cls: 'moderate', msg: 'Moderate anxiety. Consider speaking with a counsellor for practical coping strategies.' };
      return { level: 'Severe', cls: 'severe', msg: 'Severe anxiety detected. Please connect with a professional — this is what they are here for.' };
    }
  }

  if (view === 'quiz') {
    const progress = (currentQ / questions.length) * 100;
    return (
      <div className="screen screen--light">
        <div style={{ padding: 'calc(env(safe-area-inset-top) + var(--sp-5)) var(--sp-6) var(--sp-8)', display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', marginBottom: 'var(--sp-6)' }}>
            <button onClick={() => setView('home')} style={{ color: 'var(--clr-ink-muted)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 'var(--sp-1)' }} aria-label="Exit quiz">
              <CloseIcon />
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--sp-2)' }}>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--clr-ink-muted)' }}>{toolLabel}</span>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)' }}>{currentQ + 1} / {questions.length}</span>
              </div>
              <div style={{ height: 4, background: 'var(--clr-border)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                <motion.div
                  style={{ height: '100%', background: 'var(--clr-mauve)', borderRadius: 'var(--radius-full)' }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                />
              </div>
            </div>
          </div>

          {/* Question */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQ}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              style={{ flex: 1 }}
            >
              <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--clr-brand)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--sp-4)' }}>
                In the last 2 weeks, how often have you been bothered by:
              </p>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--clr-ink)', lineHeight: 'var(--leading-snug)', marginBottom: 'var(--sp-8)', textWrap: 'pretty' }}>
                {questions[currentQ]}
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                {PHQ9_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    className={`phq-option${answers[currentQ] === opt.value ? ' phq-option--active' : ''}`}
                    onClick={() => handleAnswer(opt.value)}
                  >
                    <div className="phq-option__radio">
                      {answers[currentQ] === opt.value && <div className="phq-option__dot" />}
                    </div>
                    <span className="phq-option__text">{opt.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>

          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-subtle)', textAlign: 'center', marginTop: 'var(--sp-6)', lineHeight: 1.6, textWrap: 'pretty' }}>
            This is a screening tool, not a clinical diagnosis. A professional is needed for a formal assessment.
          </p>
        </div>
      </div>
    );
  }

  if (view === 'result' && score !== null) {
    const result = getResult(score, tool);
    return (
      <div className="screen screen--light">
        <div style={{ padding: 'calc(env(safe-area-inset-top) + var(--sp-6)) var(--sp-6) var(--sp-8)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
          <button onClick={() => setView('home')} style={{ color: 'var(--clr-ink-muted)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignSelf: 'flex-start', padding: 'var(--sp-1)' }} aria-label="Back">
            <ChevronLeft />
          </button>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 600, color: 'var(--clr-ink)', marginBottom: 'var(--sp-6)' }}>
              Your {toolLabel} result
            </h1>
            <div className={`score-card score-card--${result.cls}`}>
              <div className="score-num" style={{ color: result.cls === 'minimal' ? 'var(--clr-success)' : result.cls === 'mild' ? 'var(--clr-warning)' : 'var(--clr-brand)' }}>
                {score}
              </div>
              <div className="score-label" style={{ color: result.cls === 'minimal' ? 'var(--clr-success)' : result.cls === 'mild' ? 'var(--clr-warning)' : 'var(--clr-brand)' }}>
                {result.level} symptoms
              </div>
              <p className="score-desc">{result.msg}</p>
            </div>
          </motion.div>

          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-subtle)', lineHeight: 1.6, textWrap: 'pretty' }}>
            These results are not a diagnosis. Please consult a qualified mental health professional for proper evaluation.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            <button className="btn btn--primary" onClick={() => setNimhansOpen(true)}>
              Talk to a counsellor
            </button>
            <button className="btn btn--secondary" onClick={() => { setView('home'); setTool(null); }}>
              Back to mental health
            </button>
          </div>
        </div>
        <NimhansSheet open={nimhansOpen} onClose={() => setNimhansOpen(false)} anonymous={anonymous} dispatch={dispatch} />
      </div>
    );
  }

  // Home view
  return (
    <div className="screen screen--light">
      <div style={{ padding: 'calc(env(safe-area-inset-top) + var(--sp-6)) var(--sp-6) var(--sp-8)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 600, color: 'var(--clr-ink)', lineHeight: 'var(--leading-tight)' }}>
            How are you feeling?
          </h1>
          <p style={{ marginTop: 'var(--sp-2)', fontSize: 'var(--text-base)', color: 'var(--clr-ink-muted)', lineHeight: 'var(--leading-base)' }}>
            This is a private, judgement-free space. Your data is yours.
          </p>
        </motion.div>

        {/* I need help — primary CTA */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}>
          <button
            className={`panic-btn${helpPressed ? ' panic-btn--confirming' : ''}`}
            onClick={() => { setHelpPressed(true); setTimeout(() => { setHelpPressed(false); setNimhansOpen(true); }, 1500); }}
            aria-label="I need help — connect to NIMHANS"
          >
            <HeartIcon />
            I need help
          </button>
          <p style={{ textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--clr-ink-subtle)', marginTop: 'var(--sp-3)' }}>
            {helpPressed ? 'Connecting to NIMHANS support…' : 'Connects you to NIMHANS 24/7 support'}
          </p>
        </motion.div>

        {/* Anonymous toggle */}
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--clr-surface)', border: '1px solid var(--clr-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--sp-4) var(--sp-5)' }}
        >
          <div>
            <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--clr-ink)' }}>Anonymous mode</p>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginTop: 2 }}>
              {anonymous ? 'Identity hidden from counsellors' : 'Your profile is visible to counsellors'}
            </p>
          </div>
          <button
            className={`toggle${anonymous ? ' toggle--on' : ''}`}
            onClick={() => dispatch({ type: 'SET_SETTINGS', payload: { anonymousMode: !anonymous } })}
            aria-pressed={anonymous}
            aria-label="Toggle anonymous mode"
          >
            <div className="toggle__knob" />
          </button>
        </motion.div>

        {/* Screening tools */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}>
          <p className="section-title">Screening tools</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {[
              { key: 'phq9', icon: '🧠', label: 'Depression check (PHQ-9)', desc: '9 questions · ~3 minutes', color: 'var(--clr-brand-soft)' },
              { key: 'gad7', icon: '🌊', label: 'Anxiety check (GAD-7)', desc: '7 questions · ~2 minutes', color: 'var(--clr-fertile-soft)' },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => startTool(t.key)}
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', padding: 'var(--sp-4) var(--sp-5)', background: 'var(--clr-surface)', border: '1px solid var(--clr-border)', borderRadius: 'var(--radius-lg)', cursor: 'pointer', textAlign: 'left', transition: 'background var(--dur-fast)' }}
              >
                <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', background: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                  {t.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--clr-ink)' }}>{t.label}</p>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginTop: 2 }}>{t.desc}</p>
                </div>
                <ChevronRight />
              </button>
            ))}
          </div>
        </motion.div>

        {/* NIMHANS direct */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}>
          <p className="section-title">Direct support</p>
          <button
            onClick={() => setNimhansOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', padding: 'var(--sp-4) var(--sp-5)', background: 'var(--clr-dark)', border: 'none', borderRadius: 'var(--radius-lg)', cursor: 'pointer', width: '100%', textAlign: 'left' }}
          >
            <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', background: 'var(--clr-dark-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🏥</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--clr-ink-on-dark)' }}>NIMHANS 24/7 Helpline</p>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted-on-dark)', marginTop: 2 }}>Free · Confidential · Trained counsellors</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ color: 'var(--clr-ink-muted-on-dark)', flexShrink: 0 }}>
              <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </motion.div>
      </div>

      <NimhansSheet open={nimhansOpen} onClose={() => setNimhansOpen(false)} anonymous={anonymous} dispatch={dispatch} />
    </div>
  );
}

function NimhansSheet({ open, onClose, anonymous, dispatch }) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Connect to NIMHANS">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        <div style={{ background: anonymous ? 'var(--clr-surface-2)' : 'var(--clr-brand-soft)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-4)', textAlign: 'center' }}>
          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: anonymous ? 'var(--clr-ink-muted)' : 'var(--clr-brand)' }}>
            {anonymous ? '🔒 Anonymous mode is ON — your identity is hidden' : '👤 Your profile will be visible to the counsellor'}
          </p>
        </div>
        <a
          href="tel:080-46110007"
          className="btn btn--primary"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--sp-3)', textDecoration: 'none' }}
        >
          📞 Call NIMHANS helpline
        </a>
        <button className="btn btn--secondary" onClick={onClose}>
          Not right now
        </button>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-subtle)', textAlign: 'center', lineHeight: 1.6 }}>
          NIMHANS National Institute of Mental Health and Neuro Sciences, Bengaluru. Helpline: 080-46110007
        </p>
      </div>
    </BottomSheet>
  );
}

function HeartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z" />
    </svg>
  );
}

function ChevronLeft() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M13 4L7 10l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ color: 'var(--clr-ink-subtle)', flexShrink: 0 }}>
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
