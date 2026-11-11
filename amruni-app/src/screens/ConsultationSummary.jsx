import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiError } from '../services/api';
import { appointmentApi } from '../services/appointmentApi';
import { useVideoCall } from '../hooks/useVideoCall';
import SuccessCheck from '../components/SuccessCheck';
import { confirm } from '../lib/haptics';
import DoctorAvatar from '../components/DoctorAvatar';
import { IconStar, IconPrescription } from '../icons.jsx';

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
  const [rxMeta, setRxMeta] = useState(null);
  const [rxError, setRxError] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    async function loadAppointment() {
      try {
        const appt = await appointmentApi.getAppointment(id);
        if (appt) {
          setAppointment(appt);
          setActiveAppointment(appt);
          // Mark appointment as completed so it is cleared from UPCOMING list
          await appointmentApi.completeAppointment(id);
          if (appt.record) {
            const meta = await appointmentApi.getPrescriptionMeta(id).catch(() => null);
            setRxMeta(meta);
          }
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

  const handleDownloadPrescription = async () => {
    if (downloading) return;
    setDownloading(true);
    setRxError('');
    try {
      const blob = await appointmentApi.downloadPrescriptionPdf(id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `prescription-${id}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      confirm();
    } catch (err) {
      let msg = apiError(err, 'Could not download the prescription PDF. Please try again.');
      if (err?.response?.data instanceof Blob) {
        try {
          const parsed = JSON.parse(await err.response.data.text());
          msg = parsed?.error || parsed?.detail || msg;
        } catch { /* ignore invalid json blob */ }
      }
      setRxError(msg);
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyVerifyLink = async () => {
    if (!rxMeta?.verificationToken) return;
    if (!navigator.clipboard?.writeText) {
      setRxError('Could not copy verification link.');
      return;
    }
    const shareUrl = `${window.location.origin}/verify-rx?token=${encodeURIComponent(rxMeta.verificationToken)}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      setRxError('Could not copy verification link.');
    }
  };

  if (loading) {
    return (
      <div className="screen screen--light" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  const doctorName = appointment?.doctor?.name || 'Doctor';
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
            <IconPrescription size={18} /> <span>View E-Prescription</span>
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

            {appointment?.record ? (
              <div style={{ padding: 'var(--sp-2) 0' }}>
                {appointment.record.diagnosis && (
                  <p style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--sp-3)' }}>
                    Dx: {appointment.record.diagnosis}
                  </p>
                )}
                {appointment.record.prescription.length > 0 ? (
                  appointment.record.prescription.map((line, i) => (
                    <div key={i} className="rx-line">
                      <span className="rx-line__name">{line.name}</span>
                      <span className="rx-line__detail">{[line.dose, line.frequency, line.duration].filter(Boolean).join(' · ')}</span>
                    </div>
                  ))
                ) : (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)' }}>No medicines prescribed for this visit.</p>
                )}
                {appointment.record.followUp && (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-gold)', fontWeight: 600, marginTop: 'var(--sp-3)' }}>
                    Follow-up advised: {appointment.record.followUp}
                  </p>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 'var(--sp-6) 0', color: 'var(--clr-ink-muted)' }}>
                <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Prescription will be shared by your doctor</p>
                <p style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--sp-2)' }}>Once {doctorName} writes your consultation record, it appears here.</p>
              </div>
            )}

            {appointment?.record && (
              <div style={{ borderTop: '1px dashed var(--clr-border)', paddingTop: 'var(--sp-3)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--sp-2)' }}>
                  <div style={{ fontSize: 11, color: 'var(--clr-ink-muted)', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
                    <span>Issued from clinician record</span>
                    {rxMeta?.verificationToken && (
                      <>
                        <Link
                          to={`/verify-rx?token=${encodeURIComponent(rxMeta.verificationToken)}`}
                          style={{ color: 'var(--clr-brand)', fontWeight: 600, textDecoration: 'underline' }}
                        >
                          Verify record
                        </Link>
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={handleCopyVerifyLink}
                          style={{ padding: '2px 6px', fontSize: 11, height: 'auto', minHeight: 0 }}
                        >
                          {copiedLink ? 'Copied link' : 'Copy link'}
                        </button>
                      </>
                    )}
                  </div>
                  <button
                    className="btn btn--primary"
                    onClick={handleDownloadPrescription}
                    disabled={downloading}
                    style={{ fontSize: 'var(--text-xs)', padding: 'var(--sp-2) var(--sp-3)', width: 'auto' }}
                  >
                    {downloading ? 'Downloading...' : 'Download PDF'}
                  </button>
                </div>
                {rxError && (
                  <p role="alert" style={{ fontSize: 'var(--text-xs)', color: 'oklch(0.55 0.16 24)' }}>
                    {rxError}
                  </p>
                )}
              </div>
            )}
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
            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--clr-success)', display: 'inline-flex', alignItems: 'center', gap: 'var(--sp-2)' }}><IconStar size={15} fill="currentColor" strokeWidth={0} /> Thank you for your feedback!</p>
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
                    display: 'flex', cursor: 'pointer', transition: 'color var(--dur-fast)',
                    color: (hoverRating || rating) >= star ? 'var(--clr-gold)' : 'var(--clr-border)'
                  }}
                  aria-label={`${star} star${star > 1 ? 's' : ''}`}
                >
                  <IconStar size={28} fill="currentColor" strokeWidth={0} />
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
        {/* Offered to everyone, not only to women with a policy on file. A
            receipt is proof of payment whether or not anyone is reimbursing
            it, and the screen behind this button is where she finds out that
            adding her insurance would put more on it. */}
        <button
          className="btn btn--secondary"
          onClick={() => navigate(`/receipt/${id}`)}
        >
          Get receipt for my insurer
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
