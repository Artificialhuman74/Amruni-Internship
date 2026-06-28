import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { appointmentApi } from '../services/appointmentApi';
import { useVideoCall } from '../hooks/useVideoCall';
import { confirm } from '../lib/haptics';
import DoctorAvatar from '../components/DoctorAvatar';

export default function WaitingRoom() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const { setActiveAppointment } = useVideoCall();
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [doctorReady, setDoctorReady] = useState(false);

  // Calculate seconds until the scheduled appointment time
  const calcSecondsUntilAppointment = useCallback((appt) => {
    if (!appt?.date || !appt?.time) return 0;

    // Parse date: "2026-06-28"
    const [year, month, day] = appt.date.split('-').map(Number);

    // Parse time: "10:30 AM" / "02:30 PM"
    const timeParts = appt.time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!timeParts) return 0;

    let hours = parseInt(timeParts[1], 10);
    const minutes = parseInt(timeParts[2], 10);
    const meridiem = timeParts[3].toUpperCase();

    if (meridiem === 'PM' && hours !== 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;

    const appointmentDate = new Date(year, month - 1, day, hours, minutes, 0);
    const now = new Date();
    const diffMs = appointmentDate.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffMs / 1000));
  }, []);

  useEffect(() => {
    async function loadAppointment() {
      try {
        const appt = await appointmentApi.getAppointment(appointmentId);
        setAppointment(appt);
        setActiveAppointment(appt);

        // Calculate real countdown
        const secs = calcSecondsUntilAppointment(appt);
        if (secs <= 0) {
          // Appointment time already passed or is now — doctor is ready
          setSecondsLeft(0);
          setDoctorReady(true);
          confirm();
        } else {
          setSecondsLeft(secs);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadAppointment();
  }, [appointmentId, setActiveAppointment, calcSecondsUntilAppointment]);

  // Countdown timer — ticks every second until 0
  useEffect(() => {
    if (loading || secondsLeft === null || doctorReady) return;
    if (secondsLeft <= 0) {
      setDoctorReady(true);
      confirm();
      return;
    }
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setDoctorReady(true);
          confirm();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [loading, secondsLeft, doctorReady]);

  const handleCancel = async () => {
    if (window.confirm('Are you sure you want to cancel this appointment?')) {
      await appointmentApi.cancelAppointment(appointmentId);
      navigate('/consult');
    }
  };

  const handleJoin = () => {
    const isChat = appointment?.consultMode === 'chat';
    if (isChat && appointment?.doctor?.phone) {
      // Open WhatsApp with the doctor's number
      const phone = appointment.doctor.phone.replace(/\D/g, '');
      const message = encodeURIComponent(
        `Hi ${appointment.doctor.name}, I have a consultation appointment (ID: ${appointment.appointmentId}). I'd like to start our chat session.`
      );
      window.open(`https://wa.me/91${phone}?text=${message}`, '_blank');
      navigate(`/consultation/${appointmentId}`);
    } else if (appointment?.doctor?.meetLink) {
      window.open(appointment.doctor.meetLink, '_blank');
      navigate(`/consultation/${appointmentId}`);
    } else {
      navigate(`/video/${appointmentId}`);
    }
  };

  const formatTime = (secs) => {
    if (secs === null) return '--:--';
    if (secs >= 3600) {
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
      const s = (secs % 60).toString().padStart(2, '0');
      return `${h}:${m}:${s}`;
    }
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (loading) {
    return (
      <div className="screen screen--light" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="screen screen--light" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--sp-6)' }}>
        <p style={{ fontWeight: 600, color: 'var(--clr-ink)' }}>No active appointment found.</p>
        <button className="btn btn--primary" style={{ marginTop: 'var(--sp-4)' }} onClick={() => navigate('/consult')}>
          Back to Consult
        </button>
      </div>
    );
  }

  const doctorName = appointment.doctor?.name || 'Doctor';
  const doctorAvatar = appointment.doctor?.avatar || '🩺';
  const isChat = appointment.consultMode === 'chat';
  const joinLabel = isChat ? 'Open WhatsApp Chat' : 'Join Video Call';
  const joinIcon = isChat ? '💬' : '🎥';

  return (
    <div className="screen screen--light" style={{ justifyContent: 'space-between', padding: 'var(--sp-5) var(--sp-6) calc(env(safe-area-inset-bottom) + var(--sp-6))' }}>
      {/* Header */}
      <div className="screen-header-nav" style={{ border: 'none' }}>
        <button className="nav-back-btn" onClick={() => navigate('/consult')} aria-label="Go back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>
        <span className="nav-header-title">Waiting Room</span>
        <div style={{ width: 40 }} />
      </div>

      {/* Main Status Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 'var(--sp-4) 0' }}>
        {/* Heartbeat animated icon */}
        <div className={`waiting-status-icon ${doctorReady ? 'waiting-status-icon--ready' : 'waiting-status-icon--pulsing'}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <DoctorAvatar doctor={appointment.doctor} size={72} style={{ border: 'none' }} />
        </div>

        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--clr-ink)', marginTop: 'var(--sp-6)', lineHeight: 1.3 }}>
          {isChat ? 'Chat Session Ready!' : doctorReady ? 'Doctor is ready!' : 'Appointment Confirmed'}
        </h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginTop: 'var(--sp-2)', maxWidth: '28ch' }}>
          {isChat
            ? `Your instant chat channel with ${doctorName} is active. Click below to start.`
            : doctorReady
            ? `${doctorName} is available. You can join the consultation now.`
            : `Your video consultation with ${doctorName} is scheduled. Countdown to appointment time.`}
        </p>

        {/* Consultation mode badge */}
        <div style={{
          marginTop: 'var(--sp-4)',
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: 'var(--sp-2) var(--sp-4)', borderRadius: 'var(--radius-pill)',
          background: isChat ? 'oklch(0.95 0.04 150)' : 'oklch(0.95 0.04 260)',
          border: `1px solid ${isChat ? 'oklch(0.85 0.08 150)' : 'oklch(0.85 0.08 260)'}`,
          fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--clr-ink)'
        }}>
          {joinIcon} {isChat ? 'Chat / DM' : 'Video Call'} {appointment.fee && `· ${appointment.fee}`}
        </div>

        {/* Timer Box / Chat Info Box */}
        {isChat ? (
          <div style={{
            marginTop: 'var(--sp-6)',
            background: 'var(--clr-surface-2)',
            border: '1.5px solid var(--clr-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--sp-4) var(--sp-6)',
            boxShadow: 'var(--shadow-sm)',
            maxWidth: '300px'
          }}>
            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--clr-success)' }}>
              💬 Instant Connect
            </p>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)', marginTop: 4, lineHeight: 1.4 }}>
              Click below to initiate your WhatsApp chat with {doctorName}.
            </p>
          </div>
        ) : (
          <>
            <div style={{
              marginTop: 'var(--sp-6)',
              background: 'var(--clr-surface-2)',
              border: '1.5px solid var(--clr-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--sp-4) var(--sp-8)',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {doctorReady ? 'Ready now' : 'Time until appointment'}
              </p>
              <p style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: doctorReady ? 'var(--clr-success)' : 'var(--clr-brand)', marginTop: 4, fontFamily: 'monospace' }}>
                {doctorReady ? '00:00' : formatTime(secondsLeft)}
              </p>
            </div>

            {/* Scheduled time info */}
            {appointment.date && appointment.time && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-subtle)', marginTop: 'var(--sp-3)' }}>
                Scheduled: {appointment.date} at {appointment.time}
              </p>
            )}
          </>
        )}
      </div>

      {/* Action Footer */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
        {isChat || doctorReady ? (
          <button className="btn btn--primary btn-pulse-effect" onClick={handleJoin}>
            {joinIcon} {joinLabel}
          </button>
        ) : (
          <button className="btn btn--secondary" disabled style={{ opacity: 0.6, cursor: 'not-allowed' }}>
            Waiting for appointment time...
          </button>
        )}
        <button
          onClick={handleCancel}
          style={{
            color: 'var(--clr-brand)', fontSize: 'var(--text-sm)', fontWeight: 600,
            padding: 'var(--sp-3) 0', border: 'none', cursor: 'pointer', textAlign: 'center'
          }}
        >
          Cancel Appointment
        </button>
      </div>
    </div>
  );
}
