import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp, useCycleData } from '../context/AppContext';
import { PHASE_INFO } from '../data/mock';

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.16, 1, 0.3, 1] } },
};

export default function Home() {
  const navigate = useNavigate();
  const { state } = useApp();
  const { name, lifeStage } = state.user;
  const cycleData = useCycleData(state);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="screen screen--light">
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        style={{ padding: 'var(--sp-6)', paddingTop: 'calc(env(safe-area-inset-top) + var(--sp-6))', display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}
      >
        {/* Greeting */}
        <motion.div variants={fadeUp}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', fontWeight: 500 }}>
                {greeting}
              </p>
              <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--clr-ink)', marginTop: 2 }}>
                {name || 'Welcome back'} <span className="greeting-wave" aria-hidden="true">👋</span>
              </h1>
            </div>
            <button
              onClick={() => navigate('/settings')}
              style={{ width: 40, height: 40, borderRadius: 'var(--radius-full)', background: 'var(--clr-surface)', border: '1px solid var(--clr-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}
              aria-label="Profile settings"
            >
              {avatarFor(lifeStage)}
            </button>
          </div>
        </motion.div>

        {/* Phase / cycle widget */}
        {(lifeStage === 'reproductive' || lifeStage === 'adolescent') && cycleData.phase && (
          <motion.div variants={fadeUp}>
            <button
              onClick={() => navigate('/track')}
              className={`phase-banner phase-banner--${cycleData.phase}`}
              style={{ width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer' }}
              aria-label={`Cycle phase: ${PHASE_INFO[cycleData.phase]?.name}`}
            >
              <div className="phase-banner__icon">{PHASE_INFO[cycleData.phase]?.icon}</div>
              <div style={{ flex: 1 }}>
                <div className="phase-banner__day">Day {cycleData.cycleDay} of cycle</div>
                <div className="phase-banner__name">{PHASE_INFO[cycleData.phase]?.name}</div>
                <div className="phase-banner__desc">{PHASE_INFO[cycleData.phase]?.desc}</div>
              </div>
              <ChevronRight />
            </button>
          </motion.div>
        )}

        {lifeStage === 'postpartum' && (
          <motion.div variants={fadeUp}>
            <div style={{ background: 'var(--clr-brand-soft)', borderRadius: 'var(--radius-lg)', padding: 'var(--sp-4) var(--sp-5)', display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
              <div style={{ fontSize: 28 }}>🤱</div>
              <div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--clr-ink)' }}>Post-partum care</div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginTop: 2 }}>How are you feeling today?</div>
              </div>
              <button onClick={() => navigate('/help')} className="btn btn--primary btn--sm" style={{ marginLeft: 'auto', flexShrink: 0, width: 'auto' }}>
                Check in
              </button>
            </div>
          </motion.div>
        )}

        {/* Quick actions */}
        <motion.div variants={fadeUp}>
          <p className="section-title">Quick actions</p>
          <div className="quick-actions">
            <button className="quick-action" onClick={() => navigate('/consult')} aria-label="Book a consultation">
              <div className="quick-action__icon" style={{ background: 'var(--clr-sky-soft)' }}>🩺</div>
              <span className="quick-action__label">Book Consult</span>
            </button>
            {lifeStage !== 'elderly' && (
              <button className="quick-action" onClick={() => navigate('/track')} aria-label="Track cycle or health">
                <div className="quick-action__icon" style={{ background: 'var(--clr-sage-soft)' }}>📅</div>
                <span className="quick-action__label">Track Health</span>
              </button>
            )}
            <button className="quick-action" onClick={() => navigate('/help')} aria-label="Get mental health support">
              <div className="quick-action__icon" style={{ background: 'var(--clr-mauve-soft)' }}>💬</div>
              <span className="quick-action__label">I Need Help</span>
            </button>
          </div>
        </motion.div>

        {/* Upcoming appointments */}
        <motion.div variants={fadeUp}>
          <p className="section-title">Upcoming</p>
          <div className="gap-stack">
            <div className="appt-card">
              <div className="appt-time-block">
                <div className="appt-time">3:00</div>
                <div className="appt-ampm">PM</div>
              </div>
              <div className="appt-divider" />
              <div style={{ flex: 1 }}>
                <div className="appt-doctor">Dr. Priya Nair</div>
                <div className="appt-type">Gynaecology · Today</div>
              </div>
              <span className="appt-badge appt-badge--video">Video</span>
            </div>
            <div className="appt-card">
              <div className="appt-time-block">
                <div className="appt-time">10:30</div>
                <div className="appt-ampm">AM</div>
              </div>
              <div className="appt-divider" />
              <div style={{ flex: 1 }}>
                <div className="appt-doctor">Dr. Meena Krishnan</div>
                <div className="appt-type">Mental Health · Tomorrow</div>
              </div>
              <span className="appt-badge appt-badge--chat">Chat</span>
            </div>
          </div>
        </motion.div>

        {/* Health tip */}
        <motion.div variants={fadeUp}>
          <div style={{
            background: 'var(--clr-dark)',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--sp-5)',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--clr-gold)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 'var(--sp-2)' }}>
                Today's insight
              </p>
              <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--clr-ink-on-dark)', lineHeight: 'var(--leading-snug)', textWrap: 'pretty' }}>
                {tipFor(lifeStage)}
              </p>
            </div>
            <div style={{ position: 'absolute', right: -20, bottom: -20, fontSize: 80, opacity: 0.08 }} aria-hidden="true">
              🌺
            </div>
          </div>
        </motion.div>

        {/* Bottom padding for nav */}
        <div style={{ height: 'var(--sp-4)' }} />
      </motion.div>
    </div>
  );
}

function avatarFor(lifeStage) {
  const map = { adolescent: '🌱', reproductive: '🌸', postpartum: '🤱', menopause: '🌺', elderly: '🏡' };
  return map[lifeStage] ?? '👤';
}

function tipFor(lifeStage) {
  const tips = {
    adolescent: 'Iron-rich foods like spinach and lentils can help during and after your period.',
    reproductive: 'Tracking your cycle for 3 months gives you a clearer picture of your hormonal patterns.',
    postpartum: 'PPD affects 1 in 7 mothers. Feeling low or anxious is not weakness — support is here.',
    menopause: 'Weight-bearing exercise 3× a week significantly supports bone density through menopause.',
    elderly: 'Staying connected socially is one of the strongest predictors of healthy ageing.',
  };
  return tips[lifeStage] ?? 'Your health is worth investing in. Amruni is here every step of the way.';
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0, color: 'var(--clr-ink-subtle)' }}>
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
