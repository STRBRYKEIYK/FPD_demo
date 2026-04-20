import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/FPD_demo/' : '/',
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('exceljs')) {
            return 'exceljs-vendor';
          }

          if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('canvg')) {
            return 'pdf-vendor';
          }

          if (id.includes('xlsx') || id.includes('cfb') || id.includes('codepage')) {
            return 'xlsx-vendor';
          }

          if (id.includes('react-pdf') || id.includes('pdfjs-dist')) {
            return 'react-pdf-vendor';
          }

          if (id.includes('framer-motion')) {
            return 'motion-vendor';
          }

          if (id.includes('socket.io-client') || id.includes('engine.io-client')) {
            return 'socket-vendor';
          }

          if (
            id.includes('@reduxjs/toolkit') ||
            id.includes('/redux/') ||
            id.includes('/redux-thunk/') ||
            id.includes('/immer/') ||
            id.includes('/reselect/')
          ) {
            return 'redux-vendor';
          }

          if (id.includes('xstate')) {
            return 'xstate-vendor';
          }

          if (id.includes('react-router') || id.includes('history')) {
            return 'router-vendor';
          }

          if (id.includes('recharts') || id.includes('/d3-')) {
            return 'charts-vendor';
          }

          if (id.includes('react-icons') || id.includes('lucide-react')) {
            return 'icons-vendor';
          }

          return 'vendor';
        },
      },
    },
  },
  server: {
    host: 'localhost',
    port: 5175,
  },
}));
