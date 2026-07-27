import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../../app/providers/AppContext'
import { useSOSActivation } from './useSOSActivation'
import { IconSOS } from '../../components/common/Icons.jsx'

export default function SOSBanner() {
  const { state } = useApp();
  const { cancelSOS } = useSOSActivation();
  const [elapsed, setElapsed] = useState('00:00');

  const isActive = state.sos.activeSession !== null;
  const startedAt = state.sos.activeSession?.startedAt;

  useEffect(() => {
    if (!isActive || !startedAt) return;
    
    const start = new Date(startedAt).getTime();
    
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - start) / 1000);
      const m = Math.floor(diff / 60).toString().padStart(2, '0');
      const s = (diff % 60).toString().padStart(2, '0');
      setElapsed(`${m}:${s}`);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isActive, startedAt]);

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -48, opacity: 0 }}
          style={{
            background: 'var(--clr-emergency)',
            color: 'var(--clr-emergency-on)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--sp-3) var(--sp-4)',
            zIndex: 'var(--z-sticky)'
          }}
        >
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <IconSOS size={16} /> SOS Active · {elapsed}
          </div>
          <button 
            className="btn btn--ghost" 
            onClick={cancelSOS}
            style={{ minHeight: 'auto', padding: 'var(--sp-2) var(--sp-4)', color: 'var(--clr-emergency-on)', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 'var(--radius-full)' }}
          >
            Cancel
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
