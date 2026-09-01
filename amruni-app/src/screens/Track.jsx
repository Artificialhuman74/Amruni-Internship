import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import TrackSwitch from '../components/ui/TrackSwitch';
import CycleTracker from './CycleTracker';
import Pregnancy from './Pregnancy';
import WeightTracker from './WeightTracker';
import Conceive from './Conceive';

/**
 * Track, with a switch at the top.
 *
 * The first pane is whatever her body is doing — her cycle, or her pregnancy.
 * After it come the panes she has asked for: the fertile window if she is
 * trying to conceive, and weight.
 *
 * Both of those are opt-in, and both asymmetries are deliberate. Weight is
 * automatic only in pregnancy, where it is clinical guidance she is expected
 * to follow; everywhere else it is a number this product's own brief warns can
 * do harm, so nobody is handed a scale they did not ask for. The fertile
 * window is the same argument from the other direction — for a woman who is
 * not trying, a tab counting down to ovulation every month is a monthly
 * reminder of a decision she has already made.
 */

const EXPO = [0.16, 1, 0.3, 1];

export default function Track() {
  const { state, dispatch } = useApp();
  const reduce = useReducedMotion();
  const pregnancyMode = Boolean(state.settings?.pregnancyMode);
  // Pregnant and trying to conceive are not a state anyone occupies at once,
  // and the pregnancy pane is the one that matters if the flags disagree.
  const conceiveOn = !pregnancyMode && Boolean(state.settings?.conceiveMode);
  const weightOn = pregnancyMode || Boolean(state.settings?.weightTracking);

  const [pane, setPane] = useState('body');

  const Body = pregnancyMode ? Pregnancy : CycleTracker;
  const panes = [
    { id: 'body', label: pregnancyMode ? 'Pregnancy' : 'Cycle', Screen: Body },
    ...(conceiveOn ? [{ id: 'conceive', label: 'Conceive', Screen: Conceive }] : []),
    ...(weightOn ? [{ id: 'weight', label: 'Weight', Screen: WeightTracker }] : []),
  ];

  // A switch with one segment is a label pretending to be a control.
  if (panes.length === 1) {
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

  const index = Math.max(0, panes.findIndex((p) => p.id === pane));
  const Active = panes[index].Screen;

  return (
    <div className="screen screen--light">
      <div className="trk__switch">
        <TrackSwitch
          value={panes[index].id}
          onChange={setPane}
          options={panes.map(({ id, label }) => ({ id, label }))}
        />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {/* Slides the way the segment moved, so the panes read as one row
            being scrolled rather than as screens replacing each other. */}
        <motion.div
          key={panes[index].id}
          initial={reduce ? { opacity: 0 } : { opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, x: -18 }}
          transition={{ duration: reduce ? 0.15 : 0.3, ease: EXPO }}
        >
          <Active />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
