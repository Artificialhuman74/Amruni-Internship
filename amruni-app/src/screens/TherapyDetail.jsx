import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { THERAPY_BY_ID, EVIDENCE_BADGE } from '../data/therapies';
import { IconLeaf, IconSprout, IconWellness, IconCheck, IconAlert, IconLink, IconRecords } from '../icons.jsx';
import { article } from '../lib/text';

const ICONS = { leaf: IconLeaf, sprout: IconSprout, wellness: IconWellness };

/**
 * One therapy in full: what it is, what a session is like, what it helps with,
 * what the evidence actually says, and what to be careful of.
 *
 * `caution` is not a disclaimer at the bottom. It sits above the booking
 * button, because the herb-drug interaction it warns about is only useful to a
 * woman who reads it before she books, not after.
 */
export default function TherapyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const t = THERAPY_BY_ID[id];

  if (!t) return <Navigate to="/therapies" replace />;

  const Icon = ICONS[t.icon];
  const badge = EVIDENCE_BADGE[t.evidence.level];

  return (
    <div className="screen screen--light">
      <div className="screen-header-nav">
        <button className="nav-back-btn" onClick={() => navigate('/therapies')} aria-label="Go back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <span className="nav-header-title">{t.name}</span>
        <div style={{ width: 40 }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        style={{ padding: 'var(--sp-5) var(--sp-6) var(--sp-8)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}
      >
        <div className="therapy-hero" style={{ background: t.soft }}>
          <div className="therapy-hero__icon" style={{ color: t.color }}><Icon size={32} /></div>
          <p className="therapy-hero__tagline" style={{ color: t.color }}>{t.tagline}</p>
          <p className="therapy-hero__summary">{t.summary}</p>
        </div>

        <Section title="What a session is like">
          <p className="therapy-prose">{t.session}</p>
        </Section>

        {t.tracks && (
          <Section title="Practices we run">
            <div className="therapy-tracks">
              {t.tracks.map((track) => (
                <div key={track.id} className="therapy-track">
                  <p className="therapy-track__label">{track.label}</p>
                  <p className="therapy-track__desc">{track.desc}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        <Section title="Commonly helps with">
          <ul className="therapy-list">
            {t.helpsWith.map((item) => (
              <li key={item}>
                <span className="therapy-list__tick" style={{ color: t.color }}><IconCheck size={15} /></span>
                {item}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="What the evidence says">
          <span className="evidence-badge" style={{ background: badge.soft, color: badge.color }}>
            {badge.label}
          </span>
          <p className="therapy-prose" style={{ marginTop: 'var(--sp-3)' }}>{t.evidence.note}</p>
        </Section>

        {/* Above the CTA on purpose — see the file header. */}
        <div className="therapy-caution" role="note">
          <span className="therapy-caution__icon"><IconAlert size={18} /></span>
          <div>
            <p className="therapy-caution__title">Before you book</p>
            <p className="therapy-caution__body">{t.caution}</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          {t.intakeForm && (
            <button
              className="btn btn--secondary"
              onClick={() => navigate(`/intake/${t.intakeForm}`)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--sp-2)' }}
            >
              <IconRecords size={17} /> Fill the {t.name.toLowerCase()} intake form
            </button>
          )}
          <button
            className="btn btn--primary"
            onClick={() => navigate(`/consult?specialty=${encodeURIComponent(t.specialty)}`)}
          >
            Find {article(t.name)} {t.name.toLowerCase()} practitioner
          </button>
        </div>

        {t.links.length > 0 && (
          <Section title="Read more">
            <div className="therapy-links">
              {t.links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="therapy-link"
                >
                  <IconLink size={15} />
                  <span>{link.label}</span>
                </a>
              ))}
            </div>
            <p className="therapy-links__note">
              Government and council sources. They open outside Amruni.
            </p>
          </Section>
        )}
      </motion.div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section>
      <p className="section-title">{title}</p>
      {children}
    </section>
  );
}
