import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Tidak ada lagi kunci API yang disuntik ke bundel: apa pun yang masuk `define`
// ikut terbawa ke dalam APK dan bisa dibaca siapa saja. Kunci hidup di Worker.
export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    target: 'es2020',
    sourcemap: false,
  },
});