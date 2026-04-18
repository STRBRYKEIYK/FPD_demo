import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/FPD_demo/' : '/',
  plugins: [react(), tailwindcss()],
  server: {
    host: 'localhost',
    port: 5175,
  },
}));
