import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { DOCTORS, SPECIALTIES } from '../data/mock';
import BottomSheet from '../components/BottomSheet';
import SuccessCheck from '../components/SuccessCheck';
import { confirm } from '../lib/haptics';

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
};

export default function Telemedicine() {
  const navigate = useNavigate();
  const [specialty, setSpecialty] = useState('All');
  const [selected, setSelected] = useState(null);
  const [bookMode, setBookMode] = useState(null); // null | 'video' | 'audio' | 'chat'
  const [booked, setBooked] = useState(false);

  const filtered = specialty === 'All'
    ? DOCTORS
    : DOCTORS.filter(d => d.specialty.toLowerCase().includes(specialty.toLowerCase()));

  async function handleBook() {
    await new Promise(r => setTimeout(r, 900));
    setBooked(true);
    confirm();
    setTimeout(() => {
      setBooked(false);
      setSelected(null);
      setBookMode(null);
    }, 2000);
  }

  return (
    <div className="screen screen--light">
      {/* Fixed header */}
      <div style={{
        padding: 'calc(env(safe-area-inset-top) + var(--sp-5)) var(--sp-6) var(--sp-4)',
        background: 'var(--clr-surface)',
        borderBottom: '1px solid var(--clr-border)',
        position: 'sticky',
        top: 0,
        zIndex: 'var(--z-sticky)',
      }}>
        <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--clr-ink)' }}>
          Consult a doctor
        </h1>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginTop: 2 }}>
          Verified women's health specialists
        </p>

        {/* Specialty filter */}
        <div style={{ display: 'flex', gap: 'var(--sp-2)', overflowX: 'auto', marginTop: 'var(--sp-4)', paddingBottom: 2, scrollbarWidth: 'none' }}>
          {SPECIALTIES.map(s => (
            <button
              key={s}
              className={`chip chip--sm${specialty === s ? ' chip--active' : ''}`}
              onClick={() => setSpecialty(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Doctor list */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        style={{ padding: 'var(--sp-5) var(--sp-6)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}
      >
        <AnimatePresence mode="popLayout">
          {filtered.map(doc => (
            <motion.div
              key={doc.id}
              variants={fadeUp}
              layout
              exit={{ opacity: 0, scale: 0.96 }}
            >
              <div className="doctor-card" onClick={() => setSelected(doc)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setSelected(doc)}>
                <div className="doctor-avatar">{doc.avatar}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="doctor-name">{doc.name}</div>
                  <div className="doctor-specialty">{doc.specialty}</div>
                  <div className="doctor-meta">
                    <span className="doctor-rating">★ {doc.rating}</span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-subtle)' }}>·</span>
                    <span className="doctor-avail">{doc.nextSlot}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 'var(--sp-2)', flexShrink: 0 }}>
                  <span style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--clr-ink)' }}>{doc.fee}</span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-subtle)' }}>{doc.exp} exp</span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 'var(--sp-12) var(--sp-6)', color: 'var(--clr-ink-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 'var(--sp-4)' }}>🔍</div>
            <p style={{ fontWeight: 600, color: 'var(--clr-ink)' }}>No doctors found</p>
            <p style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--sp-2)' }}>Try a different specialty filter</p>
          </div>
        )}
      </motion.div>

      {/* Doctor detail sheet */}
      <BottomSheet open={!!selected && !bookMode} onClose={() => setSelected(null)} title="">
        {selected && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', marginBottom: 'var(--sp-6)' }}>
              <div style={{ width: 64, height: 64, borderRadius: 'var(--radius-lg)', background: 'var(--clr-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>
                {selected.avatar}
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--clr-ink)' }}>{selected.name}</div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginTop: 2 }}>{selected.specialty}</div>
                <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-2)' }}>
                  <span className="doctor-rating">★ {selected.rating} ({selected.reviews} reviews)</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--sp-3)', marginBottom: 'var(--sp-5)' }}>
              {[['🎥', 'Video', 'video'], ['🎙️', 'Audio', 'audio'], ['💬', 'Chat', 'chat']].map(([icon, label, mode]) => (
                <button
                  key={mode}
                  onClick={() => setBookMode(mode)}
                  style={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: 'var(--sp-2)', padding: 'var(--sp-4) var(--sp-3)',
                    background: 'var(--clr-surface-2)', borderRadius: 'var(--radius-lg)',
                    border: '1.5px solid var(--clr-border)', cursor: 'pointer',
                    fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--clr-ink)',
                    transition: 'background var(--dur-fast)',
                  }}
                >
                  <span style={{ fontSize: 20 }}>{icon}</span>
                  {label}
                </button>
              ))}
            </div>

            <div style={{ background: 'var(--clr-surface-2)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-4)', marginBottom: 'var(--sp-5)' }}>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginBottom: 'var(--sp-2)' }}>Languages</p>
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--clr-ink)' }}>{selected.lang.join(' · ')}</p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-5)' }}>
              <div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)' }}>Next available</p>
                <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--clr-success)', marginTop: 2 }}>{selected.nextSlot}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)' }}>Consultation fee</p>
                <p style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--clr-ink)', marginTop: 2 }}>{selected.fee}</p>
              </div>
            </div>
          </div>
        )}
      </BottomSheet>

      {/* Booking mode sheet */}
      <BottomSheet open={!!bookMode} onClose={() => setBookMode(null)} title={`Book ${bookMode} consultation`}>
        {selected && bookMode && (
          <div>
            {booked ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                style={{ textAlign: 'center', padding: 'var(--sp-8) 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
              >
                <div style={{ marginBottom: 'var(--sp-5)' }}>
                  <SuccessCheck size={64} />
                </div>
                <p style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--clr-ink)' }}>Appointment booked</p>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginTop: 'var(--sp-2)' }}>
                  {selected.name} · {selected.nextSlot}
                </p>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginTop: 'var(--sp-2)' }}>
                  We’ll send a reminder before it starts.
                </p>
              </motion.div>
            ) : (
              <>
                <div style={{ background: 'var(--clr-surface-2)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-4)', marginBottom: 'var(--sp-5)' }}>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)' }}>Appointment slot</p>
                  <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--clr-ink)', marginTop: 4 }}>{selected.nextSlot}</p>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginTop: 2 }}>{selected.name} · {selected.fee}</p>
                </div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-subtle)', marginBottom: 'var(--sp-5)', lineHeight: 1.6 }}>
                  Your prescription and notes will be available after the consultation, shareable with one tap.
                </p>
                <button className="btn btn--primary" onClick={handleBook}>
                  Confirm booking · {selected.fee}
                </button>
              </>
            )}
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
