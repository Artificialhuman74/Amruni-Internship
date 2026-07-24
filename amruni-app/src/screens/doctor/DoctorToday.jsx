import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { doctorApi, getCachedDoctor } from '../../services/doctorApi';

function parseTimeToMinutes(time) {
  const m = (time || '').match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12;
  if (m[3].toUpperCase() === 'AM' && h === 12) h = 0;
  return h * 60 + parseInt(m[2], 10);
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DoctorToday() {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const [me, setMe] = useState(() => ({ doctor: getCachedDoctor(), stats: null }));
  const [appointments, setAppointments] = useState(null); // null = loading
  const [nowMin, setNowMin] = useState(() => new Date().getHours() * 60 + new Date().getMinutes());

  useEffect(() => {
    let cancelled = false;
    Promise.all([doctorApi.me(), doctorApi.appointments()])
      .then(([meData, appts]) => {
        if (cancelled) return;
        setMe(meData);
        setAppointments(appts);
      })
      .catch(() => { if (!cancelled) setAppointments([]); });
    const tick = setInterval(() => {
      const d = new Date();
      setNowMin(d.getHours() * 60 + d.getMinutes());
    }, 30000);
    return () => { cancelled = true; clearInterval(tick); };
  }, []);

  const today = new Date().toISOString().split('T')[0];

  const { nextUp, later, doneToday } = useMemo(() => {
    const todays = (appointments || [])
      .filter((a) => a.date === today)
      .sort((a, b) => (parseTimeToMinutes(a.time) ?? 0) - (parseTimeToMinutes(b.time) ?? 0));
    const pending = todays.filter((a) => a.status === 'confirmed');
    return {
      nextUp: pending[0] || null,
      later: pending.slice(1),
      doneToday: todays.filter((a) => a.status === 'completed'),
    };
  }, [appointments, today]);

  const nextStart = nextUp ? parseTimeToMinutes(nextUp.time) : null;
  const nextIsLive = nextStart !== null && nowMin >= nextStart - 5;
  const minutesToNext = nextStart !== null ? nextStart - nowMin : null;

  function joinAppointment(appt) {
    if (appt.consultMode === 'chat' && appt.patient?.phone) {
      window.open(`https://wa.me/91${appt.patient.phone.replace(/\D/g, '')}`, '_blank');
    } else if (appt.meetLink) {
      window.open(appt.meetLink, '_blank');
    }
  }

  const doctor = me.doctor;
  const dateLine = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  const totalToday = (nextUp ? 1 : 0) + later.length + doneToday.length;

  return (
    <div style={{ padding: 'calc(env(safe-area-inset-top) + var(--sp-6)) var(--sp-6) var(--sp-8)' }}>
      <header>
        <h1 className="doc-greeting">{greeting()},<br />{doctor?.name || 'Doctor'}</h1>
        <p className="doc-daymeta">
          {dateLine}
          {appointments !== null && (
            <> · {totalToday === 0 ? 'no consultations booked' : `${totalToday} consultation${totalToday === 1 ? '' : 's'}`}</>
          )}
        </p>
      </header>

      {appointments === null ? (
        <div style={{ marginTop: 'var(--sp-8)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }} aria-label="Loading today's queue">
          <div className="skel" style={{ height: 148, borderRadius: 'var(--radius-xl)' }} />
          <div className="skel" style={{ height: 56 }} />
          <div className="skel" style={{ height: 56 }} />
        </div>
      ) : (
        <>
          {/* Next up — the one dominant card */}
          {nextUp ? (
            <section style={{ marginTop: 'var(--sp-8)' }} aria-label="Next consultation">
              <h2 className="doc-section-title">Next up</h2>
              <motion.div
                className="doc-next"
                initial={reduced ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span className="doc-next__time">{nextUp.time}</span>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: nextIsLive ? 'oklch(0.80 0.13 142)' : 'var(--clr-ink-muted-on-dark)' }}>
                    {nextIsLive ? '● Ready to join' : minutesToNext > 60 ? `in ${Math.floor(minutesToNext / 60)}h ${minutesToNext % 60}m` : `in ${minutesToNext}m`}
                  </span>
                </div>
                <p className="doc-next__patient">
                  {nextUp.patient?.name}
                  {nextUp.patient?.age != null && <span style={{ fontWeight: 400, color: 'var(--clr-ink-muted-on-dark)' }}> · {nextUp.patient.age} yrs</span>}
                </p>
                <p className="doc-next__meta">{nextUp.consultMode === 'chat' ? 'Chat consultation' : 'Video consultation'} · {nextUp.fee}</p>
                {nextUp.reason && <p className="doc-next__reason">“{nextUp.reason}”</p>}
                <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-4)' }}>
                  <button
                    className={`btn btn--primary btn--sm${nextIsLive ? ' btn-pulse-effect' : ''}`}
                    style={{ flex: 1.4 }}
                    onClick={() => joinAppointment(nextUp)}
                  >
                    {nextUp.consultMode === 'chat' ? 'Open chat' : 'Join call'}
                  </button>
                  <button
                    className="btn btn--dark btn--sm"
                    style={{ flex: 1 }}
                    onClick={() => navigate(`/record/${nextUp.appointmentId}`)}
                  >
                    Write record
                  </button>
                </div>
              </motion.div>
            </section>
          ) : (
            <section style={{ marginTop: 'var(--sp-8)', background: 'var(--clr-surface)', border: '1px solid var(--clr-border)', borderRadius: 'var(--radius-xl)', padding: 'var(--sp-6)', textAlign: 'center' }}>
              <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--clr-ink)' }}>
                {doneToday.length > 0 ? 'All done for today.' : 'Your day is clear.'}
              </p>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginTop: 'var(--sp-2)', lineHeight: 'var(--leading-base)' }}>
                {doneToday.length > 0
                  ? `${doneToday.length} consultation${doneToday.length === 1 ? '' : 's'} completed. Records are one tap away below.`
                  : 'Patients book the moment you publish availability.'}
              </p>
              {doneToday.length === 0 && (
                <button className="btn btn--secondary btn--sm" style={{ width: 'auto', margin: 'var(--sp-4) auto 0' }} onClick={() => navigate('/schedule')}>
                  Publish slots
                </button>
              )}
            </section>
          )}

          {/* Later today */}
          {later.length > 0 && (
            <section style={{ marginTop: 'var(--sp-8)' }} aria-label="Later today">
              <h2 className="doc-section-title">Later today</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                {later.map((appt, i) => (
                  <motion.div
                    key={appt.appointmentId}
                    className="doc-queue-row"
                    initial={reduced ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: Math.min(i, 8) * 0.04, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <span className="doc-queue-row__time">{appt.time}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--clr-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{appt.patient?.name}</p>
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)' }}>{appt.consultMode === 'chat' ? 'Chat' : 'Video'} · {appt.fee}</p>
                    </div>
                    <button
                      className="chip chip--sm"
                      onClick={() => navigate(`/record/${appt.appointmentId}`)}
                    >
                      Record
                    </button>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {/* Completed today */}
          {doneToday.length > 0 && (
            <section style={{ marginTop: 'var(--sp-8)' }} aria-label="Completed today">
              <h2 className="doc-section-title">Completed</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                {doneToday.map((appt) => (
                  <div key={appt.appointmentId} className="doc-queue-row">
                    <span className="doc-queue-row__time doc-queue-row__done">{appt.time}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--clr-ink-muted)' }}>{appt.patient?.name}</p>
                    </div>
                    <button className="chip chip--sm" onClick={() => navigate(`/record/${appt.appointmentId}`)}>
                      {appt.hasRecord ? 'View record' : 'Add record'}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Quiet practice pulse */}
          {me.stats && (
            <p className="doc-statline" style={{ marginTop: 'var(--sp-10)' }}>
              <span><strong>{me.stats.todayDone}</strong> of <strong>{me.stats.todayTotal}</strong> seen today</span>
              <span className="sep">·</span>
              <span><strong>{me.stats.patients}</strong> patients</span>
              <span className="sep">·</span>
              <span><strong>₹{me.stats.weekEarnings.toLocaleString('en-IN')}</strong> this week</span>
            </p>
          )}
        </>
      )}
    </div>
  );
}
