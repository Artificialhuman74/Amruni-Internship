import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { appointmentApi } from '../services/appointmentApi';
import { useVideoCall } from '../hooks/useVideoCall';
import SuccessCheck from '../components/SuccessCheck';
import { confirm } from '../lib/haptics';
import DoctorAvatar from '../components/DoctorAvatar';

export default function ConsultationSummary() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { setActiveAppointment } = useVideoCall();
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [showPrescription, setShowPrescription] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    async function loadAppointment() {
      try {
        const appt = await appointmentApi.getAppointment(id);
        if (appt) {
          setAppointment(appt);
          setActiveAppointment(appt);
          // Mark appointment as completed so it is cleared from UPCOMING list
          await appointmentApi.completeAppointment(id);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadAppointment();
  }, [id, setActiveAppointment]);

  const handleRateSubmit = () => {
    if (rating === 0) return;
    setRatingSubmitted(true);
    confirm();
  };

  const handleDownloadPrescription = () => {
    setDownloading(true);
    setTimeout(() => {
      setDownloading(false);
      confirm();
      alert('Mock Prescription PDF downloaded successfully!');
    }, 1500);
  };

  if (loading) {
    return (
      <div className="screen screen--light" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  const doctorName = appointment?.doctor?.name || 'Doctor';
  const doctorAvatar = appointment?.doctor?.avatar || '🩺';
  const doctorSpecialty = appointment?.doctor?.specialty || 'Specialist';
  const appointmentDate = appointment?.date || new Date().toISOString().split('T')[0];

  return (
    <div className="screen screen--light" style={{ padding: 'var(--sp-6) var(--sp-6) calc(env(safe-area-inset-bottom) + var(--sp-6))' }}>
      
      {/* Top section with Success check animation */}
      <div style={{ textAlign: 'center', margin: 'var(--sp-6) 0' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--sp-4)' }}>
          <SuccessCheck size={64} />
        </div>
        <h1 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--clr-ink)' }}>Consultation Finished</h1>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginTop: 4 }}>
          Thank you for choosing Amruni Telemedicine.
        </p>
      </div>

      {/* Doctor card info */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
        background: 'var(--clr-surface-2)', border: '1.5px solid var(--clr-border)',
        borderRadius: 'var(--radius-lg)', padding: 'var(--sp-4)', marginBottom: 'var(--sp-5)'
      }}>
        <DoctorAvatar doctor={appointment?.doctor} size={48} />
        <div>
          <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--clr-ink)' }}>{doctorName}</h3>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)', marginTop: 2 }}>{doctorSpecialty}</p>
        </div>
      </div>

      {/* Prescription section */}
      <div style={{ marginBottom: 'var(--sp-6)' }}>
        <button
          className="btn btn--secondary"
          onClick={() => setShowPrescription((prev) => !prev)}
          style={{ width: '100%', justifyContent: 'space-between', display: 'flex', alignItems: 'center', padding: 'var(--sp-4)' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            📝 <span>View E-Prescription</span>
          </span>
          <span>{showPrescription ? '▲' : '▼'}</span>
        </button>

        {showPrescription && (
          <div style={{
            background: 'var(--clr-surface)', border: '1.5px solid var(--clr-border)',
            borderTop: 'none', borderRadius: `0 0 var(--radius-md) var(--radius-md)`,
            padding: 'var(--sp-5)', boxShadow: 'var(--shadow-sm)',
            fontSize: 'var(--text-sm)', color: 'var(--clr-ink)'
          }}>
            {/* Prescription content */}
            <div style={{ borderBottom: '1px dashed var(--clr-border)', paddingBottom: 'var(--sp-3)', marginBottom: 'var(--sp-3)', display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <strong>Amruni Digital Health</strong>
                <p style={{ fontSize: 10, color: 'var(--clr-ink-subtle)', marginTop: 2 }}>Rx ID: Rx_{appointment?.appointmentId || '---'}</p>
              </div>
              <div style={{ textAlign: 'right', fontSize: 'var(--text-xs)' }}>
                Date: {appointmentDate}
              </div>
            </div>

            <div style={{ textAlign: 'center', padding: 'var(--sp-6) 0', color: 'var(--clr-ink-muted)' }}>
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Prescription will be shared by your doctor</p>
              <p style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--sp-2)' }}>Once {doctorName} uploads it, you can download it here.</p>
            </div>

            <div style={{ borderTop: '1px dashed var(--clr-border)', paddingTop: 'var(--sp-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: 'var(--clr-ink-subtle)' }}>Electronically signed by {doctorName}</span>
              <button
                className="btn btn--primary"
                onClick={handleDownloadPrescription}
                disabled={downloading}
                style={{ fontSize: 'var(--text-xs)', padding: 'var(--sp-2) var(--sp-3)', width: 'auto', opacity: 0.5 }}
              >
                {downloading ? 'Downloading...' : 'Download PDF'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Review doctor */}
      <div style={{
        background: 'var(--clr-surface-2)', border: '1px solid var(--clr-border)',
        borderRadius: 'var(--radius-lg)', padding: 'var(--sp-5)', textAlign: 'center', marginBottom: 'var(--sp-6)'
      }}>
        {ratingSubmitted ? (
          <div>
            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--clr-success)' }}>★ Thank you for your feedback!</p>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)', marginTop: 4 }}>Your rating helps us improve our consultation services.</p>
          </div>
        ) : (
          <div>
            <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--clr-ink)' }}>Rate Your Consultation</h4>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)', marginTop: 2 }}>How was your session with {doctorName}?</p>
            
            {/* Stars Row */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--sp-2)', margin: 'var(--sp-4) 0' }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  style={{
                    fontSize: 28, cursor: 'pointer', transition: 'color var(--dur-fast)',
                    color: (hoverRating || rating) >= star ? 'var(--clr-gold)' : 'var(--clr-border)'
                  }}
                >
                  ★
                </button>
              ))}
            </div>

            <button
              className="btn btn--primary"
              onClick={handleRateSubmit}
              disabled={rating === 0}
              style={{ fontSize: 'var(--text-xs)', padding: 'var(--sp-2) var(--sp-4)', width: 'auto', margin: '0 auto', opacity: rating === 0 ? 0.6 : 1 }}
            >
              Submit Feedback
            </button>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
        <button
          className="btn btn--primary"
          onClick={() => navigate(`/appointment/${appointment?.doctorId || '1'}`)}
        >
          Book Follow-up Session
        </button>
        <button
          className="btn btn--secondary"
          onClick={() => navigate('/home')}
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}
