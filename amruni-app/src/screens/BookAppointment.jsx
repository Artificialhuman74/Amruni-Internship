import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useVideoCall } from '../hooks/useVideoCall';
import { appointmentApi } from '../services/appointmentApi';
import { apiError } from '../services/api';
import DoctorAvatar from '../components/DoctorAvatar';
import { useSosLift } from '../lib/useSosLift';
import BottomSheet from '../components/BottomSheet';
import SuccessCheck from '../components/SuccessCheck';
import { confirm as confirmHaptic } from '../lib/haptics';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dateLabel(iso) {
  const d = new Date(`${iso}T00:00`);
  return { dayName: DAY_NAMES[d.getDay()], dayNum: d.getDate(), month: MONTH_NAMES[d.getMonth()] };
}

export default function BookAppointment() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentDoctor, setActiveAppointment } = useVideoCall();
  useSosLift(); // this screen has a fixed bottom CTA — keep SOS clear of it

  const consultMode = searchParams.get('mode') || 'video';

  // Doctor-published availability (video only)
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(consultMode === 'video');
  const [selectedDate, setSelectedDate] = useState(null);   // ISO date string
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  // Payment flow: idle → ordering → pay (sheet open) → processing → done
  const [payStep, setPayStep] = useState('idle');
  const [booking, setBooking] = useState(null);             // { appointmentId, payment }

  useEffect(() => {
    if (consultMode !== 'video') return;
    let cancelled = false;
    appointmentApi.getSlots(id)
      .then((data) => { if (!cancelled) { setSlots(data); setSelectedDate(data[0]?.date ?? null); } })
      .catch((err) => { if (!cancelled) setError(apiError(err, 'Could not load available slots.')); })
      .finally(() => { if (!cancelled) setSlotsLoading(false); });
    return () => { cancelled = true; };
  }, [id, consultMode]);

  const dates = useMemo(() => [...new Set(slots.map((s) => s.date))], [slots]);
  const daySlots = useMemo(() => slots.filter((s) => s.date === selectedDate), [slots, selectedDate]);
  const selectedSlot = slots.find((s) => s.id === selectedSlotId) || null;

  const chatFee = currentDoctor?.chatFee ?? 0;
  const amountDue = consultMode === 'chat' ? chatFee : selectedSlot?.price ?? null;
  const feeLabel = amountDue != null ? `₹${amountDue}` : '';

  const canProceed = consultMode === 'chat' || !!selectedSlot;

  async function handleProceedToPay() {
    if (!canProceed || payStep !== 'idle') return;
    setError('');
    setPayStep('ordering');
    try {
      const res = await appointmentApi.createBooking({
        slotId: consultMode === 'video' ? selectedSlotId : undefined,
        doctorId: consultMode === 'chat' ? Number(id) : undefined,
        mode: consultMode,
        reason,
      });
      setBooking(res);
      setPayStep('pay');
    } catch (err) {
      setError(apiError(err, 'Could not start the booking. Please try again.'));
      setPayStep('idle');
      if (err.response?.status === 409 && consultMode === 'video') {
        // Slot taken while the user was deciding — refresh availability.
        setSelectedSlotId(null);
        appointmentApi.getSlots(id).then(setSlots).catch(() => {});
      }
    }
  }

  async function handlePay() {
    if (!booking || payStep !== 'pay') return;
    setPayStep('processing');
    try {
      // Mock provider: confirmation succeeds immediately. With Razorpay
      // configured, open Checkout with booking.payment.keyId/orderId first and
      // pass its paymentId + signature here.
      const appt = await appointmentApi.confirmPayment(booking.payment.paymentId);
      setActiveAppointment(appt);
      setPayStep('done');
      confirmHaptic();
      setTimeout(() => navigate(`/waiting/${appt.appointmentId}`), 1400);
    } catch (err) {
      setError(apiError(err, 'Payment failed. You have not been charged.'));
      setPayStep('pay');
    }
  }

  function handleSheetClose() {
    if (payStep === 'processing' || payStep === 'done') return; // don't interrupt
    setPayStep('idle');
    setBooking(null); // abandoning checkout — the slot lock expires server-side
  }

  const doctorName = currentDoctor?.name || 'Doctor';
  const doctorSpecialty = currentDoctor?.specialty || 'Specialist';
  const modeLabel = consultMode === 'chat' ? '💬 Chat / DM' : '🎥 Video Call';

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

        {/* Doctor-published availability — video consultations */}
        {consultMode === 'video' && (
          slotsLoading ? (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginBottom: 'var(--sp-6)' }}>
              Loading available slots…
            </p>
          ) : slots.length === 0 ? (
            <div style={{ background: 'var(--clr-surface-2)', border: '1px solid var(--clr-border)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-5)', marginBottom: 'var(--sp-6)', textAlign: 'center' }}>
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--clr-ink)' }}>No open slots right now</p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)', marginTop: 'var(--sp-2)' }}>
                {doctorName} hasn't published availability for the coming days. Try a chat consultation instead.
              </p>
            </div>
          ) : (
            <>
              {/* Date Selector — only dates the doctor actually opened */}
              <div style={{ marginBottom: 'var(--sp-6)' }}>
                <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--clr-ink)', marginBottom: 'var(--sp-3)' }}>Choose Date</h3>
                <div style={{ display: 'flex', gap: 'var(--sp-2)', overflowX: 'auto', paddingBottom: 'var(--sp-2)', scrollbarWidth: 'none' }}>
                  {dates.map((iso) => {
                    const d = dateLabel(iso);
                    const active = selectedDate === iso;
                    return (
                      <button
                        key={iso}
                        onClick={() => { setSelectedDate(iso); setSelectedSlotId(null); }}
                        style={{
                          flexShrink: 0, width: 62, height: 74, borderRadius: 'var(--radius-md)',
                          background: active ? 'var(--clr-brand)' : 'var(--clr-surface-2)',
                          border: `1.5px solid ${active ? 'var(--clr-brand)' : 'var(--clr-border)'}`,
                          color: active ? 'var(--clr-ink-on-dark)' : 'var(--clr-ink)',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', transition: 'all var(--dur-fast) ease',
                        }}
                      >
                        <span style={{ fontSize: 'var(--text-xs)', opacity: active ? 0.9 : 0.6, textTransform: 'uppercase' }}>{d.dayName}</span>
                        <span style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginTop: 4 }}>{d.dayNum}</span>
                        <span style={{ fontSize: 'var(--text-xs)', opacity: active ? 0.9 : 0.6, marginTop: 2 }}>{d.month}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time Selector — real slots with the doctor's price */}
              <div style={{ marginBottom: 'var(--sp-6)' }}>
                <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--clr-ink)', marginBottom: 'var(--sp-3)' }}>Choose Time</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-2)' }}>
                  {daySlots.map((slot) => {
                    const active = selectedSlotId === slot.id;
                    return (
                      <button
                        key={slot.id}
                        onClick={() => setSelectedSlotId(slot.id)}
                        style={{
                          padding: 'var(--sp-3) var(--sp-2)', borderRadius: 'var(--radius-md)',
                          background: active ? 'var(--clr-brand)' : 'var(--clr-surface-2)',
                          border: `1.5px solid ${active ? 'var(--clr-brand)' : 'var(--clr-border)'}`,
                          color: active ? 'var(--clr-ink-on-dark)' : 'var(--clr-ink)',
                          fontSize: 'var(--text-xs)', fontWeight: 600, textAlign: 'center',
                          cursor: 'pointer', transition: 'all var(--dur-fast) ease',
                        }}
                      >
                        <div>{slot.time}</div>
                        <div style={{ marginTop: 2, opacity: active ? 0.9 : 0.55, fontWeight: 500 }}>₹{slot.price}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )
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

        {error && (
          <p role="alert" style={{ fontSize: 'var(--text-sm)', color: 'oklch(0.55 0.18 24)', marginBottom: 'var(--sp-4)' }}>
            {error}
          </p>
        )}
      </div>

      {/* Booking CTA Footer */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 430, background: 'var(--clr-surface)',
        borderTop: '1px solid var(--clr-border)', padding: 'var(--sp-4) var(--sp-6) calc(env(safe-area-inset-top) + var(--sp-4))',
        zIndex: 'var(--z-sticky)'
      }}>
        <button
          className="btn btn--primary"
          onClick={handleProceedToPay}
          disabled={!canProceed || payStep !== 'idle'}
          style={{ opacity: (!canProceed || payStep !== 'idle') ? 0.6 : 1 }}
        >
          {payStep === 'ordering' ? 'Reserving slot…' : `Continue to Pay${feeLabel ? ` · ${feeLabel}` : ''}`}
        </button>
      </div>

      {/* Payment sheet */}
      <BottomSheet
        open={payStep === 'pay' || payStep === 'processing' || payStep === 'done'}
        onClose={handleSheetClose}
        title={payStep === 'done' ? 'Payment successful' : 'Confirm & pay'}
      >
        <div style={{ padding: '0 var(--sp-2) var(--sp-4)' }}>
          {payStep === 'done' ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-6) 0' }}>
              <SuccessCheck size={48} />
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--clr-ink)' }}>
                Appointment confirmed
              </p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)', textAlign: 'center' }}>
                {consultMode === 'video'
                  ? 'Your meeting link is ready — taking you to the waiting room…'
                  : 'Taking you to the waiting room…'}
              </p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', padding: 'var(--sp-4) 0', borderBottom: '1px solid var(--clr-border)', marginBottom: 'var(--sp-4)' }}>
                <SummaryRow label="Doctor" value={doctorName} />
                <SummaryRow label="Consultation" value={consultMode === 'chat' ? 'Chat / DM (instant)' : 'Video call'} />
                {consultMode === 'video' && selectedSlot && (
                  <SummaryRow label="Slot" value={`${dateLabel(selectedSlot.date).dayName} ${dateLabel(selectedSlot.date).dayNum} ${dateLabel(selectedSlot.date).month}, ${selectedSlot.time}`} />
                )}
                <SummaryRow label="Amount" value={feeLabel} strong />
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-subtle)', marginBottom: 'var(--sp-4)' }}>
                Your slot is reserved for 10 minutes while you pay. Your video meeting link is generated
                automatically the moment payment succeeds.
              </p>
              <button
                className="btn btn--primary"
                onClick={handlePay}
                disabled={payStep === 'processing'}
                style={{ width: '100%', opacity: payStep === 'processing' ? 0.7 : 1 }}
              >
                {payStep === 'processing' ? 'Processing payment…' : `Pay ${feeLabel}`}
              </button>
            </>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}

function SummaryRow({ label, value, strong }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)' }}>{label}</span>
      <span style={{ fontSize: strong ? 'var(--text-base)' : 'var(--text-sm)', fontWeight: strong ? 700 : 600, color: 'var(--clr-ink)' }}>{value}</span>
    </div>
  );
}
