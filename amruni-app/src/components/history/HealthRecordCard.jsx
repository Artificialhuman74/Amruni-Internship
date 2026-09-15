import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { historyApi } from '../../services/historyApi';
import { countsFor } from '../../data/history';
import { IconRecords, IconLock } from '../../icons.jsx';
import { tap } from '../../lib/haptics';

/**
 * Home's way into her health record.
 *
 * Until now the record was reachable only from Settings, which means a woman
 * found out it existed when a doctor asked to see it. The card says what is
 * in it, or invites her to start, and repeats the one fact that makes
 * starting feel safe: nothing is shared until she chooses.
 */
export default function HealthRecordCard() {
  const navigate = useNavigate();
  const [history, setHistory] = useState(null);

  useEffect(() => {
    let cancelled = false;
    historyApi.get().then((h) => { if (!cancelled) setHistory(h); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const counts = countsFor(history);
  const parts = [
    counts.conditions && `${counts.conditions} condition${counts.conditions === 1 ? '' : 's'}`,
    counts.medications && `${counts.medications} medicine${counts.medications === 1 ? '' : 's'}`,
    counts.documents && `${counts.documents} document${counts.documents === 1 ? '' : 's'}`,
  ].filter(Boolean);
  const empty = history && !Object.values(counts).some(Boolean);

  return (
    <button type="button" className="hr-card" onClick={() => { tap(); navigate('/health-record'); }}>
      <span className="hr-card__icon" aria-hidden="true"><IconRecords size={22} /></span>
      <span className="hr-card__body">
        <span className="hr-card__title">My health record</span>
        <span className="hr-card__desc">
          {!history
            ? 'Conditions, medicines, prescriptions and reports'
            : empty
              ? 'Add conditions, medicines and prescriptions once.'
              : parts.length ? parts.join(' · ') : 'Your history is on file'}
        </span>
        <span className="hr-card__meta"><IconLock size={12} /> Shared only when you choose</span>
      </span>
      <span className="hr-card__go">{empty ? 'Start' : 'Open'}</span>
    </button>
  );
}
