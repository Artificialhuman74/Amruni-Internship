import { useState } from 'react';
import { useParams, useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../components/Toast';
import IntakeField from '../components/intake/IntakeField';
import SensitiveGate from '../components/intake/SensitiveGate';
import IntakeResult from '../components/intake/IntakeResult';
import { useIntakeForm } from '../hooks/useIntakeForm';
import { confirm as confirmHaptic, tap } from '../lib/haptics';

/**
 * The homeopathy / ayurveda intake form. One section per screen.
 *
 * Sectioned rather than scrolled because the alternative is a forty-question
 * wall, and the two questions that decide whether a woman finishes a form that
 * long are "how much is left" and "can I stop and come back". The rail answers
 * the first; the draft in useIntakeForm answers the second.
 */
export default function IntakeForm() {
  const { formId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const appointmentId = searchParams.get('appointment');

  const f = useIntakeForm(formId);
  const [entered, setEntered] = useState([]);   // gated sections she opened
  const [done, setDone] = useState(null);       // submission result

  if (!f.form) return <Navigate to="/therapies" replace />;
  if (done) {
    return (
      <IntakeResult
        form={f.form}
        answers={f.answers}
        prakriti={done.prakriti}
        onDone={() => navigate('/therapies', { replace: true })}
      />
    );
  }

  const { form, section, sectionIndex, sections, isLast } = f;
  const gated = section.gated && !entered.includes(section.id) && !f.skipped.includes(section.id);
  const isSkipped = f.skipped.includes(section.id);

  function back() {
    if (sectionIndex === 0) navigate(-1);
    else { setSectionIndex(sectionIndex - 1); scrollTop(); }
  }

  function setSectionIndex(i) {
    f.setSectionIndex(i);
    scrollTop();
  }

  function next() {
    if (!f.sectionComplete) {
      toast('One question here still needs an answer', { icon: 'warning' });
      return;
    }
    tap();
    setSectionIndex(sectionIndex + 1);
  }

  async function submit() {
    if (!f.canSubmit) {
      const first = f.missing[0];
      const idx = sections.findIndex((s) => s.id === first.sectionId);
      toast('Something earlier in the form still needs an answer', { icon: 'warning' });
      if (idx >= 0) setSectionIndex(idx);
      return;
    }
    try {
      const result = await f.submit({ appointmentId });
      confirmHaptic();
      setDone(result);
    } catch {
      toast('Could not send that. Check your connection — your answers are still here.', { icon: 'warning' });
    }
  }

  return (
    <div className="screen screen--light">
      {/* Header + progress rail */}
      <div className="intake-header">
        <button className="nav-back-btn" onClick={back} aria-label="Go back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="intake-header__title">{form.label}</p>
          <p className="intake-header__step">
            Part {sectionIndex + 1} of {sections.length} · {Math.round(f.progress * 100)}% complete
          </p>
        </div>
      </div>

      <div className="intake-rail" role="progressbar" aria-valuenow={sectionIndex + 1} aria-valuemin={1} aria-valuemax={sections.length} aria-label="Form progress">
        {sections.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={`intake-rail__seg${i < sectionIndex ? ' is-done' : ''}${i === sectionIndex ? ' is-current' : ''}${f.skipped.includes(s.id) ? ' is-skipped' : ''}`}
            onClick={() => setSectionIndex(i)}
            aria-label={`Go to ${s.title}`}
          />
        ))}
      </div>

      <div className="intake-body">
        {/* Shown once, at the top of the first part */}
        {sectionIndex === 0 && (
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
            className="intake-intro"
          >
            {form.intro}
          </motion.p>
        )}

        {f.restored && sectionIndex === 0 && (
          <div className="intake-restored">
            <p>We kept what you had already filled in.</p>
            <button type="button" onClick={() => { f.discard(); toast('Started fresh', { icon: 'check' }); }}>
              Start again
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={section.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className="intake-section__title">{section.title}</h2>
            {section.note && <p className="intake-section__note">{section.note}</p>}

            {gated ? (
              <SensitiveGate
                section={section}
                onEnter={() => { setEntered((prev) => [...prev, section.id]); f.unskipSection(section.id); }}
                onSkip={() => { f.skipSection(section.id); if (isLast) submit(); else next(); }}
              />
            ) : isSkipped ? (
              <div className="intake-skipped">
                <p>You chose to skip this part. That is completely fine.</p>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => { f.unskipSection(section.id); setEntered((prev) => [...prev, section.id]); }}
                >
                  Actually, I’ll answer it
                </button>
              </div>
            ) : (
              <div className="intake-fields">
                {section.fields.map((field) => (
                  <IntakeField
                    key={field.id}
                    field={field}
                    value={f.answers[field.id]}
                    onChange={(v) => f.setAnswer(field.id, v)}
                  />
                ))}
                {section.sensitive && (
                  <p className="intake-fields__footnote">
                    Every question in this part can be left blank.
                  </p>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer — hidden behind the gate, which owns its own two choices */}
      {!gated && (
        <div className="action-footer">
          {sectionIndex > 0 && (
            <button type="button" className="btn btn--secondary action-footer__back" onClick={back}>
              Back
            </button>
          )}
          <button
            type="button"
            className="btn btn--primary"
            onClick={isLast ? submit : next}
            disabled={f.submitting}
          >
            {f.submitting ? 'Sending…' : isLast ? 'Submit form' : 'Continue'}
          </button>
        </div>
      )}
    </div>
  );
}

function scrollTop() {
  document.querySelector('.intake-body')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
}
