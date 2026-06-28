import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { appointmentApi } from '../services/appointmentApi';
import { useVideoCall } from '../hooks/useVideoCall';
import DoctorAvatar from '../components/DoctorAvatar';

export default function DoctorProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { initiateBooking } = useVideoCall();
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDoctor() {
      try {
        const doc = await appointmentApi.getDoctorById(id);
        setDoctor(doc);
        initiateBooking(doc);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadDoctor();
  }, [id, initiateBooking]);

  if (loading) {
    return (
      <div className="screen screen--light" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="screen screen--light" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--sp-6)' }}>
        <p style={{ fontWeight: 600, color: 'var(--clr-ink)' }}>Doctor not found</p>
        <button className="btn btn--primary" style={{ marginTop: 'var(--sp-4)' }} onClick={() => navigate('/consult')}>
          Back to Doctors
        </button>
      </div>
    );
  }

  // Calculate chat fee as ⅓ of video fee
  const videoFeeNum = parseInt(doctor.fee.replace(/\D/g, '')) || 0;
  const chatFeeNum = Math.round(videoFeeNum / 3);
  const hasChatEnabled = !!doctor.phone;

  const handleBookClick = (mode) => {
    initiateBooking(doctor);
    const fee = mode === 'chat' ? chatFeeNum : videoFeeNum;
    navigate(`/appointment/${doctor.id}?mode=${mode}&fee=${fee}`);
  };

  return (
    <div className="screen screen--light">
      {/* Header */}
      <div className="screen-header-nav">
        <button className="nav-back-btn" onClick={() => navigate('/consult')} aria-label="Go back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>
        <span className="nav-header-title">Doctor Profile</span>
        <div style={{ width: 40 }} /> {/* Spacer */}
      </div>

      <div style={{ padding: '0 var(--sp-6) var(--sp-20)' }}>
        {/* Main Details card */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', margin: 'var(--sp-6) 0' }}>
          <DoctorAvatar doctor={doctor} size={80} />
          <div>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--clr-ink)' }}>{doctor.name}</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginTop: 2 }}>{doctor.specialty}</div>
            <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-2)', alignItems: 'center' }}>
              <span className="doctor-rating">★ {doctor.rating}</span>
              {doctor.reviews > 0 && (
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-subtle)' }}>({doctor.reviews} reviews)</span>
              )}
            </div>
          </div>
        </div>

        {/* Highlight Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-2)', marginBottom: 'var(--sp-6)' }}>
          {[
            { label: 'Experience', value: doctor.exp },
            { label: 'Video Fee', value: doctor.fee },
            { label: 'Chat Fee', value: hasChatEnabled ? `₹${chatFeeNum}` : '—' }
          ].map((item, idx) => (
            <div key={idx} style={{ background: 'var(--clr-surface-2)', border: '1px solid var(--clr-border)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-3)', textAlign: 'center' }}>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)' }}>{item.label}</p>
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--clr-ink)', marginTop: 4 }}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* Bio */}
        <div style={{ marginBottom: 'var(--sp-6)' }}>
          <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--clr-ink)', marginBottom: 'var(--sp-2)' }}>About Doctor</h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', lineHeight: 1.6 }}>
            {doctor.name} is a highly accomplished {doctor.specialty} with over {doctor.exp} of dedicated experience. Specializes in comprehensive health consultation, care management, and personalized support.
          </p>
        </div>

        {/* Services Info */}
        <div style={{ background: 'var(--clr-surface-2)', borderRadius: 'var(--radius-lg)', padding: 'var(--sp-4) var(--sp-5)', border: '1px solid var(--clr-border)', marginBottom: 'var(--sp-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-3)' }}>
            <span style={{ fontSize: 20 }}>🎥</span>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--clr-ink)' }}>Video Consultation</h3>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)', marginTop: 2 }}>Secure video call via Google Meet · {doctor.fee}</p>
            </div>
          </div>
          {hasChatEnabled && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-3)' }}>
              <span style={{ fontSize: 20 }}>💬</span>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--clr-ink)' }}>Chat / DM Consultation</h3>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)', marginTop: 2 }}>WhatsApp chat with doctor · ₹{chatFeeNum}</p>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
            <span style={{ fontSize: 20 }}>🌐</span>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--clr-ink)' }}>Languages Spoken</h3>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)', marginTop: 2 }}>{doctor.lang.join(', ')}</p>
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        {doctor.reviews > 0 && (
          <div>
            <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--clr-ink)', marginBottom: 'var(--sp-4)' }}>Patient Reviews</h2>
            <div style={{ textAlign: 'center', padding: 'var(--sp-6)', color: 'var(--clr-ink-muted)', background: 'var(--clr-surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--clr-border)' }}>
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>★ {doctor.rating} · {doctor.reviews} reviews</p>
              <p style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--sp-2)' }}>Reviews from verified patients will appear here.</p>
            </div>
          </div>
        )}
      </div>

      {/* Sticky Bottom Booking Buttons */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 430, background: 'var(--clr-surface)',
        borderTop: '1px solid var(--clr-border)', padding: 'var(--sp-3) var(--sp-6) calc(env(safe-area-inset-bottom) + var(--sp-3))',
        zIndex: 50, display: 'flex', gap: 'var(--sp-3)'
      }}>
        <button
          className="btn btn--primary"
          onClick={() => handleBookClick('video')}
          style={{ flex: hasChatEnabled ? 1 : '1 1 100%' }}
        >
          🎥 Video · {doctor.fee}
        </button>
        {hasChatEnabled && (
          <button
            className="btn btn--secondary"
            onClick={() => handleBookClick('chat')}
            style={{ flex: 1, fontWeight: 700 }}
          >
            💬 Chat · ₹{chatFeeNum}
          </button>
        )}
      </div>
    </div>
  );
}
