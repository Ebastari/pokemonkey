import path from 'path';
import { readFileSync } from 'fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Tidak ada lagi kunci API yang disuntik ke bundel: apa pun yang masuk `define`
// ikut terbawa ke dalam APK dan bisa dibaca siapa saja. Kunci hidup di Worker.
// Versi aplikasi diambil dari build.gradle supaya APK dan web hasil build yang
// sama membawa angka yang sama (dipakai peringatan pembaruan, lib/versi.ts).
const gradle = readFileSync(path.resolve(__dirname, 'android/app/build.gradle'), 'utf8');
const VERSI_APP = /versionName\s+"([^"]+)"/.exec(gradle)?.[1] ?? '0';
const KODE_APP = Number(/versionCode\s+(\d+)/.exec(gradle)?.[1] ?? 0);

export default defineConfig({
  define: {
    __VERSI_APP__: JSON.stringify(VERSI_APP),
    __KODE_APP__: String(KODE_APP),
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    watch: {
      ignored: ['**/*.jpeg', '**/*.jpg', '**/*.png', '**/*.webp', '**/*.pptx', '**/.git/**'],
    },
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