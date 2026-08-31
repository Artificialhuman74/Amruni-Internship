import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { THERAPIES, EVIDENCE_BADGE } from '../data/therapies';
import { IconLeaf, IconSprout, IconWellness } from '../icons.jsx';

const ICONS = { leaf: IconLeaf, sprout: IconSprout, wellness: IconWellness };

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } } };
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.16, 1, 0.3, 1] } },
};

/**
 * The traditional and complementary care hub: Ayurveda, Reiki, Yoga.
 *
 * Each card carries its evidence badge on the hub itself rather than only on
 * the detail page. A woman scanning three options should be able to see, at a
 * glance and before she taps, which of them is trial-supported and which is
 * offered for relaxation — that distinction is the most useful thing on the
 * screen, and burying it one level down would be a choice to hide it.
 */
export default function Therapies() {
  const navigate = useNavigate();

  return (
    <div className="screen screen--light">
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        style={{
          padding: 'calc(env(safe-area-inset-top) + var(--sp-6)) var(--sp-6) var(--sp-8)',
          display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)',
        }}
      >
        <motion.div variants={fadeUp}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 600, color: 'var(--clr-ink)', lineHeight: 'var(--leading-tight)' }}>
            Traditional care
          </h1>
          <p style={{ marginTop: 'var(--sp-2)', fontSize: 'var(--text-base)', color: 'var(--clr-ink-muted)', lineHeight: 'var(--leading-base)', textWrap: 'pretty' }}>
            Ayurveda, yoga and reiki, alongside the rest of your care rather than instead of it. Each
            one says plainly what it is good for.
          </p>
        </motion.div>

        {THERAPIES.map((t) => {
          const Icon = ICONS[t.icon];
          const badge = EVIDENCE_BADGE[t.evidence.level];
          return (
            <motion.button
              key={t.id}
              variants={fadeUp}
              className="therapy-card"
              onClick={() => navigate(`/therapies/${t.id}`)}
              aria-label={`${t.name} — ${t.tagline}`}
            >
              <div className="therapy-card__head">
                <div className="therapy-card__icon" style={{ background: t.soft, color: t.color }}>
                  <Icon size={24} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="therapy-card__name">{t.name}</p>
                  <p className="therapy-card__tagline">{t.tagline}</p>
                </div>
                <ChevronRight />
              </div>

              <p className="therapy-card__summary">{t.summary}</p>

              <div className="therapy-card__foot">
                <span className="evidence-badge" style={{ background: badge.soft, color: badge.color }}>
                  {badge.label}
                </span>
                {t.intakeForm && <span className="therapy-card__meta">Intake form</span>}
              </div>
            </motion.button>
          );
        })}

        <motion.div variants={fadeUp} className="therapy-note">
          <p className="therapy-note__title">These sit beside your medical care</p>
          <p className="therapy-note__body">
            Nothing here replaces a prescription, a scan or a specialist. Tell any practitioner you
            see about every medicine you take — the interactions are real, and they are the reason
            we ask on every form.
          </p>
        </motion.div>

        <div style={{ height: 'var(--sp-4)' }} />
      </motion.div>
    </div>
  );
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0, color: 'var(--clr-ink-subtle)' }}>
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
