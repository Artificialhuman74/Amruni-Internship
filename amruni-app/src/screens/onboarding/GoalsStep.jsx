import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { meApi } from '../../services/api';
import { GOALS, resolveFromGoal } from '../../lib/lifeStage';
import { OnboardHeader } from './NameStep';
import { confirm as confirmHaptic, tap } from '../../lib/haptics';

const list = { hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } } };
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } } };

export default function GoalsStep() {
  const navigate = useNavigate();
  const { state, dispatch } = useApp();
  const [selected, setSelected] = useState(state.user.goal || null);
  const [saving, setSaving] = useState(false);

  async function finish() {
    if (!selected || saving) return;
    setSaving(true);
    confirmHaptic();

    const { lifeStage, pregnancyMode, weightTracking } = resolveFromGoal(state.user.dob, selected);
    const name = state.user.name?.trim() || null;
    const goal = GOALS.find((g) => g.id === selected);

    dispatch({ type: 'SET_USER', payload: { goal: selected, lifeStage, isOnboarded: true } });
    dispatch({ type: 'SET_SETTINGS', payload: { pregnancyMode, weightTracking } });

    try {
      await meApi.patch({ name, dob: state.user.dob, lifeStage, isOnboarded: true });
    } catch (err) {
      console.warn('Onboarding save will retry via background sync.', err);
    }

    // Goals whose feature isn't built yet land on the Coming-soon page.
    if (goal?.soon) {
      navigate('/coming-soon', { replace: true, state: { feature: goal.label, goalId: goal.id } });
    } else {
      navigate('/home', { replace: true });
    }
  }

  return (
    <div className="screen screen--light">
      <div className="onb-page">
        <OnboardHeader step={4} onBack={() => navigate('/onboarding/health')} />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{ marginTop: 'var(--sp-4)' }}
        >
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 600, color: 'var(--clr-ink)', lineHeight: 'var(--leading-tight)', textWrap: 'balance' }}>
            What brings you to Amruni?
          </h1>
          <p style={{ marginTop: 'var(--sp-2)', fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)' }}>
            Pick what matters most today — you can explore everything else too.
          </p>
        </motion.div>

        <motion.div
          variants={list}
          initial="hidden"
          animate="show"
          style={{ marginTop: 'var(--sp-5)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', overflowY: 'auto', flex: 1, paddingBottom: 'var(--sp-2)' }}
        >
          {GOALS.map((g) => {
            const on = selected === g.id;
            return (
              <motion.button
                key={g.id}
                variants={item}
                className={`goal-tile${on ? ' goal-tile--on' : ''}`}
                onClick={() => { setSelected(g.id); tap(); }}
                aria-pressed={on}
                whileTap={{ scale: 0.98 }}
              >
                <span className="goal-tile__icon" aria-hidden="true"><g.Icon size={22} /></span>
                <span style={{ flex: 1, textAlign: 'left' }}>
                  <span className="goal-tile__title">{g.label}</span>
                  <span className="goal-tile__desc">{g.desc}</span>
                </span>
                <span className={`goal-tile__check${on ? ' goal-tile__check--on' : ''}`} aria-hidden="true">
                  {on && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  )}
                </span>
              </motion.button>
            );
          })}
        </motion.div>

        <button className="btn btn--primary" onClick={finish} disabled={!selected || saving} style={{ opacity: selected ? 1 : 0.5, marginTop: 'var(--sp-3)' }}>
          {saving ? 'Setting up…' : 'Enter Amruni'}
        </button>
      </div>
    </div>
  );
}
