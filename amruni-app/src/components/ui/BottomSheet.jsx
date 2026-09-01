import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useBodyOverlay } from '../../lib/useBodyOverlay';

/**
 * The app's modal sheet.
 *
 * Rendered through a portal to <body>, which is not a detail. Every screen
 * that opens one of these sits inside an animated wrapper, and an ancestor
 * mid-transform or mid-opacity creates a stacking context — so a sheet mounted
 * in place had its z-index resolved *inside* that context and lost to the tab
 * bar, which is a later sibling in the root. The result was a sheet with its
 * bottom third, and often its primary button, painted over by the nav.
 *
 * A surface that covers the app has to be a child of the app, not of the
 * screen it covers.
 */
export default function BottomSheet({ open, onClose, title, children }) {
  const sheetRef = useRef(null);
  const restoreFocus = useRef(null);

  // Locks the page and tells anything floating (the SOS orb) to step aside.
  useBodyOverlay(open);

  // Focus moves into the sheet on open and returns where it came from on
  // close, and Escape gets out — the sheet takes the screen, so it has to take
  // the keyboard with it.
  useEffect(() => {
    if (!open) return undefined;
    restoreFocus.current = document.activeElement;
    const node = sheetRef.current;
    node?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose?.(); return; }
      if (e.key !== 'Tab' || !node) return;
      const focusable = node.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (restoreFocus.current instanceof HTMLElement) restoreFocus.current.focus();
    };
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            ref={sheetRef}
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="sheet__handle" />
            {title && <h2 className="sheet__title">{title}</h2>}
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
