import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useMood } from '../context/MoodContext';
import { useToast } from './Toast';
import { tap } from '../lib/haptics';
import MoodFlower from './MoodFlower';
import { BANDS } from '../lib/moodScale';
import MoodSheet from './MoodSheet';

/**
 * The check-in on Home.
 *
 * It used to vanish for the rest of the day the moment she logged once, which
 * quietly said a day holds one feeling. It doesn't. Now the card keeps its
 * place and changes its offer: an invitation while the day is unlogged, a
 * short account of the day so far once it isn't — with the way back in still
 * on it.
 *
 * From late afternoon the primary action becomes summing the day up rather
 * than catching a moment, because by then there is a day to have an opinion
 * about.
 */

const EXPO = [0.16, 1, 0.3, 1];
const EVENING_HOUR = 17;

function timeLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

export default function DailyMoodCheckIn() {
  const { state } = useApp();
  const { log, todaysDay, todaysMoments } = useMood();
  const toast = useToast();
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  const pregnancyMode = Boolean(state.settings?.pregnancyMode);

  const [sheet, setSheet] = useState(null);   // null | 'moment' | 'day'
  const [saving, setSaving] = useState(false);

  const logged = todaysMoments.length > 0 || !!todaysDay;
  const evening = new Date().getHours() >= EVENING_HOUR;
  // Offer the day summary once the day is mostly spent and she hasn't given
  // one; otherwise the quick, low-cost action stays primary.
  const primaryScope = evening && !todaysDay ? 'day' : 'moment';

  function open(scope) {
    tap();
    setSheet(scope);
  }

  async function handleSave({ valence, intensity, word, factors, scope }) {
    setSaving(true);
    try {
      await log({ valence, intensity, word, factors, scope, source: 'checkin' });
      toast(
        scope === 'day' ? 'Today is logged. Thank you.' : 'Logged. Thank you for sharing.',
        { icon: 'heart' },
      );
      setSheet(null);
    } catch {
      toast('That didn’t save. Check your connection and try again.', { icon: 'warning' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={pregnancyMode ? 'preg-tint' : undefined}>
      <AnimatePresence mode="wait" initial={false}>
        {!logged ? (
          <motion.button
            key="invite"
            type="button"
            className="mood-entry"
            onClick={() => open(primaryScope)}
            aria-label="Start today's check-in"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: reduce ? 0.18 : 0.46, ease: EXPO }}
          >
            <span className="mood-entry__bloom" aria-hidden="true">
              <MoodFlower band={2} size={64} />
            </span>
            <span className="mood-entry__text">
              <span className="mood-entry__eyebrow">Check in</span>
              <span className="mood-entry__title">
                {primaryScope === 'day' ? 'How has today felt?' : 'How are you feeling?'}
              </span>
              <span className="mood-entry__hint">Takes about a minute</span>
            </span>
            <Chevron />
          </motion.button>
        ) : (
          <motion.div
            key="logged"
            className="mood-recap"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: reduce ? 0.18 : 0.42, ease: EXPO }}
          >
            <button
              type="button"
              className="mood-recap__head"
              onClick={() => navigate('/track')}
              aria-label="See your mood log in Track"
            >
              <span className="mood-recap__bloom" aria-hidden="true">
                <MoodFlower band={todaysDay?.valence ?? todaysMoments[0].valence} size={56} breathe={false} />
              </span>
              <span className="mood-entry__text">
                <span className="mood-entry__eyebrow">
                  {todaysDay ? 'Today, overall' : `Today · ${timeLabel(todaysMoments[0].loggedAt)}`}
                </span>
                <span className="mood-entry__title">
                  {todaysDay?.word || todaysMoments[0].word
                    || BANDS[String(todaysDay?.valence ?? todaysMoments[0].valence)].label}
                </span>
                <span className="mood-entry__hint">
                  {todaysMoments.length > 0
                    ? `${todaysMoments.length} moment${todaysMoments.length === 1 ? '' : 's'} logged today`
                    : 'See your log'}
                </span>
              </span>
              <Chevron />
            </button>

            <div className="mood-recap__actions">
              <button type="button" className="mood-recap__action" onClick={() => open('moment')}>
                Log this moment
              </button>
              {!todaysDay && (
                <button type="button" className="mood-recap__action" onClick={() => open('day')}>
                  Sum up today
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <MoodSheet
        open={sheet !== null}
        scope={sheet ?? 'moment'}
        pregnancyMode={pregnancyMode}
        saving={saving}
        onClose={() => !saving && setSheet(null)}
        onSave={handleSave}
      />
    </div>
  );
}

function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="mood-entry__chev">
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
