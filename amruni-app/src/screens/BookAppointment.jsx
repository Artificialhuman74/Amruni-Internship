import { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useVideoCall } from '../hooks/useVideoCall';
import DoctorAvatar from '../components/DoctorAvatar';

export default function BookAppointment() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentDoctor, confirmBooking } = useVideoCall();
  const [selectedDate, setSelectedDate] = useState(0); // Index of dates array
  const [selectedTime, setSelectedTime] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Read consultation mode and fee from URL params
  const consultMode = searchParams.get('mode') || 'video';
  const fee = searchParams.get('fee') || '';

  // Generate 6 days starting from today
  const getDates = () => {
    const dates = [];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const localYear = d.getFullYear();
      const localMonth = String(d.getMonth() + 1).padStart(2, '0');
      const localDay = String(d.getDate()).padStart(2, '0');
      const fullString = `${localYear}-${localMonth}-${localDay}`;
      
      dates.push({
        dayName: days[d.getDay()],
        dayNum: d.getDate(),
        month: months[d.getMonth()],
        fullString
      });
    }
    return dates;
  };

  const dates = getDates();
  const timeSlots = ['10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM'];

  const handleBook = async () => {
    if (consultMode === 'video' && !selectedTime) return;
    setSubmitting(true);
    try {
      const apptDate = consultMode === 'chat'
        ? (() => {
            const d = new Date();
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
          })()
        : dates[selectedDate].fullString;
      const apptTime = consultMode === 'chat' ? 'Instant' : selectedTime;
      const feeStr = fee ? `₹${fee}` : '';
      const apptId = await confirmBooking(apptDate, apptTime, reason, consultMode, feeStr);
      
      if (apptId) {
        // Go to waiting room
        navigate(`/waiting/${apptId}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const doctorName = currentDoctor?.name || 'Doctor';
  const doctorAvatar = currentDoctor?.avatar || '🩺';
  const doctorSpecialty = currentDoctor?.specialty || 'Specialist';
  const modeLabel = consultMode === 'chat' ? '💬 Chat / DM' : '🎥 Video Call';
  const feeLabel = fee ? `₹${fee}` : '';

  return (
    <div className="screen screen--light">
      {/* Header */}
      <div className="screen-header-nav">
        <button className="nav-back-btn" onClick={() => navigate(`/doctor/${id}`)} aria-label="Go back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>
        <span className="nav-header-title">Book Appointment</span>
        <div style={{ width: 40 }} />
      </div>

      <div style={{ padding: 'var(--sp-5) var(--sp-6) var(--sp-24)' }}>
        {/* Doctor Context Summary */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', background: 'var(--clr-surface-2)', padding: 'var(--sp-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--clr-border)', marginBottom: 'var(--sp-4)' }}>
          <DoctorAvatar doctor={currentDoctor} size={48} />
          <div style={{ flex: 1 }}>
            <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--clr-ink)' }}>{doctorName}</h4>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)' }}>{doctorSpecialty}</p>
          </div>
        </div>

        {/* Consultation Mode Badge */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: consultMode === 'chat' ? 'oklch(0.95 0.04 150)' : 'oklch(0.95 0.04 260)',
          padding: 'var(--sp-3) var(--sp-4)', borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--sp-6)', border: `1.5px solid ${consultMode === 'chat' ? 'oklch(0.85 0.08 150)' : 'oklch(0.85 0.08 260)'}`
        }}>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--clr-ink)' }}>{modeLabel}</span>
          {feeLabel && <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--clr-ink)' }}>{feeLabel}</span>}
        </div>

        {/* Date & Time Selectors - Only shown for Video consultations */}
        {consultMode === 'video' && (
          <>
            {/* Date Selector */}
            <div style={{ marginBottom: 'var(--sp-6)' }}>
              <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--clr-ink)', marginBottom: 'var(--sp-3)' }}>Choose Date</h3>
              <div style={{ display: 'flex', gap: 'var(--sp-2)', overflowX: 'auto', paddingBottom: 'var(--sp-2)', scrollbarWidth: 'none' }}>
                {dates.map((d, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedDate(index)}
                    style={{
                      flexShrink: 0, width: 62, height: 74, borderRadius: 'var(--radius-md)',
                      background: selectedDate === index ? 'var(--clr-brand)' : 'var(--clr-surface-2)',
                      border: `1.5px solid ${selectedDate === index ? 'var(--clr-brand)' : 'var(--clr-border)'}`,
                      color: selectedDate === index ? 'var(--clr-ink-on-dark)' : 'var(--clr-ink)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', transition: 'all var(--dur-fast) ease',
                    }}
                  >
                    <span style={{ fontSize: 'var(--text-xs)', opacity: selectedDate === index ? 0.9 : 0.6, textTransform: 'uppercase' }}>{d.dayName}</span>
                    <span style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginTop: 4 }}>{d.dayNum}</span>
                    <span style={{ fontSize: 'var(--text-xs)', opacity: selectedDate === index ? 0.9 : 0.6, marginTop: 2 }}>{d.month}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Time Selector */}
            <div style={{ marginBottom: 'var(--sp-6)' }}>
              <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--clr-ink)', marginBottom: 'var(--sp-3)' }}>Choose Time</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-2)' }}>
                {timeSlots.map((time) => (
                  <button
                    key={time}
                    onClick={() => setSelectedTime(time)}
                    style={{
                      padding: 'var(--sp-3) var(--sp-2)', borderRadius: 'var(--radius-md)',
                      background: selectedTime === time ? 'var(--clr-brand)' : 'var(--clr-surface-2)',
                      border: `1.5px solid ${selectedTime === time ? 'var(--clr-brand)' : 'var(--clr-border)'}`,
                      color: selectedTime === time ? 'var(--clr-ink-on-dark)' : 'var(--clr-ink)',
                      fontSize: 'var(--text-xs)', fontWeight: 600, textAlign: 'center',
                      cursor: 'pointer', transition: 'all var(--dur-fast) ease',
                    }}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Reason / Symptoms input */}
        <div style={{ marginBottom: 'var(--sp-6)' }}>
          <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--clr-ink)', marginBottom: 'var(--sp-3)' }}>Reason for Visit</h3>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Type your symptoms or concern (e.g. general checkup, menstrual cramps, bloating...)"
            rows={4}
            style={{
              width: '100%', borderRadius: 'var(--radius-md)', padding: 'var(--sp-3) var(--sp-4)',
              background: 'var(--clr-surface-2)', border: '1.5px solid var(--clr-border)',
              color: 'var(--clr-ink)', fontSize: 'var(--text-sm)', outline: 'none',
              resize: 'none', fontFamily: 'inherit', lineHeight: 1.5,
              transition: 'border-color var(--dur-fast)',
            }}
          />
        </div>
      </div>

      {/* Booking CTA Footer */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 430, background: 'var(--clr-surface)',
        borderTop: '1px solid var(--clr-border)', padding: 'var(--sp-4) var(--sp-6) calc(env(safe-area-inset-top) + var(--sp-4))',
        zIndex: 50
      }}>
        <button
          className="btn btn--primary"
          onClick={handleBook}
          disabled={(consultMode === 'video' && !selectedTime) || submitting}
          style={{ opacity: ((consultMode === 'video' && !selectedTime) || submitting) ? 0.6 : 1 }}
        >
          {submitting ? 'Scheduling...' : `Confirm ${consultMode === 'chat' ? 'Chat' : 'Video'} Appointment${feeLabel ? ` · ${feeLabel}` : ''}`}
        </button>
      </div>
    </div>
  );
}
