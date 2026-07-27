import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { medsApi } from '../../services/api/medsApi'
import { useApp } from '../../app/providers/AppContext'
import { startReminders, stopReminders, permissionState } from '../../services/reminders'
import { tap } from '../../utils/haptics'
import { IconPill } from '../../components/common/Icons.jsx'

/**
 * Today's doses, on Home.
 *
 * Renders nothing at all when she isn't taking anything — most women aren't,
 * most of the time, and a permanent empty "Medicines" card is how Home starts
 * feeling like an admin console instead of hers.
 *
 * This is also where the reminder loop is started, because it is the one place
 * that already knows what is due today.
 */
export default function MedicinesCard() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const { state } = useApp();
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    medsApi.list()
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!state.settings.notifications || permissionState() !== 'granted') {
      stopReminders();
      return undefined;
    }
    startReminders(async () => (await medsApi.list()).today);
    return stopReminders;
  }, [state.settings.notifications]);

  if (!data || data.today.length === 0) return null;

  const done = data.today.filter((d) => d.taken).length;
  const total = data.today.length;
  const allDone = done === total;

  return (
    <motion.button
      type="button"
      className={`med-card${allDone ? ' med-card--done' : ''}`}
      onClick={() => { tap(); navigate('/medicines'); }}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      aria-label="Open your medicines"
    >
      <span className="med-card__mark" aria-hidden="true"><IconPill size={22} /></span>
      <span className="med-card__body">
        <span className="med-card__title">
          {allDone ? 'All your medicine is taken' : `${total - done} dose${total - done === 1 ? '' : 's'} left today`}
        </span>
        <span className="med-card__meta">
          {allDone
            ? 'Nothing more due today'
            : data.today.filter((d) => !d.taken).slice(0, 2).map((d) => d.name).join(', ')}
        </span>
      </span>
      <span className="med-card__count">{done}/{total}</span>
    </motion.button>
  );
}
