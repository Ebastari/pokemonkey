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
