/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Alamat server Worker, mis. https://pokemonkey-api.<akun>.workers.dev */
  readonly VITE_API_URL?: string;
  /** '0' di build produksi: sembunyikan tombol demo dan pengaturan alamat server. */
  readonly VITE_DEMO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Versi aplikasi dari android/app/build.gradle, disuntik saat build (vite.config.ts). */
declare const __VERSI_APP__: string;
declare const __KODE_APP__: number;
