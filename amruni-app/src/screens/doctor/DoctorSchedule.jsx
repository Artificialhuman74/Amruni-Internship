import { useState, useEffect, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { doctorApi, doctorApiError, getCachedDoctor } from '../../services/doctorApi';
import BottomSheet from '../../components/BottomSheet';
import { useToast } from '../../components/Toast';
import { confirm as confirmHaptic } from '../../lib/haptics';
import { IconClose } from '../../icons.jsx';

const STATUS_DOT = {
  open: 'var(--clr-success)',
  locked: 'var(--clr-warning)',
  booked: 'var(--clr-brand)',
};

function dayLabel(iso) {
  const d = new Date(`${iso}T00:00`);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d - today) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function DoctorSchedule() {
  const reduced = useReducedMotion();
  const toast = useToast();
  const doctor = getCachedDoctor();
  const [slots, setSlots] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({ date: today, start: '10:00', end: '17:00', durationMinutes: 30, price: '' });

  useEffect(() => {
    let cancelled = false;
    doctorApi.slots()
      .then((data) => { if (!cancelled) setSlots(data); })
      .catch(() => { if (!cancelled) setSlots([]); });
    return () => { cancelled = true; };
  }, [refreshKey]);

  const byDate = useMemo(() => {
    const grouped = {};
    for (const s of slots || []) (grouped[s.date] = grouped[s.date] || []).push(s);
    return grouped;
  }, [slots]);

  const bookedCount = (slots || []).filter((s) => s.status === 'booked').length;
  const openCount = (slots || []).filter((s) => s.status === 'open').length;

  async function handlePublish(e) {
    e.preventDefault();
    setPublishing(true);
    setError('');
    try {
      const res = await doctorApi.publishSlots({
        date: form.date,
        start: form.start,
        end: form.end,
        durationMinutes: Number(form.durationMinutes) || 30,
        price: form.price ? Number(form.price) : undefined,
      });
      setSheetOpen(false);
      setRefreshKey((k) => k + 1);
      confirmHaptic();
      toast(res.created > 0 ? `${res.created} slots published` : 'Those times were already published', { icon: 'calendar' });
    } catch (err) {
      setError(doctorApiError(err, 'Could not publish those slots.'));
    } finally {
      setPublishing(false);
    }
  }

  async function removeSlot(slot) {
    try {
      await doctorApi.deleteSlot(slot.id);
      setSlots((prev) => prev.filter((s) => s.id !== slot.id));
    } catch (err) {
      toast(doctorApiError(err, 'Could not remove that slot.'), { icon: 'warning' });
    }
  }

  const field = {
    padding: 'var(--sp-3) var(--sp-4)', borderRadius: 'var(--radius-md)',
    border: '1.5px solid var(--clr-border)', background: 'var(--clr-surface-2)',
    color: 'var(--clr-ink)', fontSize: 'var(--text-sm)', width: '100%',
  };

  return (
    <div style={{ padding: 'calc(env(safe-area-inset-top) + var(--sp-6)) var(--sp-6) var(--sp-8)' }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--sp-4)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--clr-ink)' }}>Schedule</h1>
          {slots !== null && (
            <p className="doc-daymeta">
              {openCount} open · {bookedCount} booked over the next days
            </p>
          )}
        </div>
        <button className="btn btn--primary btn--sm" style={{ width: 'auto', flexShrink: 0 }} onClick={() => { setError(''); setSheetOpen(true); }}>
          + Publish
        </button>
      </header>

      {slots === null ? (
        <div style={{ marginTop: 'var(--sp-6)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }} aria-label="Loading schedule">
          <div className="skel" style={{ height: 88 }} />
          <div className="skel" style={{ height: 88 }} />
        </div>
      ) : Object.keys(byDate).length === 0 ? (
        <div style={{ marginTop: 'var(--sp-8)', background: 'var(--clr-surface)', border: '1px solid var(--clr-border)', borderRadius: 'var(--radius-xl)', padding: 'var(--sp-8) var(--sp-6)', textAlign: 'center' }}>
          <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--clr-ink)' }}>Nothing published yet.</p>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginTop: 'var(--sp-2)', lineHeight: 'var(--leading-base)' }}>
            Your calendar is what patients book from. Publish a range and it becomes bookable slots instantly.
          </p>
        </div>
      ) : (
        <div style={{ marginTop: 'var(--sp-6)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
          {Object.entries(byDate).map(([day, daySlots], di) => (
            <motion.section
              key={day}
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(di, 5) * 0.05, ease: [0.16, 1, 0.3, 1] }}
              aria-label={`Slots on ${day}`}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--sp-3)' }}>
                <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--clr-ink)' }}>{dayLabel(day)}</h2>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-subtle)' }}>
                  {daySlots.filter((s) => s.status === 'booked').length}/{daySlots.length} booked
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
                {daySlots.map((s) => (
                  <span
                    key={s.id}
                    className="chip chip--sm"
                    style={{ cursor: 'default', gap: 6 }}
                    title={`${s.time} · ₹${s.price} · ${s.status}`}
                  >
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_DOT[s.status] || 'var(--clr-border)', flexShrink: 0 }} aria-hidden="true" />
                    {s.time}
                    <span style={{ color: 'var(--clr-ink-subtle)' }}>₹{s.price}</span>
                    {s.status === 'open' && (
                      <button
                        onClick={() => removeSlot(s)}
                        aria-label={`Remove ${s.time} slot on ${dayLabel(day)}`}
                        style={{ color: 'var(--clr-ink-subtle)', lineHeight: 1, padding: 0, display: 'inline-flex' }}
                      >
                        <IconClose size={13} />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </motion.section>
          ))}
        </div>
      )}

      <p style={{ marginTop: 'var(--sp-8)', fontSize: 'var(--text-xs)', color: 'var(--clr-ink-subtle)', lineHeight: 'var(--leading-base)' }}>
        <span style={{ color: 'var(--clr-success)' }}>●</span> open&ensp;
        <span style={{ color: 'var(--clr-warning)' }}>●</span> reserved, payment pending&ensp;
        <span style={{ color: 'var(--clr-brand)' }}>●</span> booked
      </p>

      <BottomSheet open={sheetOpen} onClose={() => !publishing && setSheetOpen(false)} title="Publish availability">
        <form onSubmit={handlePublish} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', padding: '0 var(--sp-2) var(--sp-4)' }}>
          <div className="input-group">
            <label className="input-label" htmlFor="sched-date">Date</label>
            <input id="sched-date" type="date" min={today} required value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })} style={field} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
            <div className="input-group">
              <label className="input-label" htmlFor="sched-start">From</label>
              <input id="sched-start" type="time" required value={form.start}
                onChange={(e) => setForm({ ...form, start: e.target.value })} style={field} />
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="sched-end">To</label>
              <input id="sched-end" type="time" required value={form.end}
                onChange={(e) => setForm({ ...form, end: e.target.value })} style={field} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
            <div className="input-group">
              <label className="input-label" htmlFor="sched-len">Slot length</label>
              <select id="sched-len" value={form.durationMinutes}
                onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} style={field}>
                {[15, 20, 30, 45, 60].map((n) => <option key={n} value={n}>{n} minutes</option>)}
              </select>
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="sched-price">Price per slot</label>
              <input id="sched-price" type="number" min="1" placeholder={doctor ? `₹${doctor.videoFee}` : '₹'}
                value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} style={field} />
            </div>
          </div>
          {error && <p role="alert" style={{ fontSize: 'var(--text-sm)', color: 'oklch(0.55 0.18 24)' }}>{error}</p>}
          <button type="submit" className="btn btn--primary" disabled={publishing}>
            {publishing ? 'Publishing…' : 'Publish slots'}
          </button>
        </form>
      </BottomSheet>
    </div>
  );
}
