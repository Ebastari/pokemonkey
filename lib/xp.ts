/**
 * XP di sisi aplikasi. Angka XP dihitung server (server/src/xp.ts, aturan di
 * xp-aturan.ts); aplikasi hanya menerima kabarnya — lewat header X-XP pada
 * jawaban API, atau langsung dari mode demo — lalu menyiarkannya sebagai acara
 * window 'pokemonkey:xp' untuk layar (pesan "+N XP", angka di kepala layar).
 */

import type { NilaiKeaktifan, SumberXp } from '../server/src/xp-aturan';

export interface KabarXp {
  tambah: number;
  total: number;
  level: number;
  naik: boolean;
  rincian: { sumber: SumberXp; xp: number; label: string }[];
  /** Skin Prestasi yang baru terbuka (id skin). */
  prestasi?: string[];
}

export const ACARA_XP = 'pokemonkey:xp';

export function kabarkanXp(k: KabarXp): void {
  if (!k || (!(k.tambah > 0) && !k.prestasi?.length)) return;
  try { window.dispatchEvent(new CustomEvent<KabarXp>(ACARA_XP, { detail: k })); } catch { /* bukan peramban */ }
}

/** Kabar XP dari header jawaban server (X-XP = JSON yang di-encodeURIComponent). */
export function bacaHeaderXp(res: Response): KabarXp | null {
  const h = res.headers.get('X-XP');
  if (!h) return null;
  try { return JSON.parse(decodeURIComponent(h)) as KabarXp; } catch { return null; }
}

/** Satu baris skor anggota dari GET /api/xp/skor. */
export interface SkorAnggota {
  id: string;
  nama: string;
  jabatan: string | null;
  peran: string;
  xp: number;
  level: number;
  xpDiLevel: number;
  xpButuh: number;
  saldo: number;
  xp7: number;
  meterHariIni: number;
  wilayahHariIni: string[];
  hariIniKerja: boolean;
  skor7: NilaiKeaktifan;
  kpi: NilaiKeaktifan;
}

export interface DataSkor {
  hariIni: string;
  semester: { dari: string; sampai: string; label: string };
  anggota: SkorAnggota[];
}

export interface BarisRiwayatXp {
  id: number;
  sumber: string;
  ref: string;
  xp: number;
  wilayah: string;
  hari: string;
  pada: string;
  label: string;
  menu: string;
  dibatalkan_pada: string | null;
  alasan_batal: string | null;
}
