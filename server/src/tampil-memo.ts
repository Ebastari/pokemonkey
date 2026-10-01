/**
 * Nilai tampilan memo yang dipakai di luar React: halaman bagikan (lihat-memo.ts)
 * dan gambar unduhan (lib/gambar-memo.ts). Warnanya disalin dari kelas Tailwind
 * yang dipakai aplikasi (lib/warna.ts, lib/sampul.ts, MemoMarkup.tsx), supaya
 * keduanya tampil sama persis dengan halaman memo di aplikasi.
 */

/** Palet chip opsi (kategori/status) = lib/warna.ts: garis 500, teks 300, latar 950/50 %, titik 500. */
export const PALET_OPSI: Record<string, { garis: string; teks: string; latar: string; titik: string }> = {
  emerald: { garis: '#10b981', teks: '#6ee7b7', latar: 'rgba(2,44,34,.5)', titik: '#10b981' },
  cyan: { garis: '#06b6d4', teks: '#67e8f9', latar: 'rgba(8,51,68,.5)', titik: '#06b6d4' },
  blue: { garis: '#3b82f6', teks: '#93c5fd', latar: 'rgba(23,37,84,.5)', titik: '#3b82f6' },
  indigo: { garis: '#6366f1', teks: '#a5b4fc', latar: 'rgba(30,27,75,.5)', titik: '#6366f1' },
  purple: { garis: '#a855f7', teks: '#d8b4fe', latar: 'rgba(59,7,100,.5)', titik: '#a855f7' },
  amber: { garis: '#f59e0b', teks: '#fcd34d', latar: 'rgba(69,26,3,.5)', titik: '#f59e0b' },
  orange: { garis: '#f97316', teks: '#fdba74', latar: 'rgba(67,20,7,.5)', titik: '#f97316' },
  red: { garis: '#ef4444', teks: '#fca5a5', latar: 'rgba(69,10,10,.5)', titik: '#ef4444' },
  yellow: { garis: '#eab308', teks: '#fde047', latar: 'rgba(66,32,6,.5)', titik: '#eab308' },
  zinc: { garis: '#71717a', teks: '#d4d4d8', latar: 'rgba(24,24,27,.6)', titik: '#71717a' },
};
export const paletOpsi = (nama?: string | null) => PALET_OPSI[nama ?? ''] ?? PALET_OPSI.zinc;

/** Sampul gradasi (lib/sampul.ts SAMPUL_WARNA) sebagai CSS biasa. */
export const CSS_SAMPUL_WARNA: Record<string, string> = {
  'warna:hutan': 'background:linear-gradient(to right,#022c22,#4d7c0f,#022c22)',
  'warna:langit': 'background:linear-gradient(to right,#082f49,#0284c7,#1e1b4b)',
  'warna:senja': 'background:linear-gradient(to right,#92400e,#ea580c,#881337)',
  'warna:tanah': 'background:linear-gradient(to right,#1c1917,#78350f,#1c1917)',
  'warna:malam': 'background:linear-gradient(to right,#09090b,#1e1b4b,#09090b)',
  'warna:piksel': 'background-color:#1a2e05;background-image:linear-gradient(45deg,#365314 25%,transparent 25%,transparent 75%,#365314 75%),linear-gradient(45deg,#365314 25%,transparent 25%,transparent 75%,#365314 75%);background-size:24px 24px;background-position:0 0,12px 12px',
};

/**
 * Gambar sampul galeri (lib/sampul.ts GALERI_POKEMONKEY & SAMPUL_RESMI), relatif ke akar
 * aplikasi web yang disajikan Worker yang sama. `utuh` = tampil utuh di latar putih.
 */
export const GALERI_SAMPUL: Record<string, { berkas: string; fokusY: number; utuh?: boolean }> = {
  'pk:lembah-jungle': { berkas: 'sampul/lembah-jungle.webp', fokusY: 45 },
  'resmi:ebl': { berkas: 'sampul/resmi-ebl.jpg', fokusY: 50, utuh: true },
};

/** Posisi tegak sampul (0–100 %), sama dengan posisiSampul() di lib/sampul.ts. */
export function posisiY(nilaiY: unknown, kode: string): number {
  const y = typeof nilaiY === 'number' ? nilaiY : Number(nilaiY);
  if (nilaiY !== null && nilaiY !== '' && nilaiY !== undefined && Number.isFinite(y)) return Math.min(100, Math.max(0, y));
  return GALERI_SAMPUL[kode]?.fokusY ?? 50;
}

/** Warna chip tenggat (MemoMarkup ChipTenggat): lewat = merah, hari ini = kuning, selebihnya biru. */
export function warnaTenggat(sisaHari: number, selesai: boolean): { garis: string; teks: string; latar: string } {
  if (selesai) return { garis: 'rgba(255,255,255,.15)', teks: '#71717a', latar: 'transparent' };
  if (sisaHari < 0) return { garis: '#f87171', teks: '#fca5a5', latar: 'rgba(69,10,10,.4)' };
  if (sisaHari === 0) return { garis: '#fbbf24', teks: '#fde68a', latar: 'rgba(69,26,3,.4)' };
  return { garis: 'rgba(56,189,248,.6)', teks: '#bae6fd', latar: 'rgba(8,47,73,.3)' };
}
