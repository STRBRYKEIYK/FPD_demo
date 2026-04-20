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

          if (id.includes('exceljs') || id.includes('/node_modules/file-saver/')) {
            return 'exceljs-vendor';
          }

          if (
            id.includes('jspdf') ||
            id.includes('html2canvas') ||
            id.includes('canvg') ||
            id.includes('/node_modules/core-js/') ||
            id.includes('/node_modules/raf/') ||
            id.includes('/node_modules/stackblur-canvas/') ||
            id.includes('/node_modules/svg-pathdata/') ||
            id.includes('/node_modules/fast-png/') ||
            id.includes('/node_modules/iobuffer/') ||
            id.includes('/node_modules/dompurify/')
          ) {
            return 'pdf-vendor';
          }

          if (id.includes('xlsx') || id.includes('cfb') || id.includes('codepage')) {
            return 'xlsx-vendor';
          }

          if (id.includes('react-pdf') || id.includes('pdfjs-dist')) {
            return 'react-pdf-vendor';
          }

          if (
            id.includes('framer-motion') ||
            id.includes('/node_modules/motion-dom/') ||
            id.includes('/node_modules/motion-utils/') ||
            id.includes('/node_modules/es-toolkit/')
          ) {
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
