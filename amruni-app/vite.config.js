import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// Testing on a phone means opening a LAN address like http://192.168.0.10, and
// browsers treat that as an insecure origin. `localhost` is exempt; a LAN IP is
// not. Behind that one rule sit four things this app actually needs:
//
//   · navigator.geolocation   — the weather on a journal entry, and the SOS
//                               location, which is the one that matters
//   · navigator.serviceWorker — the offline mode
//   · Notification            — medicine and care reminders
//   · navigator.clipboard     — copying a care link
//
// All four fail silently over plain HTTP, which reads as "this feature is
// broken" rather than "this origin is untrusted". `HTTPS=1 npm run dev` serves
// the same site over TLS with a self-signed certificate: the phone shows a
// one-time warning to accept, and everything above starts working.
const useHttps = process.env.HTTPS === '1' || process.env.HTTPS === 'true';

export default defineConfig({
  plugins: [react(), ...(useHttps ? [basicSsl()] : [])],
  server: {
    port: 5173,
    host: true,          // also serve on your local network (open it on a phone)
    allowedHosts: true,
    proxy: {
      // FastAPI backend — `uvicorn app.main:app --port 4000` in server/
      '/api': {
        target: process.env.VITE_API_PROXY || 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
