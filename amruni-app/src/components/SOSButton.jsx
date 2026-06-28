import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { useSOSActivation } from '../lib/sos';

const HOLD_MS = 500;
const COUNTDOWN_SEC = 5;

export default function SOSButton() {
  const { state } = useApp();
  const { activateSOS, cancelSOS } = useSOSActivation();
  const isActive = state.sos?.activeSession !== null;

  const [showCountdown, setShowCountdown] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SEC);
  const holdTimer = useRef(null);
  const countdownTimer = useRef(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      if (countdownTimer.current) clearInterval(countdownTimer.current);
    };
  }, []);

  const startHold = useCallback(() => {
    if (isActive) return;
    holdTimer.current = setTimeout(() => {
      // 500ms held — show countdown
      setCountdown(COUNTDOWN_SEC);
      setShowCountdown(true);

      countdownTimer.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownTimer.current);
            countdownTimer.current = null;
            setShowCountdown(false);
            activateSOS();
            return COUNTDOWN_SEC;
          }
          return prev - 1;
        });
      }, 1000);
    }, HOLD_MS);
  }, [isActive, activateSOS]);

  const cancelHold = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);

  const cancelCountdown = useCallback(() => {
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
      countdownTimer.current = null;
    }
    setShowCountdown(false);
    setCountdown(COUNTDOWN_SEC);
  }, []);

  return (
    <>
      {/* Floating button */}
      <motion.button
        className={`sos-fab${isActive ? ' sos-fab--active' : ''}`}
        onPointerDown={startHold}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        whileTap={{ scale: 0.93 }}
        aria-label={isActive ? 'SOS Active' : 'Hold to activate SOS'}
      >
        <span className="sos-fab__label">{isActive ? 'SOS Active' : 'SOS'}</span>
      </motion.button>

      {/* Countdown overlay */}
      <AnimatePresence>
        {showCountdown && (
          <motion.div
            className="sos-countdown-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="sos-countdown-modal">
              <AnimatePresence mode="wait">
                <motion.div
                  key={countdown}
                  className="sos-countdown-digit"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.1 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                >
                  {countdown}
                </motion.div>
              </AnimatePresence>
              <p className="sos-countdown-text">
                Sending alert in {countdown}s — tap Cancel to stop.
              </p>
              <button className="sos-countdown-cancel" onClick={cancelCountdown}>
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
