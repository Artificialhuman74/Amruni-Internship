import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

/*
  A single, quiet confirmation toast. Sits just above the bottom nav, inside the
  430px app column. Used for completion moments (a cycle logged, a contact added,
  a setting saved) where a modal would be overkill and silence feels unfinished.

  One toast at a time by design — a new one replaces the old, so rapid actions
  never stack into noise.
*/
const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const show = useCallback((message, opts = {}) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), message, icon: opts.icon ?? null });
    timer.current = setTimeout(() => setToast(null), opts.duration ?? 2400);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <ToastViewport toast={toast} />
    </ToastContext.Provider>
  );
}

function ToastViewport({ toast }) {
  const reduce = useReducedMotion();
  return (
    <div className="toast-viewport" aria-live="polite" aria-atomic="true">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            className="toast"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          >
            {toast.icon && (
              <span className="toast__icon" aria-hidden="true">
                {toast.icon}
              </span>
            )}
            <span className="toast__msg">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
