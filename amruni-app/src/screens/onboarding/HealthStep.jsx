import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { meApi } from '../../services/api';
import { OnboardHeader } from './NameStep';
import ConditionPicker from '../../components/onboarding/ConditionPicker';
import { CYCLE_AFFECTING } from '../../data/conditions';
import { tap, confirm as confirmHaptic } from '../../lib/haptics';

/**
 * "Is there anything we should already know?"
 *
 * Asked once, at the start, so she never has to explain it again — not to the
 * app, and not at the beginning of every consultation. What she says here goes
 * straight into the chart her doctor opens, and into the cycle model, which
 * stops claiming a precise date for a body that a thyroid condition or PCOS
 * makes genuinely less predictable.
 *
 * Entirely skippable. A screen that demands a medical history before letting
 * her in would lose exactly the hesitant first-time user this product is for.
 */
export default function HealthStep() {
  const navigate = useNavigate();
  const { state, dispatch } = useApp();

  const [selected, setSelected] = useState(state.health?.conditions ?? []);
  const [saving, setSaving] = useState(false);

  const affectsCycle = selected.filter((id) => CYCLE_AFFECTING.includes(id));

  async function save(next) {
    setSaving(true);
    dispatch({ type: 'SET_HEALTH', payload: { conditions: next } });
    try {
      await meApi.putHealth({
        conditions: next,
        allergies: state.health?.allergies ?? [],
        bloodGroup: state.health?.bloodGroup ?? null,
      });
    } catch {
      // Saved locally and pushed again on the next sync — never block onboarding
      // on a network that may not be there.
    }
    confirmHaptic();
    navigate('/onboarding/goals');
  }

  return (
    <div className="screen screen--light">
      <div className="onb-page onb-page--fixed">
        <OnboardHeader step={3} onBack={() => navigate('/onboarding/dob')} />

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          style={{ marginBottom: 'var(--sp-5)' }}
        >
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--clr-ink)', letterSpacing: '-0.02em', textWrap: 'balance' }}>
            Anything we should already know?
          </h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginTop: 'var(--sp-2)', lineHeight: 'var(--leading-base)', textWrap: 'pretty' }}>
            Conditions you already live with. Your doctor sees these at your first
            consultation, so you don&rsquo;t have to start by explaining them.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
          style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
        >
          <ConditionPicker selected={selected} onChange={setSelected} />
        </motion.div>

        {/* Says what the answer will actually change. Nobody fills in a health
            form for its own sake. */}
        {affectsCycle.length > 0 && (
          <motion.p
            className="onb-note"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            Because of {affectsCycle.length === 1 ? 'this' : 'these'}, your period predictions
            will show an honest range instead of a single date.
          </motion.p>
        )}

        <div className="onb-actions">
          <button className="btn btn--primary" onClick={() => save(selected)} disabled={saving}>
            {saving ? 'Saving…' : selected.length ? `Continue with ${selected.length}` : 'Continue'}
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => { tap(); navigate('/onboarding/goals'); }}
            disabled={saving}
          >
            {selected.length ? 'Skip for now' : 'I’d rather not say'}
          </button>
        </div>
      </div>
    </div>
  );
}
