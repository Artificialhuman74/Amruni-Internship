import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { doctorApi } from '../../services/doctorApi';

const STAGE_LABEL = {
  adolescent: 'Adolescent',
  reproductive: 'Reproductive age',
  postpartum: 'Post-partum',
  menopause: 'Menopause',
  elderly: 'Elderly care',
};

function lastVisitLabel(iso) {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function DoctorPatients() {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const [patients, setPatients] = useState(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    doctorApi.patients()
      .then((data) => { if (!cancelled) setPatients(data); })
      .catch(() => { if (!cancelled) setPatients([]); });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patients || [];
    return (patients || []).filter(
      (p) => p.name.toLowerCase().includes(q) || (p.phone || '').includes(q)
    );
  }, [patients, query]);

  return (
    <div style={{ padding: 'calc(env(safe-area-inset-top) + var(--sp-6)) var(--sp-6) var(--sp-8)' }}>
      <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--clr-ink)' }}>Patients</h1>
      {patients !== null && (
        <p className="doc-daymeta">{patients.length} under your care</p>
      )}

      <input
        type="search"
        className="input-field--sm"
        placeholder="Search by name or number"
        aria-label="Search patients"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ marginTop: 'var(--sp-4)', padding: 'var(--sp-3) var(--sp-4)' }}
      />

      {patients === null ? (
        <div style={{ marginTop: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }} aria-label="Loading patients">
          {[0, 1, 2, 3].map((i) => <div key={i} className="skel" style={{ height: 66 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ marginTop: 'var(--sp-8)', textAlign: 'center', padding: 'var(--sp-6)' }}>
          <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--clr-ink)' }}>
            {query ? 'No one matches that search.' : 'No patients yet.'}
          </p>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginTop: 'var(--sp-2)', lineHeight: 'var(--leading-base)' }}>
            {query ? 'Try a shorter name, or check the number.' : 'Every woman who books with you appears here, with her full chart.'}
          </p>
        </div>
      ) : (
        <div style={{ marginTop: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {filtered.map((p, i) => (
            <motion.button
              key={p.id}
              className="doc-patient-row"
              onClick={() => navigate(`/doctor/patients/${p.id}`)}
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i, 8) * 0.035, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="doc-avatar" aria-hidden="true">
                {(p.name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--clr-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.name}
                </span>
                <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)', marginTop: 1 }}>
                  {[p.age != null ? `${p.age} yrs` : null, STAGE_LABEL[p.lifeStage]].filter(Boolean).join(' · ') || 'Profile pending'}
                </span>
              </span>
              <span style={{ textAlign: 'right', flexShrink: 0 }}>
                <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--clr-ink-subtle)' }}>{lastVisitLabel(p.lastVisit)}</span>
                <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)', marginTop: 1 }}>
                  {p.visits} visit{p.visits === 1 ? '' : 's'}
                </span>
              </span>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}
