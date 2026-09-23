/// <reference types="@capacitor/background-runner" />

import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Pembungkus Android. Kode React yang sama dijalankan di WebView, jadi tampilan
 * retro tidak berubah.
 *
 * androidScheme 'https' membuat WebView menyajikan aplikasi dari https://localhost
 * (secure context) — syarat kamera dan beberapa API web.
 */
const config: CapacitorConfig = {
  appId: 'id.ebl.pokemonkey',
  appName: 'POKEMONKEY',
  webDir: 'dist',
  backgroundColor: '#000000',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    /**
     * Penjadwal notifikasi 07.00 / 12.00 / 17.00 WITA yang tetap jalan saat
     * aplikasi ditutup (pola Smart Nursery).
     *
     * `interval: 15` adalah nilai terkecil yang dihormati WorkManager.
     * `label` juga nama penyimpanan CapacitorKV runner; mengubahnya menghapus
     * catatan jadwal yang sudah dibuat. Harus sama dengan LABEL_RUNNER di
     * lib/notifikasi.ts.
     */
    BackgroundRunner: {
      label: 'id.ebl.pokemonkey.notifikasi',
      src: 'runner.js',
      event: 'periksaJadwal',
      repeat: true,
      interval: 15,
      autoStart: true,
    },
  },
};

export default config;
