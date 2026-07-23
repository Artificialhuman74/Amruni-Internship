import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,          // also serve on your local network (open it on a phone)
    allowedHosts: true,
    proxy: {
      // FastAPI backend — `uvicorn app.main:app --port 4000` in server/
      '/api': {
        target: process.env.VITE_API_PROXY || 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
