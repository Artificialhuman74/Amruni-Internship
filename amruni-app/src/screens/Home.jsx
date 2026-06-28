import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useApp, useCycleData } from '../context/AppContext';
import { PHASE_INFO } from '../data/mock';
import { appointmentApi } from '../services/appointmentApi';
import DoctorAvatar from '../components/DoctorAvatar';

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

  const [appointments, setAppointments] = useState([]);
  const [recommendedDoctors, setRecommendedDoctors] = useState([]);

  // Map lifeStage to Specialty recommendations
  const getTargetSpecialty = (stage) => {
    const mapping = {
      adolescent: 'Gynaecology',
      reproductive: 'Fertility',
      postpartum: 'Pregnancy',
      menopause: 'Menopause',
      elderly: 'Homeopathy'
    };
    return mapping[stage] || 'Gynaecology';
  };

  useEffect(() => {
    async function loadData() {
      try {
        const doctorsList = await appointmentApi.getDoctors();

        // Load and map appointments
        const existing = JSON.parse(localStorage.getItem('amruni_appointments') || '[]');
        
        // Helper to check if appointment is in the past
        const isPastAppointment = (appt) => {
          if (appt.status === 'completed') return true;
          if (!appt.date || !appt.time) return true;
          
          if (appt.time === 'Instant') {
            // Instant chat consultation: completed if created more than 1 hour ago
            if (appt.createdAt) {
              const created = new Date(appt.createdAt);
              const diffMs = new Date().getTime() - created.getTime();
              return diffMs > 3600000; // 1 hour
            }
            return true;
          }
          
          // Video consultation: parse date and time
          const [year, month, day] = appt.date.split('-').map(Number);
          const timeParts = appt.time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
          if (!timeParts) return true;

          let hours = parseInt(timeParts[1], 10);
          const minutes = parseInt(timeParts[2], 10);
          const meridiem = timeParts[3].toUpperCase();

          if (meridiem === 'PM' && hours !== 12) hours += 12;
          if (meridiem === 'AM' && hours === 12) hours = 0;

          const appointmentDate = new Date(year, month - 1, day, hours, minutes, 0);
          const now = new Date();
          
          // Mark past if it is older than 2 hours
          return now.getTime() - appointmentDate.getTime() > 2 * 3600000;
        };

        // Auto-archive past appointments
        let hasChanges = false;
        const updated = existing.map(appt => {
          if (appt.status !== 'completed' && isPastAppointment(appt)) {
            hasChanges = true;
            return { ...appt, status: 'completed' };
          }
          return appt;
        });

        if (hasChanges) {
          localStorage.setItem('amruni_appointments', JSON.stringify(updated));
        }

        const activeAppointments = updated
          .map(appt => {
            const doctor = doctorsList.find(d => d.id === parseInt(appt.doctorId));
            return { ...appt, doctor };
          })
          // Filter out appointments where the doctor was deleted or status is completed
          .filter(appt => !!appt.doctor && appt.status === 'confirmed');
        
        setAppointments(activeAppointments);

        // Get recommendations based on selected lifeStage
        const targetSpecialty = getTargetSpecialty(lifeStage);
        const matching = doctorsList.filter(
          d => d.specialty.toLowerCase() === targetSpecialty.toLowerCase()
        );

        if (matching.length > 0) {
          setRecommendedDoctors(matching.slice(0, 2));
        } else if (doctorsList.length > 0) {
          // Fallback to first two if no matches found
          setRecommendedDoctors(doctorsList.slice(0, 2));
        } else {
          setRecommendedDoctors([]);
        }
      } catch (e) {
        console.error('Failed to load home page data', e);
      }
    }
    loadData();
  }, [lifeStage]);

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
              style={{ width: 40, height: 40, borderRadius: 'var(--radius-full)', background: 'var(--clr-surface)', border: '1px solid var(--clr-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, overflow: 'hidden' }}
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
              <div className="quick-action__icon" style={{ background: 'var(--clr-sky-soft)', fontSize: 20 }}>🩺</div>
              <span className="quick-action__label">Book Consult</span>
            </button>
            {lifeStage !== 'elderly' && (
              <button className="quick-action" onClick={() => navigate('/track')} aria-label="Track cycle or health">
                <div className="quick-action__icon" style={{ background: 'var(--clr-sage-soft)', fontSize: 20 }}>📅</div>
                <span className="quick-action__label">Track Health</span>
              </button>
            )}
            <button className="quick-action" onClick={() => navigate('/help')} aria-label="Get mental health support">
              <div className="quick-action__icon" style={{ background: 'var(--clr-mauve-soft)', fontSize: 20 }}>💬</div>
              <span className="quick-action__label">I Need Help</span>
            </button>
          </div>
        </motion.div>

        {/* Recommended Doctors Section */}
        {recommendedDoctors.length > 0 && (
          <motion.div variants={fadeUp}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-3)' }}>
              <p className="section-title" style={{ margin: 0 }}>Recommended Doctors</p>
              <button 
                onClick={() => navigate('/consult')}
                style={{ background: 'none', border: 'none', color: 'var(--clr-brand)', fontSize: 'var(--text-xs)', fontWeight: 700, cursor: 'pointer' }}
              >
                See All
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              {recommendedDoctors.map((doc) => {
                const videoFeeNum = parseInt(doc.fee.replace(/\D/g, '')) || 0;
                const chatFeeNum = Math.round(videoFeeNum / 3);
                return (
                  <div 
                    key={doc.id}
                    className="doctor-card"
                    onClick={() => navigate(`/doctor/${doc.id}`)}
                    style={{ background: 'var(--clr-surface-2)', padding: 'var(--sp-3) var(--sp-4)' }}
                  >
                    <DoctorAvatar doctor={doc} size={48} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="doctor-name" style={{ fontSize: 'var(--text-sm)' }}>{doc.name}</div>
                      <div className="doctor-specialty" style={{ fontSize: 'var(--text-xs)' }}>{doc.specialty} · {doc.exp}</div>
                      <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 4, alignItems: 'center' }}>
                        <span className="doctor-rating" style={{ fontSize: 10 }}>★ {doc.rating}</span>
                        <span style={{ fontSize: 10, color: 'var(--clr-ink-subtle)' }}>({doc.reviews} reviews)</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--clr-ink)' }}>{doc.fee}</div>
                      {doc.phone && <div style={{ fontSize: 10, color: 'var(--clr-success)', fontWeight: 600, marginTop: 2 }}>Chat: ₹{chatFeeNum}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Upcoming appointments */}
        {appointments.length > 0 && (
          <motion.div variants={fadeUp}>
            <p className="section-title">Upcoming</p>
            <div className="gap-stack">
              {appointments.map((appt) => {
                const parts = (appt.time || '').split(' ');
                const timeStr = parts[0] || '12:00';
                const ampmStr = parts[1] || 'PM';
                const isChat = appt.consultMode === 'chat';
                return (
                  <div
                    key={appt.appointmentId}
                    className="appt-card"
                    onClick={() => navigate(`/waiting/${appt.appointmentId}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/waiting/${appt.appointmentId}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="appt-time-block">
                      <div className="appt-time">{timeStr}</div>
                      <div className="appt-ampm">{ampmStr}</div>
                    </div>
                    <div className="appt-divider" />
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                      <DoctorAvatar doctor={appt.doctor} size={40} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="appt-doctor" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {appt.doctor?.name || 'Doctor'}
                        </div>
                        <div className="appt-type" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {appt.doctor?.specialty || 'Consultation'} · {appt.date}
                        </div>
                      </div>
                    </div>
                    <span className={`appt-badge appt-badge--${isChat ? 'chat' : 'video'}`}>
                      {isChat ? 'Chat' : 'Video'}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

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
