import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { medsApi } from '../services/medsApi';
import { apiError } from '../services/api';
import { useToast } from '../components/Toast';
import BottomSheet from '../components/BottomSheet';
import { tap, confirm as confirmHaptic } from '../lib/haptics';
import { IconPill, IconCheck, IconStethoscope, IconPlus } from '../icons.jsx';

/**
 * Medicines.
 *
 * The prescription a doctor writes used to be readable in exactly one place —
 * inside the consultation record it was written into — which meant the app
 * knew what she was supposed to be taking and never once mentioned it again.
 * This screen is the other half of that loop.
 *
 * Today's doses come first because that is the only part she acts on. The
 * medicine list is reference material and sits below it.
 *
 * Nothing here scolds. A dose not yet ticked is "not taken *yet*", never
 * "missed" — an adherence screen that opens by telling a woman she is failing
 * is one she stops opening, and then the adherence really does fall.
 */

const EXPO = [0.16, 1, 0.3, 1];

function prettyTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

function partOfDay(hhmm) {
  const h = Number(hhmm.split(':')[0]);
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}

export default function Medicines() {
  const toast = useToast();
  const reduce = useReducedMotion();

  const [data, setData] = useState(null);
  const [adherence, setAdherence] = useState(null);
  const [error, setError] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: '', dose: '', frequency: 'once daily' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, adh] = await Promise.all([
        medsApi.list(),
        medsApi.adherence(14).catch(() => null),
      ]);
      setData(list);
      setAdherence(adh);
      setError('');
    } catch (err) {
      setError(apiError(err, 'Could not load your medicines.'));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([medsApi.list(), medsApi.adherence(14).catch(() => null)])
      .then(([list, adh]) => {
        if (cancelled) return;
        setData(list);
        setAdherence(adh);
      })
      .catch((err) => { if (!cancelled) setError(apiError(err, 'Could not load your medicines.')); });
    return () => { cancelled = true; };
  }, []);

  // Grouped into morning / afternoon / evening — how a day of medicine is
  // actually held in the head, rather than as a list of clock times.
  const groups = useMemo(() => {
    if (!data?.today) return [];
    const by = new Map();
    data.today.forEach((d) => {
      const key = partOfDay(d.time);
      if (!by.has(key)) by.set(key, []);
      by.get(key).push(d);
    });
    return [...by.entries()];
  }, [data]);

  async function toggle(dose) {
    const wasTaken = dose.taken;
    tap();
    // Applied locally first: the tick has to feel instant, and the outbox will
    // carry it whenever the connection allows.
    setData((d) => ({
      ...d,
      today: d.today.map((x) =>
        x.medicationId === dose.medicationId && x.time === dose.time ? { ...x, taken: !wasTaken } : x),
      dueCount: d.dueCount + (wasTaken ? 1 : -1),
    }));
    try {
      if (wasTaken) await medsApi.undo(dose.medicationId, data.date, dose.time);
      else { confirmHaptic(); await medsApi.take(dose.medicationId, data.date, dose.time); }
    } catch {
      setData((d) => ({
        ...d,
        today: d.today.map((x) =>
          x.medicationId === dose.medicationId && x.time === dose.time ? { ...x, taken: wasTaken } : x),
        dueCount: d.dueCount + (wasTaken ? -1 : 1),
      }));
      toast('Could not record that. Try again.', { icon: 'warning' });
    }
  }

  async function addMedicine() {
    if (!form.name.trim() || saving) return;
    setSaving(true);
    try {
      await medsApi.add({ name: form.name.trim(), dose: form.dose.trim() || null, frequency: form.frequency });
      confirmHaptic();
      setAddOpen(false);
      setForm({ name: '', dose: '', frequency: 'once daily' });
      await load();
      toast('Added to your medicines', { icon: 'check' });
    } catch (err) {
      toast(apiError(err, 'Could not add that medicine.'), { icon: 'warning' });
    } finally {
      setSaving(false);
    }
  }

  async function stop(med) {
    tap();
    try {
      await medsApi.stop(med.id);
      await load();
      toast(`Stopped ${med.name}`, { icon: 'check' });
    } catch {
      toast('Could not stop that. Try again.', { icon: 'warning' });
    }
  }

  const taken = data?.today?.filter((d) => d.taken).length ?? 0;
  const total = data?.today?.length ?? 0;

  return (
    <div className="screen screen--light">
      <div className="mx">
        <motion.header
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EXPO }}
        >
          <h1 className="mx__title">Medicines</h1>
          <p className="mx__sub">
            {total === 0
              ? 'Anything your doctor prescribes appears here automatically.'
              : taken === total
                ? 'Everything for today is done.'
                : `${total - taken} of ${total} still to take today.`}
          </p>
        </motion.header>

        {error && (
          <div className="mx__error" role="alert">
            <p>{error}</p>
            <button className="btn btn--ghost btn--sm" onClick={load} style={{ width: 'auto' }}>Try again</button>
          </div>
        )}

        {/* ── Today ── */}
        {total > 0 && (
          <section className="mx__today">
            {groups.map(([part, doses], gi) => (
              <div key={part} className="mx__group">
                <h2 className="mx__group-title">{part}</h2>
                {doses.map((dose, i) => (
                  <motion.button
                    key={`${dose.medicationId}-${dose.time}`}
                    type="button"
                    className={`mx__dose${dose.taken ? ' mx__dose--done' : ''}`}
                    onClick={() => toggle(dose)}
                    aria-pressed={dose.taken}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: Math.min(gi * 0.06 + i * 0.03, 0.3), ease: EXPO }}
                  >
                    <span className="mx__check" aria-hidden="true">
                      {dose.taken && <IconCheck size={15} />}
                    </span>
                    <span className="mx__dose-body">
                      <span className="mx__dose-name">{dose.name}</span>
                      <span className="mx__dose-meta">
                        {[dose.dose, prettyTime(dose.time)].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </motion.button>
                ))}
              </div>
            ))}
          </section>
        )}

        {/* Shown only once there's enough history for the number to mean
            something, and phrased as a fact rather than a grade. */}
        {adherence?.rate != null && adherence.scheduled >= 7 && (
          <p className="mx__adherence">
            You&rsquo;ve taken {adherence.taken} of {adherence.scheduled} doses over the
            last {adherence.days} days.
          </p>
        )}

        {/* ── The list ── */}
        {data?.medications?.length > 0 && (
          <section>
            <p className="section-title">What you&rsquo;re on</p>
            <div className="mx__list">
              {data.medications.map((med) => (
                <div key={med.id} className="mx__med">
                  <span className="mx__med-mark" aria-hidden="true"><IconPill size={20} /></span>
                  <div className="mx__med-body">
                    <p className="mx__med-name">{med.name}</p>
                    <p className="mx__med-meta">
                      {[med.dose, med.frequency].filter(Boolean).join(' · ')}
                    </p>
                    {med.source === 'prescription' && (
                      <p className="mx__med-from">
                        <IconStethoscope size={12} /> Prescribed by {med.doctorName || 'your doctor'}
                        {med.endsOn ? ` · until ${new Date(`${med.endsOn}T00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}
                      </p>
                    )}
                  </div>
                  <button type="button" className="mx__stop" onClick={() => stop(med)}>Stop</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {data && total === 0 && data.medications.length === 0 && (
          <div className="mx__empty">
            <span className="mx__empty-mark" aria-hidden="true"><IconPill size={40} /></span>
            <p className="mx__empty-title">Nothing to take right now</p>
            <p className="mx__empty-body">
              When a doctor prescribes something in a consultation, it lands here with
              its schedule already set. You can also add anything you take on your own.
            </p>
          </div>
        )}

        {data?.past?.length > 0 && (
          <section>
            <p className="section-title">Finished</p>
            <div className="mx__list">
              {data.past.slice(0, 6).map((med) => (
                <div key={med.id} className="mx__med mx__med--past">
                  <span className="mx__med-mark" aria-hidden="true"><IconPill size={20} /></span>
                  <div className="mx__med-body">
                    <p className="mx__med-name">{med.name}</p>
                    <p className="mx__med-meta">{[med.dose, med.frequency].filter(Boolean).join(' · ')}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <button className="btn btn--secondary" onClick={() => { tap(); setAddOpen(true); }}>
          <IconPlus size={17} /> Add a medicine
        </button>
      </div>

      <BottomSheet open={addOpen} onClose={() => !saving && setAddOpen(false)} title="Add a medicine">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <div className="input-group">
            <label className="input-label" htmlFor="med-name">Name</label>
            <input id="med-name" className="input-field" value={form.name} placeholder="e.g. Iron tablet"
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="input-group">
            <label className="input-label" htmlFor="med-dose">Dose <span style={{ fontWeight: 400 }}>(optional)</span></label>
            <input id="med-dose" className="input-field" value={form.dose} placeholder="e.g. 200mg"
              onChange={(e) => setForm((f) => ({ ...f, dose: e.target.value }))} />
          </div>
          <div className="input-group">
            <p className="input-label">How often</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
              {['once daily', 'twice daily', 'thrice a day'].map((f) => (
                <button key={f} type="button" className={`chip${form.frequency === f ? ' chip--active' : ''}`}
                  aria-pressed={form.frequency === f}
                  onClick={() => { tap(); setForm((x) => ({ ...x, frequency: f })); }}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <button className="btn btn--primary" onClick={addMedicine} disabled={!form.name.trim() || saving}>
            {saving ? 'Adding…' : 'Add medicine'}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
