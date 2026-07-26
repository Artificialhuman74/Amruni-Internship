import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { ToastProvider } from './components/Toast';
import './index.css';
import { startOfflineSync } from './lib/offline';

// Which surface this bundle is, fixed at build time (see package.json scripts
// and .env.production / .env.doctor / .env.admin). Patient, practitioner and
// admin each deploy to their own domain.
const TARGET = import.meta.env.VITE_APP_TARGET || 'patient';

// Static conditional imports so each build tree-shakes to just its own app.
let App;
if (TARGET === 'doctor') {
  App = (await import('./apps/DoctorApp')).default;
} else if (TARGET === 'admin') {
  App = (await import('./apps/AdminApp')).default;
} else {
  App = (await import('./apps/PatientApp')).default;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AppProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AppProvider>
    </BrowserRouter>
  </StrictMode>
);

// Offline: flush anything queued while the connection was down, and register
// the worker that lets the app open at all without a network.
startOfflineSync();

if ('serviceWorker' in navigator && !import.meta.env?.DEV) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // No worker means no offline shell — the app still works online.
    });
  });
}

// A small note for the curious who open the console.
if (typeof window !== 'undefined' && !import.meta.env?.DEV) {
  console.log(
    '%cAmruni%c\nBuilt with care for women’s health across India.\nIf you build for people who deserve better, we’d love to hear from you.',
    'font-size:15px;font-weight:700;color:#9e1f4d',
    'font-size:12px;color:#6b6b6b;line-height:1.6',
  );
}
