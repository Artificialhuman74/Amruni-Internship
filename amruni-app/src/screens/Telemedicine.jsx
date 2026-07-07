import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { SPECIALTIES } from '../data/mock';
import { appointmentApi } from '../services/appointmentApi';
import BottomSheet from '../components/BottomSheet';
import SuccessCheck from '../components/SuccessCheck';
import { confirm } from '../lib/haptics';
import DoctorAvatar from '../components/DoctorAvatar';

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
  const [bookMode, setBookMode] = useState(null); // null | 'video' | 'chat'
  const [booked, setBooked] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search and Sort states
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('default'); // 'default' | 'rating' | 'fee-low' | 'fee-high' | 'experience'

  useEffect(() => {
    async function loadDoctors() {
      try {
        const data = await appointmentApi.getDoctors();
        setDoctors(data);
      } catch (err) {
        console.error('Failed to load doctors', err);
      } finally {
        setLoading(false);
      }
    }
    loadDoctors();
  }, []);

  // Filter & Sort logic
  let filtered = doctors;
  if (specialty !== 'All') {
    filtered = filtered.filter(d => d.specialty.toLowerCase().includes(specialty.toLowerCase()));
  }
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(d => d.name.toLowerCase().includes(q) || d.specialty.toLowerCase().includes(q));
  }

  if (sortBy === 'rating') {
    filtered = [...filtered].sort((a, b) => b.rating - a.rating);
  } else if (sortBy === 'fee-low') {
    filtered = [...filtered].sort((a, b) => {
      const aFee = parseInt(a.fee.replace(/\D/g, '')) || 0;
      const bFee = parseInt(b.fee.replace(/\D/g, '')) || 0;
      return aFee - bFee;
    });
  } else if (sortBy === 'fee-high') {
    filtered = [...filtered].sort((a, b) => {
      const aFee = parseInt(a.fee.replace(/\D/g, '')) || 0;
      const bFee = parseInt(b.fee.replace(/\D/g, '')) || 0;
      return bFee - aFee;
    });
  } else if (sortBy === 'experience') {
    filtered = [...filtered].sort((a, b) => {
      const aExp = parseInt(a.exp.replace(/\D/g, '')) || 0;
      const bExp = parseInt(b.exp.replace(/\D/g, '')) || 0;
      return bExp - aExp;
    });
  }

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
          Verified specialists for women's care
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

        {/* Search and Sort controls */}
        <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-3)' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name..."
              style={{
                width: '100%',
                padding: 'var(--sp-2) var(--sp-3) var(--sp-2) var(--sp-8)',
                borderRadius: 'var(--radius-md)',
                border: '1.5px solid var(--clr-border)',
                background: 'var(--clr-surface-2)',
                color: 'var(--clr-ink)',
                fontSize: 'var(--text-sm)',
                outline: 'none'
              }}
            />
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, opacity: 0.5 }}>🔍</span>
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              padding: 'var(--sp-2) var(--sp-3)',
              borderRadius: 'var(--radius-md)',
              border: '1.5px solid var(--clr-border)',
              background: 'var(--clr-surface-2)',
              color: 'var(--clr-ink)',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="default">Sort: Default</option>
            <option value="rating">★ Highest Rating</option>
            <option value="fee-low">₹ Fee: Low to High</option>
            <option value="fee-high">₹ Fee: High to Low</option>
            <option value="experience">💼 Experience</option>
          </select>
        </div>
      </div>

      {/* Doctor list */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 'var(--sp-12) 0', flex: 1 }}>
          <div className="spinner"></div>
        </div>
      ) : (
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          style={{ padding: 'var(--sp-5) var(--sp-6)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}
        >
          <AnimatePresence mode="popLayout">
            {filtered.map(doc => {
              const videoFeeNum = parseInt(doc.fee.replace(/\D/g, '')) || 0;
              const chatFeeNum = Math.round(videoFeeNum / 3);
              return (
                <motion.div
                  key={doc.id}
                  variants={fadeUp}
                  layout
                  exit={{ opacity: 0, scale: 0.96 }}
                >
                  <div className="doctor-card" onClick={() => navigate(`/doctor/${doc.id}`)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && navigate(`/doctor/${doc.id}`)}>
                    <DoctorAvatar doctor={doc} size={56} />
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
                      {doc.phone && <span style={{ fontSize: 9, color: 'var(--clr-success)', fontWeight: 600 }}>Chat: ₹{chatFeeNum}</span>}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 'var(--sp-12) var(--sp-6)', color: 'var(--clr-ink-muted)' }}>
              <div style={{ fontSize: 48, marginBottom: 'var(--sp-4)' }}>🔍</div>
              <p style={{ fontWeight: 600, color: 'var(--clr-ink)' }}>No doctors found</p>
              <p style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--sp-2)' }}>Try a different specialty or search term</p>
            </div>
          )}
        </motion.div>
      )}

      {/* Doctor detail sheet */}
      <BottomSheet open={!!selected && !bookMode} onClose={() => setSelected(null)} title="">
        {selected && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', marginBottom: 'var(--sp-6)' }}>
              <DoctorAvatar doctor={selected} size={64} />
              <div>
                <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--clr-ink)' }}>{selected.name}</div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginTop: 2 }}>{selected.specialty}</div>
                <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-2)' }}>
                  <span className="doctor-rating">★ {selected.rating} ({selected.reviews} reviews)</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--sp-3)', marginBottom: 'var(--sp-5)' }}>
              {[['🎥', 'Video', 'video'], ...(selected.phone ? [['💬', 'Chat', 'chat']] : [])].map(([icon, label, mode]) => (
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
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)', fontWeight: 500 }}>
                    {mode === 'chat' ? `₹${Math.round(parseInt(selected.fee.replace(/\D/g, '')) / 3)}` : selected.fee}
                  </span>
                </button>
              ))}
            </div>

            <div style={{ background: 'var(--clr-surface-2)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-4)', marginBottom: 'var(--sp-5)' }}>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginBottom: 'var(--sp-2)' }}>Languages</p>
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--clr-ink)' }}>{selected.lang.join(' · ')}</p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyComposite: 'space-between', justifyContent: 'space-between', marginBottom: 'var(--sp-5)' }}>
              <div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)' }}>Next available</p>
                <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--clr-success)', marginTop: 2 }}>{selected.nextSlot}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)' }}>Video fee</p>
                <p style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--clr-ink)', marginTop: 2 }}>{selected.fee}</p>
                {selected.phone && (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)', marginTop: 2 }}>Chat: ₹{Math.round(parseInt(selected.fee.replace(/\D/g, '')) / 3)}</p>
                )}
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
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginTop: 2 }}>{selected.name} · {bookMode === 'chat' ? `₹${Math.round(parseInt(selected.fee.replace(/\D/g, '')) / 3)}` : selected.fee}</p>
                </div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-subtle)', marginBottom: 'var(--sp-5)', lineHeight: 1.6 }}>
                  Your prescription and notes will be available after the consultation, shareable with one tap.
                </p>
                <button className="btn btn--primary" onClick={handleBook}>
                  Confirm booking · {bookMode === 'chat' ? `₹${Math.round(parseInt(selected.fee.replace(/\D/g, '')) / 3)}` : selected.fee}
                </button>
              </>
            )}
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
