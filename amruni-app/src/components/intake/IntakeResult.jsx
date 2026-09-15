import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { DOSHA, needsSupport } from '../../data/intake';
import { srqResult, SRQ_BANDS, SRQ_CUTOFF } from '../../data/counselling';
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
  const srq = form.id === 'counselling' ? srqResult(answers) : null;
  // Item 17 opens this card on its own, whatever the total says. A woman can
  // answer no to nineteen questions and still be the most urgent person to
  // reach today, and a threshold that hid her would be the one bug in this
  // form that could not be fixed afterwards.
  const support = (form.id === 'homeopathy' && needsSupport(answers)) || Boolean(srq?.urgent);

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
        {srq?.scoreable && <SrqCard srq={srq} />}

        {support && (
          <div className="crisis-card" role="note">
            <p className="crisis-card__title">
              {srq?.urgent ? 'Please talk to someone today.' : 'That took something to write down.'}
            </p>
            <p className="crisis-card__body">
              {srq?.urgent
                ? 'You said the thought of ending your life has been on your mind. Thank you for saying so — it is the hardest one to tick. You do not have to wait for your appointment, and you do not have to be in crisis to call. Someone is there now.'
                : 'You are not obliged to do anything with it today, and nothing here has changed about your consultation. But you do not have to be in crisis to call someone, and if you would like to talk to a person before your appointment, there is one.'}
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

/**
 * The twenty questions, added up.
 *
 * Three rules this card follows, all of them about not overclaiming:
 *
 *   · It shows the score as a fraction of the instrument, not as a percentage
 *     or a grade. 11/20 is a count of things she said were true; 55% implies a
 *     measurement that was never taken.
 *   · It never uses a clinical word. No "depression", no "anxiety", no
 *     "positive screen" — the SRQ-20 identifies distress worth a conversation,
 *     and naming a condition from it would be a diagnosis this app is in no
 *     position to make.
 *   · It says out loud that it is a screening tool, in the card, not in a
 *     footnote she will not read.
 */
function SrqCard({ srq }) {
  const band = SRQ_BANDS[srq.band];
  return (
    <div className="srq-card" role="note">
      <div className="srq-card__head">
        <div>
          <p className="srq-card__eyebrow">Your twenty questions</p>
          <p className="srq-card__title">{band.title}</p>
        </div>
        <div className={`srq-card__score srq-card__score--${srq.band}`} aria-hidden="true">
          <span className="srq-card__num">{srq.score}</span>
          <span className="srq-card__den">/ {srq.total}</span>
        </div>
      </div>
      <p className="srq-card__body">{band.body}</p>
      <p className="srq-card__foot">
        {/* Said plainly, where she is looking. A screening questionnaire that
            lets someone leave believing they have been diagnosed has done
            harm, however carefully the rest of the screen was worded. */}
        This is a screening questionnaire, not a diagnosis — it points to where a
        conversation should start. Your counsellor sees your answers, and reads
        them alongside everything else you wrote.
        <span className="srq-card__sr">
          {' '}You answered yes to {srq.score} of {srq.total} questions.
          {srq.score >= SRQ_CUTOFF ? ' That is at or above the level this questionnaire flags for follow-up.' : ''}
        </span>
      </p>
    </div>
  );
}
