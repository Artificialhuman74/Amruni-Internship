import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { careApi, shareUrl } from '../services/careApi';
import CareLedger from './CareLedger';
import { useToast } from './Toast';
import { tap, confirm as confirmHaptic } from '../lib/haptics';

/**
 * Links she can hand to family.
 *
 * Built for elderly mode — where the person managing appointments is usually a
 * daughter rather than the patient — but available to anyone.
 *
 * Three things are always true of a link made here, and they are visible in
 * the UI rather than buried in a policy: it shows only what she ticked, it
 * expires, and she can switch it off. The view count is shown for the same
 * reason — a share she cannot audit is one she cannot really control.
 */

const SCOPES = [
  { id: 'appointments', label: 'Appointments', hint: 'What is coming up, and with whom' },
  { id: 'medicines', label: 'Medicines', hint: 'What she takes and when' },
  { id: 'contacts', label: 'Who to call', hint: 'Her emergency contacts' },
  { id: 'conditions', label: 'Emergency details', hint: 'Blood group, allergies, conditions' },
];

const DURATIONS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
];

export default function CareShares() {
  const toast = useToast();
  const [shares, setShares] = useState([]);
  const [events, setEvents] = useState([]);
  const [label, setLabel] = useState('');
  const [scopes, setScopes] = useState(['appointments', 'medicines']);
  const [days, setDays] = useState(30);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([careApi.list(), careApi.events().catch(() => ({ events: [] }))])
      .then(([list, ev]) => {
        if (cancelled) return;
        setShares(list ?? []);
        setEvents(ev?.events ?? []);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  async function create() {
    if (creating || scopes.length === 0) return;
    setCreating(true);
    try {
      const share = await careApi.create({ label: label.trim() || null, scopes, expiresInDays: days });
      setShares((prev) => [share, ...prev]);
      setLabel('');
      confirmHaptic();
      await copy(share.token, true);
    } catch {
      toast('Could not create that link. Try again.', { icon: 'warning' });
    } finally {
      setCreating(false);
    }
  }

  async function copy(token, isNew = false) {
    const url = shareUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      toast(isNew ? 'Link created and copied' : 'Link copied', { icon: 'check' });
    } catch {
      // Clipboard blocked (common in an in-app browser) — hand it over so she
      // can still copy it by hand rather than losing the link entirely.
      window.prompt('Copy this link:', url);
    }
  }

  async function revoke(token) {
    tap();
    try {
      await careApi.revoke(token);
      setShares((prev) => prev.map((s) => (s.token === token ? { ...s, revoked: true } : s)));
      toast('Link turned off', { icon: 'check' });
    } catch {
      toast('Could not turn that link off. Try again.', { icon: 'warning' });
    }
  }

  return (
    <div className="cs">
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', lineHeight: 'var(--leading-base)', textWrap: 'pretty' }}>
        Create a link for a family member or caretaker. They don&rsquo;t need the app or an
        account — they just open it. Your journal, moods and screening results are never
        included, and you can switch a link off at any time.
      </p>

      <div className="input-group">
        <label className="input-label" htmlFor="cs-label">Who is it for?</label>
        <input
          id="cs-label"
          className="input-field"
          value={label}
          placeholder="e.g. My daughter Priya"
          onChange={(e) => setLabel(e.target.value)}
        />
      </div>

      <div>
        <p className="input-label" style={{ marginBottom: 'var(--sp-2)' }}>What they can see</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {SCOPES.map((s) => {
            const on = scopes.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                className={`jc__flag${on ? ' jc__flag--on' : ''}`}
                aria-pressed={on}
                onClick={() => {
                  tap();
                  setScopes((prev) => (on ? prev.filter((x) => x !== s.id) : [...prev, s.id]));
                }}
              >
                <span className="jc__flag-box" aria-hidden="true">{on && '✓'}</span>
                <span>
                  <span className="jc__flag-title">{s.label}</span>
                  <span className="jc__flag-hint">{s.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="input-label" style={{ marginBottom: 'var(--sp-2)' }}>Stops working after</p>
        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          {DURATIONS.map((d) => (
            <button
              key={d.days}
              type="button"
              className={`chip${days === d.days ? ' chip--active' : ''}`}
              aria-pressed={days === d.days}
              onClick={() => { tap(); setDays(d.days); }}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <button className="btn btn--primary" onClick={create} disabled={creating || scopes.length === 0}>
        {creating ? 'Creating…' : 'Create link'}
      </button>

      {events.length > 0 && (
        <div>
          <p className="input-label" style={{ marginBottom: 'var(--sp-3)' }}>What&rsquo;s been happening</p>
          <CareLedger events={events} patientName="You" />
        </div>
      )}

      {shares.length > 0 && (
        <div>
          <p className="input-label" style={{ marginBottom: 'var(--sp-2)' }}>Your links</p>
          <AnimatePresence initial={false}>
            {shares.map((s) => (
              <motion.div
                key={s.token}
                className={`cs__share${s.revoked || s.expired ? ' cs__share--off' : ''}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ marginBottom: 'var(--sp-2)' }}
              >
                <div className="cs__share-head">
                  <span className="cs__share-label">{s.label || 'Shared link'}</span>
                  <span className="cs__share-meta">
                    {s.revoked ? 'Turned off' : s.expired ? 'Expired' : `Opened ${s.viewCount} time${s.viewCount === 1 ? '' : 's'}`}
                  </span>
                </div>
                <p className="cs__share-meta">
                  {s.expiresAt && !s.revoked
                    ? `Works until ${new Date(s.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                    : 'No longer active'}
                </p>
                <div className="cs__share-scopes">
                  {s.scopes.map((sc) => (
                    <span key={sc} className="chip chip--sm" style={{ cursor: 'default' }}>
                      {SCOPES.find((x) => x.id === sc)?.label ?? sc}
                    </span>
                  ))}
                </div>
                {!s.revoked && !s.expired && (
                  <div className="cs__share-actions">
                    <button type="button" className="cs__act cs__act--copy" onClick={() => copy(s.token)}>
                      Copy link
                    </button>
                    <button type="button" className="cs__act cs__act--revoke" onClick={() => revoke(s.token)}>
                      Turn off
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
