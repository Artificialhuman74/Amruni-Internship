import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { campApi } from '../services/campApi';
import { campDates, whenLabel } from '../lib/camps';
import { IconHospital, IconClose } from '../icons.jsx';
import { tap } from '../lib/haptics';

/**
 * The alert on Home about health camps that are coming up, running, or were
 * just held. Leads with the most relevant one and says how many others there
 * are. Dismissing hides these particular camps; a new camp brings it back.
 */
const DISMISSED_KEY = 'amruni_camps_dismissed';

function readDismissed() {
  try { return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]'); } catch { return []; }
}

export default function CampsNotice() {
  const navigate = useNavigate();
  const [camps, setCamps] = useState([]);
  const [dismissed, setDismissed] = useState(readDismissed);

  useEffect(() => {
    let cancelled = false;
    campApi.recent().then((c) => { if (!cancelled) setCamps(c); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const visible = camps.filter((c) => !dismissed.includes(c.id));
  if (!visible.length) return null;
  const lead = visible[0];
  const others = visible.length - 1;

  function dismiss(e) {
    e.stopPropagation();
    tap();
    const next = [...new Set([...dismissed, ...visible.map((c) => c.id)])];
    setDismissed(next);
    try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(next)); } catch { /* private mode */ }
  }

  return (
    <div
      className={`camp-notice camp-notice--${lead.status}`}
      role="button"
      tabIndex={0}
      onClick={() => { tap(); navigate('/camps'); }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/camps'); } }}
      aria-label={`${lead.title}, ${whenLabel(lead)}, ${lead.city}. ${others ? `${others} more camps. ` : ''}Open health camps`}
    >
      <span className="camp-notice__icon" aria-hidden="true"><IconHospital size={22} /></span>
      <span className="camp-notice__body">
        <span className="camp-notice__eyebrow">Health camp · {whenLabel(lead)}</span>
        <span className="camp-notice__title">{lead.title}</span>
        <span className="camp-notice__meta">
          {campDates(lead)} · {lead.venue}, {lead.city}
          {lead.fee === 0 ? ' · Free' : ''}
        </span>
        {others > 0 && <span className="camp-notice__more">+{others} more camp{others === 1 ? '' : 's'} near you</span>}
      </span>
      <button type="button" className="camp-notice__x" onClick={dismiss} aria-label="Dismiss camp alert">
        <IconClose size={16} />
      </button>
    </div>
  );
}
