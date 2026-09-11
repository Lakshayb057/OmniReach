import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            const code = (err as any).code;
            if (code === 'ECONNABORTED' || code === 'ECONNRESET' || code === 'EPIPE' || code === 'ECONNREFUSED') {
              return;
            }
            console.error('API proxy note:', err.message);
          });
        },
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            const code = (err as any).code;
            if (code === 'ECONNABORTED' || code === 'ECONNRESET' || code === 'EPIPE' || code === 'ECONNREFUSED') {
              return;
            }
            console.error('Socket proxy note:', err.message);
          });
          proxy.on('proxyReqWs', (_proxyReq, _req, socket) => {
            socket.on('error', () => {
              // Silently absorb socket abort on page reload / HMR update
            });
          });
        },
      },
    },
  },
});
