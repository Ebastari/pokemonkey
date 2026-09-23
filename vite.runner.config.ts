import { defineConfig } from 'vite';

/**
 * Bundel terpisah untuk Background Runner: `runner/index.ts` -> `dist/runner.js`.
 *
 * Tidak dimuat halaman mana pun; dijalankan mesin JavaScript milik
 * @capacitor/background-runner di luar WebView. Mesin itu tidak mengenal modul,
 * jadi hasilnya satu berkas datar (iife). Pola sama dengan Smart Nursery.
 *
 * `emptyOutDir: false` wajib: perintah ini berjalan SESUDAH `vite build`, dan
 * mengosongkan dist berarti membuang aplikasi yang baru dibangun.
 */
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    // Isi public/ (sw.js, manifest) sudah disalin build utama.
    copyPublicDir: false,
    // Mesin runner (QuickJS) tidak menjamin sintaks terbaru.
    target: 'es2019',
    // Dibiarkan terbaca supaya `adb logcat` bisa dipakai memeriksa perilakunya.
    minify: false,
    lib: {
      entry: 'runner/index.ts',
      name: 'PokemonkeyRunner',
      formats: ['iife'],
      fileName: () => 'runner.js',
    },
  },
});
