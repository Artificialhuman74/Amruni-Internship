import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { DOSHA, needsSupport } from '../../data/intake';
import SuccessCheck from '../SuccessCheck';
import { IconPhone } from '../../icons.jsx';
import { tap } from '../../lib/haptics';
import { article } from '../../lib/text';

/**
 * What she sees after submitting.
 *
 * Two things happen here that are worth naming.
 *
 * The ayurvedic form gives something back — a prakriti sketch — because she
 * just answered eight constitutional questions and deserves to see what they
 * added up to. It is framed as a sketch a physician will confirm, never as a
 * result, because eight questions is not a diagnosis.
 *
 * The homeopathic form may instead surface a helpline. If she has just written
 * down abuse, or that something still reaches her a great deal, the screen
 * offers Tele-MANAS — offered, in ordinary language, without alarm, and
 * without treating what she wrote as an emergency she did not declare.
 */
export default function IntakeResult({ form, answers, prakriti, onDone }) {
  const navigate = useNavigate();
  const support = form.id === 'homeopathy' && needsSupport(answers);

  return (
    <div className="screen screen--light">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        style={{
          padding: 'calc(env(safe-area-inset-top) + var(--sp-8)) var(--sp-6) var(--sp-8)',
          display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-4)', textAlign: 'center' }}>
          <SuccessCheck size={56} />
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 600, color: 'var(--clr-ink)' }}>
              Your form is with us
            </h1>
            <p style={{ marginTop: 'var(--sp-2)', fontSize: 'var(--text-base)', color: 'var(--clr-ink-muted)', lineHeight: 'var(--leading-base)', textWrap: 'pretty' }}>
              Your {form.short.toLowerCase()} practitioner reads this before your consultation, so you
              start the appointment further along than you would otherwise.
            </p>
          </div>
        </div>

        {prakriti && <PrakritiCard prakriti={prakriti} />}

        {support && (
          <div className="crisis-card" role="note">
            <p className="crisis-card__title">That took something to write down.</p>
            <p className="crisis-card__body">
              You are not obliged to do anything with it today, and nothing here has changed about
              your consultation. But you do not have to be in crisis to call someone, and if you
              would like to talk to a person before your appointment, there is one.
            </p>
            <a href="tel:14416" className="crisis-card__call" onClick={() => tap()}>
              <IconPhone size={18} /> Call Tele-MANAS · 14416
            </a>
            <p className="crisis-card__note">
              Free, 24×7, in your language. Run by NIMHANS for the Government of India.
            </p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <button className="btn btn--primary" onClick={() => navigate(`/consult?specialty=${encodeURIComponent(form.specialty)}`)}>
            Find {article(form.short)} {form.short.toLowerCase()} practitioner
          </button>
          <button className="btn btn--secondary" onClick={onDone}>
            Back to therapies
          </button>
        </div>

        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-subtle)', textAlign: 'center', lineHeight: 1.6, textWrap: 'pretty' }}>
          You can fill this in again before a later consultation. Each version is kept separately, so
          your practitioner always reads what was true at the time.
        </p>
      </motion.div>
    </div>
  );
}

function PrakritiCard({ prakriti }) {
  const order = ['vata', 'pitta', 'kapha'];
  return (
    <div className="prakriti-card">
      <p className="prakriti-card__eyebrow">Your constitution, in sketch</p>
      <p className="prakriti-card__label">{prakriti.label}</p>

      <div className="prakriti-card__bars">
        {order.map((key) => {
          const d = DOSHA[key];
          const pct = prakriti.percent[key] ?? 0;
          return (
            <div key={key} className="prakriti-bar">
              <div className="prakriti-bar__head">
                <span className="prakriti-bar__name">{d.name}</span>
                <span className="prakriti-bar__pct">{pct}%</span>
              </div>
              <div className="prakriti-bar__track">
                <motion.div
                  className="prakriti-bar__fill"
                  style={{ background: d.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
                />
              </div>
              <p className="prakriti-bar__trait">{d.trait}</p>
            </div>
          );
        })}
      </div>

      <p className="prakriti-card__note">{DOSHA[prakriti.dominant].note}</p>
      <p className="prakriti-card__caveat">
        Worked out from {prakriti.answered} of {prakriti.total} constitutional questions. A physician
        confirms prakriti by examination — treat this as a starting point for that conversation, not
        a finding.
      </p>
    </div>
  );
}
