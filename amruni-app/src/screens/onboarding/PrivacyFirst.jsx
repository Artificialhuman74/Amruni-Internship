import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import CamelliaHero from '../../components/CamelliaHero';
import { tap, confirm as confirmHaptic } from '../../lib/haptics';
import { IconLock } from '../../icons.jsx';

/**
 * What she is handing over, said before she hands over any of it.
 *
 * Every line here was checked against the database schema, not written from
 * memory of what the app probably stores. A privacy screen is a promise, and
 * this one is only worth showing because each sentence in it is true.
 *
 * On the encryption line, one deliberately careful choice of words. The
 * promise is that anyone who opens the DATABASE sees scrambled text — our own
 * engineers included, and a stolen backup, and the hosting company. It does
 * not say "no one at Amruni can ever read it", because the running server
 * holds the key (it has to, or her doctor could not read her chart) and a
 * sentence that overclaims is the kind a health app gets held to. See the
 * docstring at the top of server/app/crypto.py.
 *
 * Community is named separately because it is the one place her words are
 * meant to be read by other people.
 */
const COLLECTED = [
  { title: 'Who you are', body: 'Your phone number, name and date of birth.' },
  { title: 'Your body', body: 'Period dates and symptoms, weight, and pregnancy details if you add them.' },
  { title: 'How you feel', body: 'Moods, journal entries and the wellbeing questionnaires you choose to fill in.' },
  { title: 'Your care', body: 'Conditions, allergies, medicines, appointments, forms, uploaded documents, and your doctors’ notes and prescriptions.' },
  { title: 'Your safety', body: 'Emergency contacts, and your location only inside an SOS alert you send.' },
];

const CONSENTS = [
  { id: 'health', required: true, label: 'I agree to Amruni processing my health data to personalise my care.' },
  { id: 'terms', required: true, label: <>I agree to the <u>Privacy Policy</u> and <u>Terms of Use</u>.</> },
  { id: 'analytics', required: false, label: 'I allow anonymous usage insights to help improve Amruni. (Optional)' },
];

export default function PrivacyFirst() {
  const navigate = useNavigate();
  const [checked, setChecked] = useState({});

  const allRequired = CONSENTS.filter((c) => c.required).every((c) => checked[c.id]);

  function toggle(id) {
    tap();
    setChecked((c) => ({ ...c, [id]: !c[id] }));
  }
  function acceptAll() {
    confirmHaptic();
    setChecked(Object.fromEntries(CONSENTS.map((c) => [c.id, true])));
  }

  return (
    <div className="screen screen--soft">
      <div className="onb-page">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="onb-hero"
          style={{ marginTop: 'var(--sp-4)' }}
        >
          <CamelliaHero size={150} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          style={{ marginTop: 'var(--sp-2)', textAlign: 'center' }}
        >
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', fontWeight: 600, color: 'var(--clr-ink)', lineHeight: 'var(--leading-tight)' }}>
            Privacy, first.
          </h1>
          <p style={{ marginTop: 'var(--sp-3)', fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', lineHeight: 'var(--leading-base)', maxWidth: '32ch', marginInline: 'auto' }}>
            Your health is yours alone. Here's exactly what you're agreeing to — nothing hidden, nothing sold.
          </p>
        </motion.div>

        <motion.section
          aria-labelledby="privacy-collect"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="privacy-collect"
        >
          <h2 id="privacy-collect" className="privacy-collect__title">What we keep</h2>
          <dl className="privacy-collect__list">
            {COLLECTED.map((item) => (
              <div key={item.title} className="privacy-collect__row">
                <dt>{item.title}</dt>
                <dd>{item.body}</dd>
              </div>
            ))}
          </dl>

          <div className="privacy-seal">
            <span className="privacy-seal__icon" aria-hidden="true"><IconLock size={18} /></span>
            <div>
              <p className="privacy-seal__title">Locked before it is saved</p>
              <p className="privacy-seal__body">
                Your details are encrypted before they reach our database. Anyone who opens that
                database — our own team, our hosting provider, or someone who steals a copy —
                sees scrambled text, not you. The only people who read your health record are the
                doctors you choose to consult.
              </p>
            </div>
          </div>

          <p className="privacy-collect__note">
            Posts you share in Community are read by other members, under an anonymous name.
            We never sell your data and there are no advertisers here.
          </p>
        </motion.section>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          style={{ marginTop: 'var(--sp-6)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}
        >
          {CONSENTS.map((c) => (
            <button key={c.id} className={`consent-row${checked[c.id] ? ' consent-row--on' : ''}`} onClick={() => toggle(c.id)} aria-pressed={!!checked[c.id]}>
              <span className="consent-row__box" aria-hidden="true">
                {checked[c.id] && (
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path d="M2.5 7l2.5 2.5 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span className="consent-row__label">{c.label}</span>
            </button>
          ))}
        </motion.div>

        <div style={{ flex: 1, minHeight: 'var(--sp-4)' }} />

        <button className="btn btn--ghost btn--sm" onClick={acceptAll} style={{ margin: '0 auto var(--sp-3)', color: 'var(--clr-brand)', fontWeight: 600 }}>
          Accept all
        </button>
        <button
          className="btn btn--primary"
          disabled={!allRequired}
          onClick={() => navigate('/onboarding/name')}
          style={{ opacity: allRequired ? 1 : 0.5 }}
        >
          Continue
        </button>

        {/* At the very end of the page, where she arrives only by scrolling
            past the whole promise — the last thing read before she decides. */}
        <p className="testing-note" role="note">
          <strong>Amruni is in testing.</strong> This is an early version, still being
          built and checked. Some things may change or not work as expected, and it is
          not a substitute for emergency care.
        </p>
      </div>
    </div>
  );
}
