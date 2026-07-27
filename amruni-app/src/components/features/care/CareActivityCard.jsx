import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { careApi } from '../../../services/careApi';
import { useApp } from '../../../context/AppContext';
import { permissionState } from '../../../lib/reminders';
import { tap } from '../../../lib/haptics';
import { IconSend } from '../../../icons.jsx';

/**
 * "Someone did something for you."
 *
 * The in-app half of being told. It appears on Home only when a caretaker has
 * acted and she hasn't seen it yet — and it is the half that cannot fail:
 * push needs a permission she may never have granted, but this is simply
 * there, on the screen she opens anyway.
 *
 * Worded as help received rather than as an alert. A daughter booking her
 * mother's appointment is a kindness, and a card that announces it in the
 * register of a security warning would make the whole feature feel like
 * something to be afraid of.
 */
export default function CareActivityCard() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const { state } = useApp();
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    careApi.events()
      .then((d) => {
        if (cancelled) return;
        setData(d);
        // The push half. Fired once, for the newest unseen action, and only
        // with permission already granted — this is not the moment to ask.
        if (d.unread > 0 && state.settings.notifications && permissionState() === 'granted') {
          notifyLatest(d);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!data || data.unread === 0) return null;

  const latest = data.events.find((e) => e.actor === 'caretaker' && !e.read_at);

  return (
    <motion.button
      type="button"
      className="ca-card"
      onClick={async () => {
        tap();
        try { await careApi.markRead(); } catch { /* seen locally either way */ }
        navigate('/settings');
      }}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <span className="ca-card__mark" aria-hidden="true"><IconSend size={20} /></span>
      <span className="ca-card__body">
        <span className="ca-card__title">
          {data.unread === 1 ? 'Someone helped with your care' : `${data.unread} things were done for you`}
        </span>
        <span className="ca-card__text">{latest?.summary}</span>
      </span>
      <span className="ca-card__go" aria-hidden="true">→</span>
    </motion.button>
  );
}

const NOTIFIED_KEY = 'amruni_care_notified';

/** Never re-announces something she has already been shown. */
async function notifyLatest(data) {
  const latest = data.events.find((e) => e.actor === 'caretaker' && !e.read_at);
  if (!latest) return;
  try {
    if (localStorage.getItem(NOTIFIED_KEY) === latest.id) return;
    localStorage.setItem(NOTIFIED_KEY, latest.id);
    const reg = await navigator.serviceWorker?.getRegistration?.();
    const title = 'Someone helped with your care';
    const opts = { body: latest.summary, tag: `care-${latest.id}`, icon: '/icon.svg' };
    if (reg?.showNotification) await reg.showNotification(title, opts);
    else new Notification(title, opts);
  } catch { /* a blocked notification must never break Home */ }
}
