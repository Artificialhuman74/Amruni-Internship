import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { meApi, apiError } from '../services/api';
import { useToast } from '../components/ui/Toast';
import { tap, confirm as confirmHaptic } from '../lib/haptics';
import { useSosLift } from '../lib/useSosLift';
import { IconDaisy, IconCheck } from '../icons.jsx';

// Self-reportable questions behind the clinical PCOS model (AUC 0.88).
const QUESTIONS = [
  { id: 'irregular', q: 'Are your periods often irregular?', help: 'Cycles that vary a lot month to month, or that you sometimes skip.' },
  { id: 'weightGain', q: 'Have you had unexplained weight gain recently?', help: 'Weight rising without a clear change in diet or activity.' },
  { id: 'hairGrowth', q: 'Do you notice excess hair growth?', help: 'Coarse or dark hair on the face, chin, chest or back.' },
  { id: 'skinDarkening', q: 'Any darkening of skin in body folds?', help: 'Velvety dark patches on the neck, underarms or groin.' },
  { id: 'pimples', q: 'Do you get persistent acne or pimples?', help: 'Breakouts that keep coming back, often along the jaw.' },
  { id: 'regExercise', q: 'Do you exercise regularly?', help: 'Any consistent movement — a walk, yoga, the gym.' },
  { id: 'fastFood', q: 'Do you eat fast food frequently?', help: 'Several times a week or more.' },
];

const BAND = {
  low: { label: 'Low signal', tint: 'var(--clr-success-soft)', ink: 'var(--clr-success)', ring: 'var(--clr-success)' },
  moderate: { label: 'Moderate signal', tint: 'var(--clr-warning-soft)', ink: 'oklch(0.48 0.12 60)', ring: 'var(--clr-warning)' },
  high: { label: 'Higher signal', tint: 'var(--clr-brand-soft)', ink: 'var(--clr-brand)', ring: 'var(--clr-brand)' },
};

function ageBucketToNumber(dob) {
  if (!dob) return null;
  const born = new Date(dob);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  return now.getFullYear() - born.getFullYear() - (now < new Date(now.getFullYear(), born.getMonth(), born.getDate()) ? 1 : 0);
}

export default function PcosCheck() {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const toast = useToast();
  const { state } = useApp();
  useSosLift(); // fixed bottom CTA — keep SOS clear of it

  const [step, setStep] = useState(0); // 0..QUESTIONS.length-1, then 'result'
  const [answers, setAnswers] = useState({});
  const [bmiStr, setBmiStr] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [added, setAdded] = useState(false);

  const total = QUESTIONS.length + 1; // +1 for the optional BMI step
  const onResult = step === 'result';

  function answer(id, value) {
    tap();
    setAnswers((a) => ({ ...a, [id]: value }));
    setTimeout(() => setStep((s) => s + 1), 180);
  }

  async function submit() {
    setLoading(true);
    setError('');
    const bmi = parseFloat(bmiStr);
    try {
      const res = await meApi.pcosScreening({
        ...QUESTIONS.reduce((acc, q) => ({ ...acc, [q.id]: !!answers[q.id] }), {}),
        age: ageBucketToNumber(state.user.dob) || undefined,
        bmi: Number.isFinite(bmi) ? bmi : undefined,
      });
      setResult(res);
      setStep('result');
      confirmHaptic();
    } catch (err) {
      setError(apiError(err, 'Could not run the check. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  async function addPcos() {
    try {
      await meApi.addCondition('PCOS');
      setAdded(true);
      confirmHaptic();
      toast('Added to your health record', { icon: 'daisy' });
    } catch (err) {
      toast(apiError(err, 'Could not update your record.'), { icon: 'warning' });
    }
  }

  const progress = onResult ? 100 : (step / total) * 100;

  return (
    <div className="screen screen--light">
      <div className="screen-header-nav">
        <button className="nav-back-btn" onClick={() => (onResult || step === 0 ? navigate(-1) : setStep((s) => s - 1))} aria-label="Go back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <span className="nav-header-title">PCOS self-check</span>
        <div style={{ width: 40 }} />
      </div>

      {!onResult && (
        <div style={{ padding: '0 var(--sp-6)', marginBottom: 'var(--sp-2)' }}>
          <div style={{ height: 4, background: 'var(--clr-border)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
            <motion.div style={{ height: '100%', background: 'var(--clr-brand)', borderRadius: 'var(--radius-full)' }}
              animate={{ width: `${progress}%` }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} />
          </div>
        </div>
      )}

      <div style={{ flex: 1, padding: 'var(--sp-6)', display: 'flex', flexDirection: 'column' }}>
        <AnimatePresence mode="wait" initial={false}>
          {/* Questions */}
          {typeof step === 'number' && step < QUESTIONS.length && (
            <motion.div
              key={`q${step}`}
              initial={reduced ? { opacity: 0 } : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, x: -24 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            >
              <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--clr-brand)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Question {step + 1} of {QUESTIONS.length}
              </p>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 600, color: 'var(--clr-ink)', lineHeight: 'var(--leading-tight)', marginTop: 'var(--sp-3)', textWrap: 'balance' }}>
                {QUESTIONS[step].q}
              </h1>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-base)' }}>
                {QUESTIONS[step].help}
              </p>
              <div style={{ flex: 1 }} />
              <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
                <button className="btn btn--secondary" onClick={() => answer(QUESTIONS[step].id, false)} style={{ flex: 1 }}>No</button>
                <button className="btn btn--primary" onClick={() => answer(QUESTIONS[step].id, true)} style={{ flex: 1 }}>Yes</button>
              </div>
            </motion.div>
          )}

          {/* Optional BMI */}
          {step === QUESTIONS.length && (
            <motion.div
              key="bmi"
              initial={reduced ? { opacity: 0 } : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, x: -24 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            >
              <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--clr-brand)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Last step · optional</p>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 600, color: 'var(--clr-ink)', lineHeight: 'var(--leading-tight)', marginTop: 'var(--sp-3)' }}>
                What's your BMI, if you know it?
              </h1>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-base)' }}>
                Body mass index sharpens the estimate. Skip if you're unsure — the check still works.
              </p>
              <div className="input-group" style={{ marginTop: 'var(--sp-6)' }}>
                <label className="input-label" htmlFor="bmi">BMI</label>
                <input id="bmi" className="input-field" type="number" inputMode="decimal" min="12" max="60" step="0.1"
                  placeholder="e.g. 23.5" value={bmiStr} onChange={(e) => setBmiStr(e.target.value)} />
              </div>
              {error && <p role="alert" style={{ fontSize: 'var(--text-sm)', color: 'oklch(0.55 0.18 24)', marginTop: 'var(--sp-3)' }}>{error}</p>}
              <div style={{ flex: 1 }} />
              <button className="btn btn--primary" onClick={submit} disabled={loading}>
                {loading ? 'Analysing…' : 'See my result'}
              </button>
              <button className="btn btn--ghost btn--sm" style={{ margin: 'var(--sp-3) auto 0' }} onClick={submit} disabled={loading}>
                Skip BMI
              </button>
            </motion.div>
          )}

          {/* Result */}
          {onResult && result && (
            <motion.div
              key="result"
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            >
              <RiskDial band={result.band} reduced={reduced} />
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 600, color: 'var(--clr-ink)', textAlign: 'center', marginTop: 'var(--sp-5)' }}>
                {BAND[result.band].label}
              </h1>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', textAlign: 'center', marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-base)', maxWidth: '34ch', marginInline: 'auto' }}>
                {result.message}
              </p>

              {result.topFactors.length > 0 && (
                <div style={{ marginTop: 'var(--sp-6)' }}>
                  <p className="section-title" style={{ marginBottom: 'var(--sp-3)' }}>What stood out</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
                    {result.topFactors.map((f) => (
                      <span key={f} className="chip chip--sm" style={{ cursor: 'default', background: BAND[result.band].tint, borderColor: 'transparent', color: BAND[result.band].ink, fontWeight: 600 }}>{f}</span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ flex: 1, minHeight: 'var(--sp-6)' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                {result.band !== 'low' && (
                  <button className="btn btn--primary" onClick={() => navigate('/consult')}>
                    Talk to a specialist
                  </button>
                )}
                <button
                  className={result.band !== 'low' ? 'btn btn--secondary' : 'btn btn--primary'}
                  onClick={addPcos}
                  disabled={added}
                >
                  {added ? <><IconCheck size={16} /> Added to your record</> : 'Add PCOS to my health record'}
                </button>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-subtle)', textAlign: 'center', lineHeight: 'var(--leading-base)', marginTop: 'var(--sp-1)' }}>
                  This is an educational screening tool trained on clinical data, not a diagnosis. Only a doctor can confirm PCOS.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function RiskDial({ band, reduced }) {
  const pct = { low: 0.28, moderate: 0.55, high: 0.85 }[band];
  const { ring } = BAND[band];
  const R = 52, C = 2 * Math.PI * R;
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--sp-4)' }}>
      <svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label={`${band} PCOS signal`}>
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--clr-border)" strokeWidth="10" />
        <motion.circle
          cx="70" cy="70" r={R} fill="none" stroke={ring} strokeWidth="10" strokeLinecap="round"
          transform="rotate(-90 70 70)"
          strokeDasharray={C}
          initial={{ strokeDashoffset: reduced ? C * (1 - pct) : C }}
          animate={{ strokeDashoffset: C * (1 - pct) }}
          transition={{ duration: reduced ? 0 : 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        />
        <IconDaisy x={54} y={54} size={32} color="var(--clr-brand)" strokeWidth={1.5} />
      </svg>
    </div>
  );
}
