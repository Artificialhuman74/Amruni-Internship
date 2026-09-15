import { useEffect, useMemo, useState } from 'react';
import { campApi } from '../../services/campApi';
import { apiError } from '../../services/api';
import { campDates, campTimes, STATUS_LABEL } from '../../lib/camps';
import { confirm } from '../../lib/haptics';

/**
 * Health camps, from the admin portal: create one, choose which doctors will
 * be there, edit or cancel it later.
 *
 * Cancelling is kept separate from deleting. A cancelled camp disappears from
 * patients' Home straight away but stays in this list, so the admin can see it
 * was planned — deleting removes it entirely.
 */

const EMPTY = {
  campType: '', title: '', description: '', startsOn: '', endsOn: '', startTime: '09:00', endTime: '13:00',
  venue: '', address: '', city: '', fee: 0, doctorIds: [], cancelled: false,
};

export default function CampManager({ doctors }) {
  const [types, setTypes] = useState([]);
  const [camps, setCamps] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [doctorQuery, setDoctorQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    campApi.types().then(setTypes).catch(() => {});
    campApi.all().then(setCamps).catch(() => {});
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const filteredDoctors = useMemo(() => {
    const q = doctorQuery.trim().toLowerCase();
    return q ? doctors.filter((d) => `${d.name} ${d.specialty}`.toLowerCase().includes(q)) : doctors;
  }, [doctors, doctorQuery]);

  function toggleDoctor(id) {
    setForm((f) => ({ ...f, doctorIds: f.doctorIds.includes(id) ? f.doctorIds.filter((x) => x !== id) : [...f.doctorIds, id] }));
  }

  function edit(camp) {
    setEditingId(camp.id);
    setForm({
      campType: camp.campType, title: camp.title === camp.campType ? '' : camp.title,
      description: camp.description ?? '', startsOn: camp.startsOn,
      endsOn: camp.endsOn === camp.startsOn ? '' : camp.endsOn,
      startTime: camp.startTime ?? '', endTime: camp.endTime ?? '', venue: camp.venue,
      address: camp.address ?? '', city: camp.city, fee: camp.fee,
      doctorIds: camp.doctors.map((d) => d.id), cancelled: camp.cancelled,
    });
    setMessage({ text: '', type: '' });
    document.getElementById('camp-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function reset() {
    setEditingId(null);
    setForm(EMPTY);
    setDoctorQuery('');
  }

  async function save(e) {
    e.preventDefault();
    if (!form.campType || !form.startsOn || !form.venue.trim() || !form.city.trim()) {
      setMessage({ text: 'Choose a camp type and fill in the date, venue and city.', type: 'error' });
      return;
    }
    setBusy(true);
    setMessage({ text: '', type: '' });
    const payload = { ...form, fee: Number(form.fee) || 0, endsOn: form.endsOn || null };
    try {
      const saved = editingId ? await campApi.update(editingId, payload) : await campApi.create(payload);
      setCamps((prev) => (editingId ? prev.map((c) => (c.id === saved.id ? saved : c)) : [saved, ...prev]));
      setMessage({ text: editingId ? 'Camp updated.' : 'Camp created — patients will see it on their Home screen.', type: 'success' });
      confirm();
      reset();
    } catch (err) {
      setMessage({ text: apiError(err, 'Could not save the camp.'), type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function remove(camp) {
    if (!window.confirm(`Delete “${camp.title}” on ${campDates(camp)}? This cannot be undone. To keep a record, cancel it instead.`)) return;
    try {
      await campApi.remove(camp.id);
      setCamps((prev) => prev.filter((c) => c.id !== camp.id));
      if (editingId === camp.id) reset();
    } catch (err) {
      setMessage({ text: apiError(err, 'Could not delete the camp.'), type: 'error' });
    }
  }

  return (
    <section className="camp-admin" aria-labelledby="camp-admin-title">
      <h2 id="camp-admin-title" className="camp-admin__title">Health camps</h2>
      <p className="camp-admin__intro">Camps coming up, running, or held in the last week appear as a notice on every patient’s Home screen.</p>

      <form id="camp-form" className="camp-form" onSubmit={save} noValidate>
        <p className="camp-form__heading">{editingId ? 'Edit camp' : 'Create a camp'}</p>

        <label className="camp-field camp-field--wide">
          <span>Camp type *</span>
          <select value={form.campType} onChange={set('campType')}>
            <option value="">Choose…</option>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>

        <label className="camp-field camp-field--wide">
          <span>Title shown to patients</span>
          <input value={form.title} onChange={set('title')} placeholder={form.campType || 'Defaults to the camp type'} maxLength={120} />
        </label>

        <label className="camp-field">
          <span>Start date *</span>
          <input type="date" value={form.startsOn} min={editingId ? undefined : today} onChange={set('startsOn')} />
        </label>
        <label className="camp-field">
          <span>End date</span>
          <input type="date" value={form.endsOn} min={form.startsOn || today} onChange={set('endsOn')} />
        </label>
        <label className="camp-field">
          <span>From</span>
          <input type="time" value={form.startTime} onChange={set('startTime')} />
        </label>
        <label className="camp-field">
          <span>Until</span>
          <input type="time" value={form.endTime} onChange={set('endTime')} />
        </label>

        <label className="camp-field camp-field--wide">
          <span>Venue *</span>
          <input value={form.venue} onChange={set('venue')} placeholder="e.g. Jayanagar Community Hall" maxLength={160} />
        </label>
        <label className="camp-field">
          <span>Address</span>
          <input value={form.address} onChange={set('address')} placeholder="Street, area" maxLength={300} />
        </label>
        <label className="camp-field">
          <span>City *</span>
          <input value={form.city} onChange={set('city')} placeholder="e.g. Bengaluru" maxLength={80} />
        </label>
        <label className="camp-field">
          <span>Fee (₹, 0 = free)</span>
          <input type="number" min="0" value={form.fee} onChange={set('fee')} />
        </label>
        <label className="camp-field camp-field--wide">
          <span>What to expect</span>
          <textarea rows={3} value={form.description} onChange={set('description')} placeholder="Free screenings, what to bring, who should come…" maxLength={2000} />
        </label>

        <fieldset className="camp-doctors">
          <legend>Doctors at this camp <em>{form.doctorIds.length} chosen</em></legend>
          <input className="camp-doctors__search" value={doctorQuery} onChange={(e) => setDoctorQuery(e.target.value)} placeholder="Search doctors by name or specialty" />
          <div className="camp-doctors__list">
            {filteredDoctors.map((d) => {
              const on = form.doctorIds.includes(d.id);
              return (
                <label key={d.id} className={`camp-doc${on ? ' camp-doc--on' : ''}`}>
                  <input type="checkbox" checked={on} onChange={() => toggleDoctor(d.id)} />
                  <span className="camp-doc__name">{d.name}</span>
                  <span className="camp-doc__spec">{d.specialty}</span>
                </label>
              );
            })}
            {!filteredDoctors.length && <p className="camp-doctors__empty">No doctors match.</p>}
          </div>
        </fieldset>

        {editingId && (
          <label className="camp-cancel">
            <input type="checkbox" checked={form.cancelled} onChange={(e) => setForm((f) => ({ ...f, cancelled: e.target.checked }))} />
            Cancelled — hide it from patients but keep it in this list
          </label>
        )}

        {message.text && <p className={`camp-msg camp-msg--${message.type}`} role={message.type === 'error' ? 'alert' : 'status'}>{message.text}</p>}

        <div className="camp-form__actions">
          {editingId && <button type="button" className="btn btn--secondary btn--sm" onClick={reset}>Cancel editing</button>}
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? 'Saving…' : editingId ? 'Save changes' : 'Create camp'}
          </button>
        </div>
      </form>

      <div className="camp-list">
        {camps.length === 0 && <p className="camp-admin__intro">No camps yet.</p>}
        {camps.map((c) => (
          <article key={c.id} className={`camp-row camp-row--${c.status}`}>
            <div className="camp-row__main">
              <p className="camp-row__title">{c.title}</p>
              <p className="camp-row__meta">{campDates(c)}{campTimes(c) ? ` · ${campTimes(c)}` : ''} · {c.venue}, {c.city}</p>
              <p className="camp-row__meta">
                {c.doctors.length ? c.doctors.map((d) => d.name).join(', ') : 'No doctors assigned yet'}
                {c.fee ? ` · ₹${c.fee}` : ' · Free'}
              </p>
            </div>
            <div className="camp-row__side">
              <span className={`camp-badge camp-badge--${c.status}`}>{STATUS_LABEL[c.status]}</span>
              <div className="camp-row__actions">
                <button type="button" onClick={() => edit(c)}>Edit</button>
                <button type="button" className="danger" onClick={() => remove(c)}>Delete</button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
