import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { ToastProvider } from './components/Toast';
import './index.css';
import App from './App';

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

// A small note for the curious who open the console.
if (typeof window !== 'undefined' && !import.meta.env?.DEV) {
  console.log(
    '%c🌺 Amruni%c\nBuilt with care for women’s health across India.\nIf you build for people who deserve better, we’d love to hear from you.',
    'font-size:15px;font-weight:700;color:#9e1f4d',
    'font-size:12px;color:#6b6b6b;line-height:1.6',
  );
}
