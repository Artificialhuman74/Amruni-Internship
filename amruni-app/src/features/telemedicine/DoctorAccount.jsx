import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doctorApi, getCachedDoctor, setDoctorSession } from '../../services/api/doctorApi'
import DoctorAvatar from './DoctorAvatar';

export default function DoctorAccount() {
  const navigate = useNavigate();
  const [doctor, setDoctor] = useState(getCachedDoctor());
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let cancelled = false;
    doctorApi.me()
      .then((d) => { if (!cancelled) { setDoctor(d.doctor); setStats(d.stats); } })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  function signOut() {
    setDoctorSession(null);
    navigate('/', { replace: true });
  }

  if (!doctor) return null;

  return (
    <div style={{ padding: 'calc(env(safe-area-inset-top) + var(--sp-6)) var(--sp-6) var(--sp-8)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
        <DoctorAvatar doctor={doctor} size={64} />
        <div>
          <h1 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--clr-ink)' }}>{doctor.name}</h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginTop: 1 }}>
            {doctor.specialty} · {doctor.exp}
          </p>
        </div>
      </header>

      <section style={{ marginTop: 'var(--sp-8)' }} aria-label="Practice details">
        <h2 className="doc-section-title">Practice</h2>
        <div style={{ background: 'var(--clr-surface)', border: '1px solid var(--clr-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {[
            ['Video consultation', `₹${doctor.videoFee}`],
            ['Chat consultation', `₹${doctor.chatFee}`],
            ['Languages', (doctor.lang || []).join(', ') || '—'],
            ['Registered number', `+91 ${doctor.phone}`],
            ['Rating', `${doctor.rating} · ${doctor.reviews} reviews`],
          ].map(([label, value], i) => (
            <div key={label} style={{
              display: 'flex', justifyContent: 'space-between', gap: 'var(--sp-4)',
              padding: 'var(--sp-3) var(--sp-4)',
              borderTop: i === 0 ? 'none' : '1px solid var(--clr-border)',
            }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)' }}>{label}</span>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--clr-ink)', textAlign: 'right' }}>{value}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-subtle)', marginTop: 'var(--sp-2)', lineHeight: 'var(--leading-base)' }}>
          Slot pricing can differ per day — set it when publishing availability.
        </p>
      </section>

      {stats && (
        <section style={{ marginTop: 'var(--sp-8)' }} aria-label="This week">
          <h2 className="doc-section-title">This week</h2>
          <p className="doc-statline">
            <span><strong>₹{stats.weekEarnings.toLocaleString('en-IN')}</strong> earned</span>
            <span className="sep">·</span>
            <span><strong>{stats.patients}</strong> patients under care</span>
          </p>
        </section>
      )}

      <button
        className="btn btn--secondary"
        style={{ marginTop: 'var(--sp-12)' }}
        onClick={signOut}
      >
        Sign out
      </button>
    </div>
  );
}
