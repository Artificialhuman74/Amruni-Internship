import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { useSOSActivation } from '../lib/sos';

export default function SOSBanner() {
  const { state } = useApp();
  const { cancelSOS } = useSOSActivation();
  const session = state.sos?.activeSession;
  const [elapsed, setElapsed] = useState('0:00');
  const interval = useRef(null);

  useEffect(() => {
    if (session) {
      const tick = () => {
        const diff = Math.floor((Date.now() - session.startedAt) / 1000);
        const m = Math.floor(diff / 60);
        const s = String(diff % 60).padStart(2, '0');
        setElapsed(`${m}:${s}`);
      };
      tick();
      interval.current = setInterval(tick, 1000);
      return () => clearInterval(interval.current);
    } else {
      setElapsed('0:00');
      if (interval.current) clearInterval(interval.current);
    }
  }, [session]);

  return (
    <AnimatePresence>
      {session && (
        <motion.div
          className="sos-banner"
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -48, opacity: 0 }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="sos-banner__text">
            🚨 SOS Active · {elapsed}
          </span>
          <button className="sos-banner__cancel" onClick={cancelSOS}>
            Cancel
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
