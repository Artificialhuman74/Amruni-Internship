import { useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { useSOSActivation } from '../lib/sos';

export default function SOSButton() {
  const { state } = useApp();
  const { activateSOS, cancelSOS } = useSOSActivation();
  const isActive = state.sos?.activeSession !== null;
  const fileInputRef = useRef(null);

  const handleTap = useCallback(() => {
    if (!isActive) {
      activateSOS();
    }
  }, [isActive, activateSOS]);

  const handleRecord = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <>
      {/* Floating button */}
      <motion.button
        className={`sos-fab${isActive ? ' sos-fab--active' : ''}`}
        onClick={handleTap}
        whileTap={{ scale: 0.93 }}
        aria-label={isActive ? 'SOS Active' : 'Tap to activate SOS'}
      >
        <span className="sos-fab__label">{isActive ? 'SOS Active' : 'SOS'}</span>
      </motion.button>

      {/* Action overlay when SOS is active */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            className="sos-countdown-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="sos-countdown-modal" style={{ gap: '1rem', display: 'flex', flexDirection: 'column' }}>
              <input 
                type="file" 
                accept="video/*" 
                capture="environment" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
              />
              
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', color: 'var(--clr-ink)' }}>SOS Active</h3>
              <p style={{ margin: '0 0 1rem 0', color: 'var(--clr-ink-muted)' }}>Alerts have been sent to your emergency contacts and 112.</p>
              
              <button 
                className="sos-countdown-cancel" 
                onClick={handleRecord}
                style={{ background: 'var(--clr-emergency)', color: 'white', border: 'none', padding: '1rem', borderRadius: 'var(--rad-3)' }}
              >
                Record Video
              </button>
              
              <a href="tel:112" style={{ textDecoration: 'none' }}>
                <button 
                  className="sos-countdown-cancel" 
                  style={{ width: '100%', background: 'var(--clr-dark)', color: 'var(--clr-ink-on-dark)', border: 'none', padding: '1rem', borderRadius: 'var(--rad-3)' }}
                >
                  Call 112
                </button>
              </a>
              
              <button className="sos-countdown-cancel" onClick={cancelSOS} style={{ marginTop: '1rem' }}>
                Cancel SOS
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
