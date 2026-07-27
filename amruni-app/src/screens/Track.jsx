import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import TrackSwitch from '../components/TrackSwitch';
import CycleTracker from './CycleTracker';
import Pregnancy from './Pregnancy';
import WeightTracker from './WeightTracker';

/**
 * Track, with a switch at the top.
 *
 * The first pane is whatever her body is doing — her cycle, or her pregnancy.
 * The second is weight.
 *
 * Weight is opt-in everywhere except pregnancy, and that asymmetry is
 * deliberate. In pregnancy it is clinical guidance she is expected to follow.
 * Everywhere else it is a number this product's own brief warns can do harm —
 * PRODUCT.md names body image as a core adolescent concern — so nobody is
 * handed a scale they did not ask for. The switch simply isn't there until
 * she turns it on.
 */

const EXPO = [0.16, 1, 0.3, 1];

export default function Track() {
  const { state, dispatch } = useApp();
  const reduce = useReducedMotion();
  const pregnancyMode = Boolean(state.settings?.pregnancyMode);
  const weightOn = pregnancyMode || Boolean(state.settings?.weightTracking);

  const [pane, setPane] = useState('body');

  const Body = pregnancyMode ? Pregnancy : CycleTracker;

  if (!weightOn) {
    return (
      <div className="screen screen--light">
        <Body />
        {/* The offer, once, at the foot of her own screen — not a tab she has
            to look at every day until she accepts it. */}
        <div className="tsw__offer">
          <p className="tsw__offer-text">Want to track your weight here too?</p>
          <button
            className="btn btn--ghost"
            onClick={() => dispatch({ type: 'SET_SETTINGS', payload: { weightTracking: true } })}
          >
            Turn on weight tracking
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen screen--light">
      <div className="trk__switch">
        <TrackSwitch
          value={pane}
          onChange={setPane}
          options={[
            { id: 'body', label: pregnancyMode ? 'Pregnancy' : 'Cycle' },
            { id: 'weight', label: 'Weight' },
          ]}
        />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pane}
          initial={reduce ? { opacity: 0 } : { opacity: 0, x: pane === 'weight' ? 18 : -18 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, x: pane === 'weight' ? -18 : 18 }}
          transition={{ duration: reduce ? 0.15 : 0.3, ease: EXPO }}
        >
          {pane === 'body' ? <Body /> : <WeightTracker />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
