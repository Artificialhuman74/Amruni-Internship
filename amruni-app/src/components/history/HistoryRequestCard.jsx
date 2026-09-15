import { useState } from 'react';
import { CATEGORY_BY_ID } from '../../data/history';
import { historyApi } from '../../services/historyApi';
import { apiError } from '../../services/api';
import { useToast } from '../Toast';
import { tap, confirm as confirmHaptic } from '../../lib/haptics';

/**
 * A doctor asking to see more. She can allow all of it, some of it, or none.
 *
 * Every asked-for section starts ticked because the doctor gave a reason and
 * most women will agree — but "Allow" says exactly what it grants, and
 * unticking one is a single tap. Declining is a plain button of equal weight:
 * a refusal styled as the lesser option is a refusal the design argued
 * against.
 */
export default function HistoryRequestCard({ request, onDone }) {
  const toast = useToast();
  const [picked, setPicked] = useState(request.categories);
  const [busy, setBusy] = useState(false);

  async function answer(allow) {
    setBusy(true);
    try {
      const res = await historyApi.respond(request.id, allow, allow ? picked : []);
      confirmHaptic();
      toast(res.status === 'granted' ? `Shared with ${request.doctorName}` : 'Kept private', { icon: 'check' });
      onDone?.(res);
    } catch (err) {
      toast(apiError(err, 'That didn’t go through. Try again.'), { icon: 'warning' });
      setBusy(false);
    }
  }

  const n = picked.length;
  return (
    <article className="hreq" aria-label={`Request from ${request.doctorName}`}>
      <p className="hreq__who">{request.doctorName} <span>· {request.doctorSpecialty}</span></p>
      <p className="hreq__ask">would like to see more of your health history</p>
      {request.message && <blockquote className="hreq__why">“{request.message}”</blockquote>}

      <div className="hreq__cats">
        {request.categories.map((id) => {
          const on = picked.includes(id);
          return (
            <label key={id} className={`hreq__cat${on ? ' hreq__cat--on' : ''}`}>
              <input
                type="checkbox"
                checked={on}
                onChange={() => { tap(); setPicked((p) => (on ? p.filter((x) => x !== id) : [...p, id])); }}
              />
              {CATEGORY_BY_ID[id]?.patient ?? id}
            </label>
          );
        })}
      </div>

      <div className="hreq__actions">
        <button type="button" className="hreq__btn" onClick={() => answer(false)} disabled={busy}>
          Keep private
        </button>
        <button type="button" className="hreq__btn hreq__btn--allow" onClick={() => answer(true)} disabled={busy || !n}>
          {n === request.categories.length ? 'Allow' : `Allow ${n} of ${request.categories.length}`}
        </button>
      </div>
    </article>
  );
}
