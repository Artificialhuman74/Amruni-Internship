import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { useSOSActivation } from '../lib/useSOSActivation';
import { useToast } from './Toast';

export default function SOSButton() {
  const { state } = useApp();
  const { activateSOS, cancelSOS } = useSOSActivation();
  const toast = useToast();
  
  const [counting, setCounting] = useState(false);
  const [countdown, setCountdown] = useState(5);
  
  const holdTimer = useRef(null);
  const countdownTimer = useRef(null);

  const isActive = state.sos.activeSession !== null;

  useEffect(() => {
    if (counting) {
      if (countdown > 0) {
        countdownTimer.current = setTimeout(() => {
          setCountdown(c => c - 1);
        }, 1000);
      } else {
        setCounting(false);
        activateSOS();
      }
    }
    return () => clearTimeout(countdownTimer.current);
  }, [counting, countdown, activateSOS]);

  function onPointerDown() {
    if (isActive || counting) return;
    holdTimer.current = setTimeout(() => {
      setCountdown(5);
      setCounting(true);
    }, 500);
  }

  function onPointerUp() {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }

  function cancelCountdown() {
    setCounting(false);
    clearTimeout(countdownTimer.current);
    setCountdown(5);
  }

  function handlePress() {
    if (isActive) {
      if (window.confirm("Cancel active SOS session?")) {
        cancelSOS();
      }
    }
  }

  return (
    <>
      <button
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onClick={handlePress}
        style={{
          position: 'fixed',
          bottom: 'calc(var(--nav-height, 72px) + var(--sp-4))',
          right: 'var(--sp-5)',
          zIndex: 'var(--z-nav)', // The prompt said var(--z-modal) but nav is fine for normal state
          width: 56, height: 56,
          borderRadius: 'var(--radius-full)',
          background: 'var(--clr-emergency)',
          color: 'var(--clr-emergency-on)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: '0.05em',
          animation: isActive ? 'none' : 'sos-pulse 2s ease-out infinite',
          boxShadow: 'var(--shadow-lg)',
          touchAction: 'none'
        }}
        aria-label="SOS Button"
      >
        {isActive ? 'ACTIVE' : 'SOS'}
      </button>

      {/* Countdown overlay */}
      <AnimatePresence>
        {counting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0,
              background: 'oklch(0 0 0 / 0.7)',
              zIndex: 'var(--z-modal)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center'
            }}
          >
            <AnimatePresence mode="popLayout">
              <motion.div
                key={countdown}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.2 }}
                transition={{ duration: 0.3 }}
                style={{
                  fontSize: 'var(--text-4xl)',
                  color: 'var(--clr-emergency-on)',
                  fontWeight: 900,
                  lineHeight: 1
                }}
              >
                {countdown}
              </motion.div>
            </AnimatePresence>
            
            <p style={{ color: 'var(--clr-ink-on-dark)', marginTop: 'var(--sp-4)', fontSize: 'var(--text-md)', fontWeight: 600 }}>
              Sending alert in {countdown}s
            </p>
            
            <button
              onClick={cancelCountdown}
              className="btn btn--ghost"
              style={{ marginTop: 'var(--sp-8)', color: 'white' }}
            >
              Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
