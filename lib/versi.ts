/**
 * Versi aplikasi yang sedang berjalan vs versi terbaru di server.
 *
 * Versi bundel (__VERSI_APP__/__KODE_APP__) dibaca dari android/app/build.gradle
 * saat build (vite.config.ts), jadi APK dan web hasil build yang sama membawa
 * angka yang sama. Versi terbaru dicatat di server tiap rilis
 * (scripts/rilis-apk.mjs) dan dibaca lewat /api/versi tanpa perlu login.
 */

import { ambilServer } from './api';

export const VERSI_APP: string = __VERSI_APP__;
export const KODE_APP: number = __KODE_APP__;

export interface VersiTerbaru {
  versi: string;
  /** versionCode Android; dibandingkan sebagai angka. */
  kode: number;
  ukuran: number | null;
  catatan: string | null;
  tanggal: string | null;
  /** Alamat unduh APK terbaru. */
  url: string;
}

/** null bila server tak terjangkau atau belum ada rilis yang dicatat. */
export async function ambilVersiTerbaru(): Promise<VersiTerbaru | null> {
  try {
    const r = await fetch(`${ambilServer()}/api/versi`, { cache: 'no-store' });
    if (!r.ok) return null;
    const d = (await r.json()) as Partial<VersiTerbaru>;
    return d.versi && d.url ? { versi: d.versi, kode: Number(d.kode) || 0, ukuran: d.ukuran ?? null, catatan: d.catatan ?? null, tanggal: d.tanggal ?? null, url: d.url } : null;
  } catch {
    return null;
  }
}

export const perluPerbarui = (v: VersiTerbaru | null): v is VersiTerbaru => Boolean(v && v.kode > KODE_APP);

export const ukuranMb = (b: number | null) => (b ? `${(b / 1024 / 1024).toFixed(0)} MB` : '');
