import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useApp } from '../../../context/AppContext';
import { BottomSheet } from '../../shared';

// Must stay in exact sync with the Home-screen mood-logging card — both read
// and write state.pregnancy.loggedDays[date].mood/valence.
const MOOD_BANDS = [
  { valence: -3, label: 'Very Unpleasant', words: ['Anxious about baby', 'Overwhelmed', 'Exhausted', 'Nauseous', 'Scared'] },
  { valence: -2, label: 'Unpleasant', words: ['Uncomfortable', 'Irritable', 'Drained', 'Achy', 'Worried'] },
  { valence: -1, label: 'Slightly Unpleasant', words: ['Restless', 'Tired', 'Uneasy', 'Sensitive', 'Low'] },
  { valence: 0, label: 'Neutral', words: ['Calm', 'Steady', 'Quiet', 'Reflective', 'Unsure'] },
  { valence: 1, label: 'Slightly Pleasant', words: ['Content', 'Hopeful', 'Relieved', 'Comfortable', 'Grateful'] },
  { valence: 2, label: 'Pleasant', words: ['Peaceful', 'Joyful', 'Connected', 'Energised', 'Glowing'] },
  { valence: 3, label: 'Very Pleasant', words: ['Radiant', 'Elated', 'Blessed', 'Amazed', 'Overjoyed'] },
];

const SYMPTOMS = ['Nausea', 'Fatigue', 'Back pain', 'Swelling', 'Heartburn', 'Cramping', 'Headache', 'Food aversion', 'Breathlessness', 'Insomnia'];

export default function PregnancySymptoms() {
  const { state, dispatch } = useApp();
  const reduce = useReducedMotion();
  const [editOpen, setEditOpen] = useState(false);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const todayEntry = state.pregnancy.loggedDays?.[today];
  const symptoms = todayEntry?.symptoms || [];

  const currentBand = useMemo(() => {
    if (!todayEntry || todayEntry.valence === undefined || todayEntry.valence === null) return null;
    return MOOD_BANDS.find(b => b.valence === todayEntry.valence) || null;
  }, [todayEntry]);

  function toggleSymptom(symptom) {
    const next = symptoms.includes(symptom)
      ? symptoms.filter(s => s !== symptom)
      : [...symptoms, symptom];
    dispatch({ type: 'LOG_PREGNANCY_DAY', date: today, data: { symptoms: next } });
  }

  function pickMoodWord(word) {
    dispatch({ type: 'LOG_PREGNANCY_DAY', date: today, data: { mood: word } });
    setEditOpen(false);
  }

  return (
    <motion.div
      initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}
    >
      {/* Today's mood — read-back */}
      <div>
        <p className="section-title">Today's mood</p>
        {todayEntry?.mood ? (
          <button
            onClick={() => setEditOpen(true)}
            aria-haspopup="dialog"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', minHeight: 44,
              padding: 'var(--sp-3) var(--sp-4)',
              background: 'var(--clr-surface)', border: '1px solid var(--clr-border)',
              borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink)' }}>
              Today: <span style={{ fontWeight: 600 }}>{todayEntry.mood}</span>
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-subtle)' }}>tap to edit</span>
          </button>
        ) : (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-subtle)', fontStyle: 'italic' }}>
            No mood logged yet today
          </p>
        )}
      </div>

      {/* Physical symptoms */}
      <div>
        <p className="section-title">How is your body feeling today?</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
          {SYMPTOMS.map(symptom => {
            const active = symptoms.includes(symptom);
            return (
              <button
                key={symptom}
                type="button"
                className={`chip${active ? ' chip--active' : ''}`}
                aria-pressed={active}
                onClick={() => toggleSymptom(symptom)}
                style={{ minHeight: 44 }}
              >
                {symptom}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mood edit sheet — re-pick within today's already-logged valence band */}
      <BottomSheet open={editOpen} onClose={() => setEditOpen(false)} title="Update today's mood">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
          {(currentBand ? currentBand.words : []).map(word => (
            <button
              key={word}
              type="button"
              className={`chip${todayEntry?.mood === word ? ' chip--active' : ''}`}
              aria-pressed={todayEntry?.mood === word}
              onClick={() => pickMoodWord(word)}
              style={{ minHeight: 44 }}
            >
              {word}
            </button>
          ))}
        </div>
      </BottomSheet>
    </motion.div>
  );
}
