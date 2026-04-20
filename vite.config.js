import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => ({
  // Relative production paths let the same build run from /FPD_demo/ and /FPD_demo/dist/.
  base: mode === 'production' ? './' : '/',
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (
            id.includes('/node_modules/jspdf/') ||
            id.includes('/node_modules/jspdf-autotable/') ||
            id.includes('/node_modules/dompurify/')
          ) {
            return 'jspdf-vendor';
          }

          if (
            id.includes('/node_modules/html2canvas/') ||
            id.includes('/node_modules/fast-png/') ||
            id.includes('/node_modules/iobuffer/') ||
            id.includes('/node_modules/css-line-break/') ||
            id.includes('/node_modules/text-segmentation/') ||
            id.includes('/node_modules/utrie/')
          ) {
            return 'html2canvas-vendor';
          }

          if (
            id.includes('/node_modules/canvg/') ||
            id.includes('/node_modules/core-js/') ||
            id.includes('/node_modules/raf/') ||
            id.includes('/node_modules/stackblur-canvas/') ||
            id.includes('/node_modules/svg-pathdata/') ||
            id.includes('/node_modules/rgbcolor/') ||
            id.includes('/node_modules/regenerator-runtime/')
          ) {
            return 'canvg-vendor';
          }

          if (
            id.includes('/node_modules/jszip/') ||
            id.includes('/node_modules/fflate/') ||
            id.includes('/node_modules/pako/') ||
            id.includes('/node_modules/lie/') ||
            id.includes('/node_modules/setimmediate/')
          ) {
            return 'excel-zip-vendor';
          }

          if (
            id.includes('/node_modules/fast-csv/') ||
            id.includes('/node_modules/@fast-csv/')
          ) {
            return 'excel-csv-vendor';
          }

          if (
            id.includes('/node_modules/archiver/') ||
            id.includes('/node_modules/archiver-utils/') ||
            id.includes('/node_modules/compress-commons/') ||
            id.includes('/node_modules/tar-stream/') ||
            id.includes('/node_modules/zip-stream/') ||
            id.includes('/node_modules/crc32-stream/') ||
            id.includes('/node_modules/buffer-crc32/')
          ) {
            return 'excel-archive-vendor';
          }

          if (
            id.includes('exceljs') ||
            id.includes('/node_modules/dayjs/') ||
            id.includes('/node_modules/saxes/') ||
            id.includes('/node_modules/tmp/') ||
            id.includes('/node_modules/unzipper/') ||
            id.includes('/node_modules/uuid/') ||
            id.includes('/node_modules/file-saver/')
          ) {
            return 'exceljs-vendor';
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
