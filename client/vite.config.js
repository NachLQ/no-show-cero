import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// El cliente habla con la API en :4000 a través del proxy /api.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
