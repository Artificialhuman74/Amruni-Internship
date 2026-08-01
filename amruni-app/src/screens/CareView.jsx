import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { careApi } from '../services/careApi';
import CareLedger from '../components/CareLedger';
import { conditionLabel } from '../data/conditions';
import { IconPill, IconAppointment, IconPhone, IconStethoscope } from '../icons.jsx';

/**
 * What a family member sees when they open the link.
 *
 * No account, no login, no app. Usually a son or daughter checking when their
 * mother's next appointment is, often on a phone that has never seen Amruni
 * before — so this page assumes nothing and asks for nothing.
 *
 * It shows only what the share's scopes allow, and it never offers a way in:
 * there is no sign-up prompt, no "see more", no link into the app. A page that
 * upsells the person holding someone else's medical link would be reading the
 * situation badly.
 */
export default function CareView() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [state, setState] = useState('loading');   // loading | ok | gone
  const [booking, setBooking] = useState(false);   // the slot picker
  const [slots, setSlots] = useState(null);
  const [busy, setBusy] = useState(null);          // slotId being reserved
  const [freshId, setFreshId] = useState(null);    // the event just written
  const [error, setError] = useState('');
  const [dosing, setDosing] = useState(null);      // `${medId}:${slot}` in flight
  const [note, setNote] = useState('');
  const [noting, setNoting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    careApi.view(token)
      .then((d) => { if (!cancelled) { setData(d); setState('ok'); } })
      .catch(() => { if (!cancelled) setState('gone'); });
    return () => { cancelled = true; };
  }, [token]);

  if (state === 'loading') {
    return <div className="cv"><div className="cv__skeleton" aria-busy="true" /></div>;
  }

  if (state === 'gone') {
    return (
      <div className="cv cv__center">
        <p className="cv__gone-title">This link is no longer active</p>
        <p className="cv__gone-body">
          It may have expired, or been turned off by the person who shared it.
          Ask them for a new one.
        </p>
      </div>
    );
  }

  const has = (s) => data.scopes?.includes(s);

  async function openBooking() {
    setBooking(true);
    setError('');
    if (slots) return;
    try {
      setSlots(await careApi.slots(token));
    } catch {
      setError('Could not load available times. Try again in a moment.');
      setSlots([]);
    }
  }

  /** Refreshes the page's own data after any action, so both panes agree. */
  async function refresh(flagFresh = true) {
    const next = await careApi.view(token);
    setData(next);
    if (flagFresh) setFreshId(next.events?.find((e) => e.actor === 'caretaker')?.id ?? null);
  }

  async function markDose(med, slot) {
    const key = `${med.id}:${slot}`;
    if (dosing) return;
    setDosing(key);
    setError('');
    try {
      await careApi.markDose(token, med.id, { slot });
      await refresh();
    } catch {
      setError('Could not record that dose. Try again in a moment.');
    } finally {
      setDosing(null);
    }
  }

  async function leaveNote(e) {
    e.preventDefault();
    const text = note.trim();
    if (!text || noting) return;
    setNoting(true);
    setError('');
    try {
      await careApi.note(token, text);
      setNote('');
      await refresh();
    } catch {
      setError('Could not add that note. Try again in a moment.');
    } finally {
      setNoting(false);
    }
  }

  async function reserve(slot) {
    if (busy) return;
    setBusy(slot.slotId);
    setError('');
    try {
      await careApi.book(token, { slotId: slot.slotId });
      // The newest caretaker event is the one just written — flagged so the
      // ledger can play its arrival rather than have it appear already there.
      await refresh();
      setBooking(false);
      setSlots(null);
    } catch (err) {
      setError(err?.response?.status === 409
        ? 'That time was just taken. Please pick another.'
        : 'Could not reserve that time. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="cv">
      <motion.header
        className="cv__head"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <p className="cv__eyebrow">Shared with you</p>
        <h1 className="cv__name">{data.name || 'A patient'}</h1>
        <p className="cv__note">
          Only what {data.name || 'she'} chose to share. You can tick off medicine, book a
          time and leave a note — nothing here can cancel, pay, or remove anything.
        </p>
      </motion.header>

      {has('conditions') && data.chart && (
        <section className="cv__card cv__card--urgent">
          <h2 className="cv__card-title"><IconStethoscope size={16} /> In an emergency</h2>
          <dl className="cv__facts">
            {data.chart.bloodGroup && (
              <div><dt>Blood group</dt><dd>{data.chart.bloodGroup}</dd></div>
            )}
            {data.chart.allergies?.length > 0 && (
              <div><dt>Allergies</dt><dd>{data.chart.allergies.join(', ')}</dd></div>
            )}
            {data.chart.conditions?.length > 0 && (
              <div><dt>Conditions</dt><dd>{data.chart.conditions.map(conditionLabel).join(', ')}</dd></div>
            )}
          </dl>
        </section>
      )}

      {has('appointments') && (
        <section className="cv__card">
          <h2 className="cv__card-title"><IconAppointment size={16} /> Appointments</h2>
          {data.appointments?.length ? (
            <ul className="cv__list">
              {data.appointments.map((a, i) => (
                <li key={i} className="cv__row">
                  <span className="cv__row-main">{a.doctor}</span>
                  <span className="cv__row-meta">
                    {a.specialty} · {new Date(`${a.date}T00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {a.time}
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className="cv__empty">Nothing scheduled.</p>}
        </section>
      )}

      {has('medicines') && (
        <section className="cv__card">
          <h2 className="cv__card-title"><IconPill size={16} /> Medicines</h2>
          {data.medicines?.length ? (
            <ul className="cv__list cv__list--roomy">
              {data.medicines.map((m) => (
                <li key={m.id ?? m.name} className="cv__med">
                  <div className="cv__med-head">
                    <span className="cv__row-main">{m.name}</span>
                    <span className="cv__row-meta">{[m.dose, m.frequency].filter(Boolean).join(' · ')}</span>
                  </div>
                  {/* One button per dose. This is the thing a caretaker is
                      actually doing all day, and the page could previously only
                      describe it back to her. */}
                  {data.canMarkDoses && m.times?.length > 0 && (
                    <div className="cv__doses">
                      {m.times.map((t) => {
                        const done = m.takenToday?.includes(t);
                        const busyHere = dosing === `${m.id}:${t}`;
                        return (
                          <button
                            key={t}
                            type="button"
                            className={`cv__dose${done ? ' cv__dose--done' : ''}`}
                            disabled={done || dosing !== null}
                            aria-pressed={done}
                            onClick={() => markDose(m, t)}
                          >
                            <span className="cv__dose-time">{t}</span>
                            <span className="cv__dose-state">
                              {busyHere ? 'Saving…' : done ? 'Given' : 'Mark given'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : <p className="cv__empty">No current medicines.</p>}
          {data.canMarkDoses && data.medicines?.length > 0 && (
            <p className="cv__hint">
              Marking a dose records that you gave it, under your name — {data.name || 'she'} and
              her doctor both see who ticked it.
            </p>
          )}
        </section>
      )}

      {has('contacts') && data.contacts?.length > 0 && (
        <section className="cv__card">
          <h2 className="cv__card-title"><IconPhone size={16} /> Who to call</h2>
          <ul className="cv__list">
            {data.contacts.map((c, i) => (
              <li key={i} className="cv__row">
                <a className="cv__row-main cv__link" href={`tel:${c.phone}`}>{c.name}</a>
                <span className="cv__row-meta">{[c.relation, c.phone].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Booking. A caretaker adds care and never removes it — so this is the
          only action on the page, and it says plainly where it stops. */}
      {data.canBook && (
        <section className="cv__card">
          <h2 className="cv__card-title"><IconAppointment size={16} /> Book an appointment</h2>
          {!booking ? (
            <>
              <button className="btn btn--primary" onClick={openBooking}>Find a time</button>
              <p className="cv__hint">
                You can reserve a time. {data.name || 'She'} confirms and pays in her own app —
                so nothing is charged to you, and the final say stays hers.
              </p>
            </>
          ) : (
            <>
              {slots === null ? (
                <p className="cv__empty">Loading times…</p>
              ) : slots.length === 0 ? (
                <p className="cv__empty">No open times right now.</p>
              ) : (
                <div className="cv__slots">
                  {slots.slice(0, 12).map((sl) => (
                    <button
                      key={sl.slotId}
                      type="button"
                      className="cv__slot"
                      disabled={busy !== null}
                      onClick={() => reserve(sl)}
                    >
                      <span className="cv__slot-doc">{sl.doctor}</span>
                      <span className="cv__slot-when">
                        {new Date(`${sl.date}T00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} · {sl.time}
                      </span>
                      <span className="cv__slot-fee">
                        {busy === sl.slotId ? 'Reserving…' : `₹${sl.price}`}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <button className="btn btn--ghost" onClick={() => setBooking(false)} disabled={busy !== null}>
                Cancel
              </button>
            </>
          )}
          {error && <p className="cv__error" role="alert">{error}</p>}
        </section>
      )}

      {/* The thread. Both of you are reading this same list. */}
      <section className="cv__card">
        <h2 className="cv__card-title">What&rsquo;s been happening</h2>
        <CareLedger events={data.events} patientName={data.name} freshId={freshId} />
        {/* The thread claimed both of you were reading it while only one of you
            could write to it. */}
        <form className="cv__note-form" onSubmit={leaveNote}>
          <label className="cv__note-label" htmlFor="cv-note">Add to the thread</label>
          <textarea
            id="cv-note"
            className="cv__note-input"
            rows={2}
            maxLength={280}
            value={note}
            placeholder="e.g. Took her to Dr Sharma today — blood pressure was fine."
            onChange={(e) => setNote(e.target.value)}
          />
          <button className="btn btn--secondary" type="submit" disabled={!note.trim() || noting}>
            {noting ? 'Adding…' : 'Add note'}
          </button>
        </form>
        <p className="cv__hint">
          {data.name || 'She'} sees this same thread, and is told whenever you do something here.
        </p>
      </section>

      <p className="cv__foot">
        Shared through Amruni. The person who shared this can turn the link off at any time.
      </p>
    </div>
  );
}
