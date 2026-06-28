import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { useSOSActivation, mapsLink } from '../lib/sos';
import { tap } from '../lib/haptics';

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.16, 1, 0.3, 1] } },
};

const HOLD_MS = 500;
const COUNTDOWN_SEC = 5;

export default function SOSCenter() {
  const navigate = useNavigate();
  const { state } = useApp();
  const { activateSOS } = useSOSActivation();
  const contacts = state.sos?.contacts ?? [];

  // Inline countdown for fallback activate button
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SEC);
  const holdTimer = useRef(null);
  const countdownTimer = useRef(null);
  const isActive = state.sos?.activeSession !== null;

  useEffect(() => {
    return () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      if (countdownTimer.current) clearInterval(countdownTimer.current);
    };
  }, []);

  const startHold = useCallback(() => {
    if (isActive) return;
    holdTimer.current = setTimeout(() => {
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
    <div className="screen screen--light">
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        style={{ padding: 'var(--sp-6)', paddingTop: 'calc(env(safe-area-inset-top) + var(--sp-6))', display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}
      >
        {/* Header */}
        <motion.div variants={fadeUp}>
          <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--clr-ink)' }}>
            SOS Center
          </h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginTop: 'var(--sp-1)', lineHeight: 'var(--leading-snug)', textWrap: 'pretty' }}>
            In an emergency, one tap alerts your contacts and emergency services.
          </p>
        </motion.div>

        {/* Call 112 card */}
        <motion.div variants={fadeUp}>
          <div style={{
            background: 'var(--clr-dark)',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--sp-6)',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
                <div style={{
                  width: 48, height: 48,
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--clr-emergency)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <PhoneIcon />
                </div>
                <div>
                  <p style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--clr-ink-on-dark)' }}>
                    Emergency Services
                  </p>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted-on-dark)', marginTop: 1 }}>
                    India's unified emergency number
                  </p>
                </div>
              </div>
              <a
                href="tel:112"
                className="btn"
                onClick={() => tap()}
                style={{
                  background: 'var(--clr-emergency)',
                  color: 'var(--clr-emergency-on)',
                  width: '100%',
                  boxShadow: '0 4px 16px oklch(0.52 0.22 25 / 0.3)',
                  textDecoration: 'none',
                  fontSize: 'var(--text-lg)',
                  fontWeight: 700,
                }}
              >
                Call 112
              </a>
            </div>
            {/* Subtle decorative element */}
            <div style={{ position: 'absolute', right: -16, bottom: -16, fontSize: 72, opacity: 0.06 }} aria-hidden="true">
              🛡️
            </div>
          </div>
        </motion.div>

        {/* How it works */}
        <motion.div variants={fadeUp}>
          <p className="section-title">How it works</p>
          <div style={{
            display: 'flex',
            gap: 'var(--sp-3)',
          }}>
            {[
              { icon: '✋', label: 'Hold SOS' },
              { icon: '📍', label: 'Sends location' },
              { icon: '📨', label: 'Alerts contacts' },
            ].map((step, i) => (
              <div key={i} style={{
                flex: 1,
                background: 'var(--clr-surface)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--sp-4) var(--sp-3)',
                textAlign: 'center',
                border: '1px solid var(--clr-border)',
              }}>
                <div style={{ fontSize: 22, marginBottom: 'var(--sp-2)' }}>{step.icon}</div>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--clr-ink)', lineHeight: 'var(--leading-snug)' }}>
                  {step.label}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Emergency contacts preview */}
        <motion.div variants={fadeUp}>
          <p className="section-title">Emergency contacts</p>
          {contacts.length === 0 ? (
            <div style={{
              background: 'var(--clr-surface-2)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--sp-6)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 32, marginBottom: 'var(--sp-3)' }}>📇</div>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginBottom: 'var(--sp-4)', lineHeight: 'var(--leading-snug)' }}>
                No emergency contacts added yet.
              </p>
              <button
                className="btn btn--secondary btn--sm"
                onClick={() => navigate('/settings')}
                style={{ width: 'auto', margin: '0 auto' }}
              >
                Add contacts →
              </button>
            </div>
          ) : (
            <div className="gap-stack">
              {contacts.map(c => (
                <div key={c.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--sp-4)',
                  padding: 'var(--sp-4)',
                  background: 'var(--clr-surface)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--clr-border)',
                }}>
                  <div style={{
                    width: 40, height: 40,
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--clr-emergency-soft)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, flexShrink: 0, color: 'var(--clr-emergency)',
                    fontWeight: 600,
                  }}>
                    {c.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--clr-ink)' }}>
                      {c.name}
                    </div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginTop: 1 }}>
                      {c.phone}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Activate SOS button */}
        <motion.div variants={fadeUp}>
          <button
            className="btn sos-activate-btn"
            onPointerDown={startHold}
            onPointerUp={cancelHold}
            onPointerLeave={cancelHold}
            disabled={isActive}
            style={{
              background: 'var(--clr-emergency-soft)',
              color: 'var(--clr-emergency)',
              width: '100%',
              fontWeight: 700,
              border: '2px solid var(--clr-emergency)',
            }}
          >
            {isActive ? 'SOS is active' : 'Hold to activate SOS'}
          </button>
        </motion.div>

        {/* Bottom padding for nav */}
        <div style={{ height: 'var(--sp-4)' }} />
      </motion.div>

      {/* Countdown overlay (for the fallback activate button) */}
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
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
    </svg>
  );
}
