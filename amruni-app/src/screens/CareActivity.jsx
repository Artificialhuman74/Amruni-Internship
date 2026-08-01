import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { careApi } from '../services/careApi';
import CareLedger from '../components/CareLedger';
import CareShares from '../components/CareShares';
import BottomSheet from '../components/BottomSheet';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/Toast';
import { tap } from '../lib/haptics';
import { IconSend } from '../icons.jsx';

/**
 * Her side of the shared thread.
 *
 * The ledger's own note says it is "not an activity log tucked behind a
 * settings screen" — and on the patient's side it was exactly that. A card on
 * Home announced that someone had helped, and then handed her to Settings,
 * where the care row sits between notification toggles and emergency contacts.
 * She was told something had happened and then made to go looking for it.
 *
 * The symmetry the whole feature rests on only holds if both people can
 * actually reach the thread. This is the other half of CareView: the same
 * events, the same order, plus the two things only she can do — see who is
 * holding a link right now, and take it back.
 *
 * Marked read on arrival rather than on the tap that brought her here. Reading
 * the card is not reading the thread, and clearing the badge before she has
 * seen anything is how a notification silently loses something.
 */
export default function CareActivity() {
  const navigate = useNavigate();
  const toast = useToast();
  const { state } = useApp();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [shareSheet, setShareSheet] = useState(false);

  const fetchAll = useCallback(
    () => Promise.all([careApi.events(), careApi.list().catch(() => [])]),
    [],
  );

  const load = useCallback(
    () => fetchAll().then(([events, shares]) => setData({ ...events, shares })).catch(() => {}),
    [fetchAll],
  );

  useEffect(() => {
    let cancelled = false;
    fetchAll()
      .then(([events, shares]) => {
        if (cancelled) return;
        setData({ ...events, shares });
        // Marked read now she is actually looking at the thread, not on the tap
        // that brought her here.
        if (events.unread > 0) careApi.markRead().catch(() => {});
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [fetchAll]);

  async function revoke(share) {
    if (!window.confirm(`Turn off the link for ${share.label || 'this person'}? They will not be able to open it again.`)) return;
    try {
      await careApi.revoke(share.token);
      toast('Link turned off', { icon: 'check' });
      load();
    } catch {
      toast('Could not turn that link off. Try again.', { icon: 'warning' });
    }
  }

  const live = (data?.shares ?? []).filter((s) => !s.revoked && !s.expired);
  const byCaretaker = (data?.events ?? []).filter((e) => e.actor === 'caretaker');

  return (
    <div className="screen screen--light">
      <div className="screen-header-nav">
        <button className="nav-back-btn" onClick={() => navigate(-1)} aria-label="Go back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <span className="nav-header-title">Care activity</span>
        <div style={{ width: 40 }} />
      </div>

      <div className="cact">
        <motion.p
          className="cact__lede"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          Everything anyone has done with your health record, yours included, in one thread.
          The people you have shared with see this same list.
        </motion.p>

        {failed && (
          <p className="cact__empty">Could not load this right now. Check your connection.</p>
        )}

        {/* Who is holding a key, and the button that takes it back. This is the
            half of the thread only she has — a caretaker can see what happened,
            she can see who can still make it happen again. */}
        <section className="cact__section" aria-label="Who has access">
          <h2 className="cact__title">Who can see your record</h2>
          {live.length === 0 ? (
            <p className="cact__empty">
              Nobody right now. You can give a family member a link that shows only what you choose.
            </p>
          ) : (
            <div className="cact__shares">
              {live.map((s) => (
                <div key={s.token} className="cact__share">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="cact__share-name">{s.label || 'Shared link'}</p>
                    <p className="cact__share-meta">
                      {s.viewCount > 0
                        ? `Opened ${s.viewCount} time${s.viewCount === 1 ? '' : 's'}`
                        : 'Not opened yet'}
                      {' · '}
                      {s.expiresAt
                        ? `until ${new Date(s.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
                        : 'no end date'}
                    </p>
                  </div>
                  <button className="cact__revoke" onClick={() => { tap(); revoke(s); }}>
                    Turn off
                  </button>
                </div>
              ))}
            </div>
          )}
          <button className="btn btn--secondary" style={{ marginTop: 'var(--sp-3)' }} onClick={() => { tap(); setShareSheet(true); }}>
            <IconSend size={17} /> Share with someone
          </button>
        </section>

        <section className="cact__section" aria-label="What has happened">
          <h2 className="cact__title">
            What has happened
            {byCaretaker.length > 0 && (
              <span className="cact__count">
                {' '}— {byCaretaker.length} by someone else
              </span>
            )}
          </h2>
          <CareLedger events={data?.events ?? []} patientName={state.user?.name} />
        </section>
      </div>

      <BottomSheet open={shareSheet} onClose={() => { setShareSheet(false); load(); }} title="Share with family">
        <CareShares />
      </BottomSheet>
    </div>
  );
}
