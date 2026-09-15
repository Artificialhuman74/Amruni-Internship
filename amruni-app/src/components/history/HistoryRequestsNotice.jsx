import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { historyApi } from '../../services/historyApi';
import { tap } from '../../lib/haptics';

/**
 * On Home, only while a doctor is waiting for her answer. Says who and how
 * many, and nothing about what was asked — Home is the screen most likely to
 * be open when someone else is looking at her phone.
 */
export default function HistoryRequestsNotice() {
  const navigate = useNavigate();
  const [pending, setPending] = useState([]);

  useEffect(() => {
    let cancelled = false;
    historyApi.requests()
      .then((all) => { if (!cancelled) setPending(all.filter((r) => r.status === 'pending')); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!pending.length) return null;
  const first = pending[0];
  return (
    <button type="button" className="hreq-notice" onClick={() => { tap(); navigate('/health-record'); }}>
      <span className="hreq-notice__dot" aria-hidden="true" />
      <span className="hreq-notice__text">
        <strong>{pending.length === 1 ? first.doctorName : `${pending.length} doctors`}</strong>
        {pending.length === 1 ? ' asked to see more of your health record' : ' asked to see more of your health record'}
      </span>
      <span className="hreq-notice__go">Review</span>
    </button>
  );
}
