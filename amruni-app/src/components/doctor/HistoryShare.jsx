import { useState } from 'react';
import BottomSheet from '../BottomSheet';
import { CATEGORY_BY_ID } from '../../data/history';
import { doctorApi, doctorApiError } from '../../services/doctorApi';
import { useToast } from '../Toast';

/**
 * What the patient shared, said at the top of her chart.
 *
 * The single most dangerous reading of a partly-shared chart is an empty
 * section taken as a negative: no allergies listed, so no allergies. So every
 * withheld section is named here AND at the section itself, and "limited" is
 * phrased as an instruction — ask her — rather than as a status.
 */
export function ShareBanner({ share, requests = [], onRequested, userId }) {
  const [open, setOpen] = useState(false);
  if (!share) return null;

  // "Documents" counts as withheld only if a document actually is — she can
  // untick the category and still hand over one prescription individually.
  const hidden = (share.hidden ?? []).filter((c) => c !== 'documents' || share.hiddenDocuments > 0);
  const pending = requests.find((r) => r.status === 'pending');
  const latest = requests[0];

  if (share.mode === 'all' && !hidden.length) {
    return (
      <section className="share-banner share-banner--all" aria-label="History sharing">
        <p className="share-banner__title">{share.legacy ? 'Full history available' : 'She shared her full history'}</p>
        <p className="share-banner__body">
          {share.legacy
            ? 'Booked before patients chose what to share, so this chart shows her whole record.'
            : 'Everything on her health record is shown below.'}
        </p>
      </section>
    );
  }

  const none = share.mode === 'none';
  return (
    <section className={`share-banner share-banner--${none ? 'none' : 'limited'}`} aria-label="History sharing">
      <p className="share-banner__title">
        {none ? 'She chose not to share her health history' : 'She shared only part of her health history'}
      </p>
      <p className="share-banner__body">
        {none
          ? 'Nothing from her record is shown. Ask her directly what you need to know before prescribing.'
          : 'Sections she did not share are marked below. Ask her about them before relying on this chart — an empty section here does not mean there is nothing to know.'}
      </p>
      {!none && (
        <p className="share-banner__hidden">
          <span>Not shared:</span>{' '}
          {hidden
            .map((c) => (c === 'documents'
              ? `${share.hiddenDocuments} document${share.hiddenDocuments === 1 ? '' : 's'}`
              : CATEGORY_BY_ID[c]?.doctor ?? c))
            .join(' · ')}
        </p>
      )}

      {pending ? (
        <p className="share-banner__status">Your request is waiting for her answer.</p>
      ) : (
        <>
          {latest && (
            <p className="share-banner__status">
              {latest.status === 'granted'
                ? `She allowed: ${latest.granted.map((c) => CATEGORY_BY_ID[c]?.doctor ?? c).join(', ')}.`
                : 'She chose to keep your last request private.'}
            </p>
          )}
          <button type="button" className="share-banner__cta" onClick={() => setOpen(true)}>
            Request more information
          </button>
        </>
      )}

      <RequestSheet
        open={open}
        onClose={() => setOpen(false)}
        hidden={share.hidden ?? []}
        userId={userId}
        onSent={(req) => { setOpen(false); onRequested?.(req); }}
      />
    </section>
  );
}

function RequestSheet({ open, onClose, hidden, userId, onSent }) {
  const toast = useToast();
  const [picked, setPicked] = useState([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    try {
      const req = await doctorApi.requestHistory(userId, picked, message.trim() || null);
      toast('Request sent. She will be asked in her app.', { icon: 'check' });
      setPicked([]); setMessage('');
      onSent(req);
    } catch (err) {
      toast(doctorApiError(err, 'Could not send the request.'), { icon: 'warning' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Request more information">
      <div className="req-sheet">
        <p className="req-sheet__intro">
          She decides. Say why you need it — a reason is the difference between a request that is
          answered and one that is declined.
        </p>
        <div className="req-sheet__cats">
          {hidden.map((id) => {
            const on = picked.includes(id);
            return (
              <label key={id} className={`req-cat${on ? ' req-cat--on' : ''}`}>
                <input type="checkbox" checked={on} onChange={() => setPicked((p) => (on ? p.filter((x) => x !== id) : [...p, id]))} />
                {CATEGORY_BY_ID[id]?.doctor ?? id}
              </label>
            );
          })}
        </div>
        <label className="req-sheet__field">
          <span>Reason</span>
          <textarea
            rows={3}
            maxLength={500}
            value={message}
            placeholder="e.g. Before starting a new medicine I need to check for interactions with what she already takes."
            onChange={(e) => setMessage(e.target.value)}
          />
        </label>
        <button type="button" className="btn btn--primary" onClick={send} disabled={!picked.length || busy}>
          {busy ? 'Sending…' : picked.length ? `Ask for ${picked.length} section${picked.length === 1 ? '' : 's'}` : 'Choose what you need'}
        </button>
      </div>
    </BottomSheet>
  );
}

/** In place of a section she did not share. Never an empty section. */
export function NotShared({ category }) {
  return (
    <p className="not-shared">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
        <path d="M8 11V8a4 4 0 118 0v3" stroke="currentColor" strokeWidth="2" />
      </svg>
      {CATEGORY_BY_ID[category]?.doctor ?? 'This section'} — not shared by the patient. Ask her.
    </p>
  );
}

/** Surgeries, family history and notes she recorded herself. */
export function PatientHistory({ history, hidden }) {
  const blocks = [
    { id: 'procedures', title: 'Surgeries & hospital stays', rows: history?.procedures, main: (i) => i.name, sub: (i) => [i.year, i.hospital, i.notes].filter(Boolean).join(' · ') },
    { id: 'family', title: 'Family history (patient-reported)', rows: history?.family, main: (i) => `${i.relation}: ${i.condition}`, sub: (i) => i.notes },
    { id: 'notes', title: 'Other notes from the patient', rows: history?.notes, main: (i) => i.text, sub: () => null },
  ];
  return (
    <div className="ph">
      {blocks.map((b) => (
        <div key={b.id} className="ph-block">
          <p className="ph-block__title">{b.title}</p>
          {hidden.includes(b.id) ? (
            <NotShared category={b.id} />
          ) : !b.rows?.length ? (
            <p className="ph-block__empty">None recorded by the patient.</p>
          ) : (
            <ul className="ph-block__list">
              {b.rows.map((r) => (
                <li key={r.id}>
                  <span className="ph-block__main">{b.main(r)}</span>
                  {b.sub(r) && <span className="ph-block__sub">{b.sub(r)}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
