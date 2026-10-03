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

// ---------------------------------------------------------------------------
// Warna teks & stabilo (latar) — palet Notion, tanpa Coklat; latar boleh Putih.
// Teks memo: {w:merah|teks} = warna teks, {l:kuning|teks} = stabilo/latar.
// Di aplikasi dipakai lewat kelas .mw-<nama> / .ml-<nama> (index.css, ikut Mode Terang);
// halaman bagikan & gambar unduhan memakai nilai di bawah ini.
// ---------------------------------------------------------------------------

export interface WarnaMemo { nama: string; label: string; gelap: string; terang: string }

export const WARNA_TEKS: WarnaMemo[] = [
  { nama: 'abu', label: 'Abu-abu', gelap: '#a1a1aa', terang: '#6b7280' },
  { nama: 'oranye', label: 'Oranye', gelap: '#fb923c', terang: '#c2410c' },
  { nama: 'kuning', label: 'Kuning', gelap: '#facc15', terang: '#a16207' },
  { nama: 'hijau', label: 'Hijau', gelap: '#4ade80', terang: '#15803d' },
  { nama: 'biru', label: 'Biru', gelap: '#60a5fa', terang: '#1d4ed8' },
  { nama: 'ungu', label: 'Ungu', gelap: '#c084fc', terang: '#7e22ce' },
  { nama: 'pink', label: 'Merah muda', gelap: '#f472b6', terang: '#be185d' },
  { nama: 'merah', label: 'Merah', gelap: '#f87171', terang: '#b91c1c' },
];

/** Latar (stabilo). `teksGelap`/`teksTerang` diisi bila latarnya terang sehingga hurufnya perlu gelap. */
export const WARNA_LATAR: (WarnaMemo & { teksGelap?: string; teksTerang?: string })[] = [
  { nama: 'putih', label: 'Putih', gelap: '#f4f4f5', terang: '#ffffff', teksGelap: '#18181b', teksTerang: '#18181b' },
  { nama: 'abu', label: 'Abu-abu', gelap: 'rgba(161,161,170,.28)', terang: '#e4e4e7' },
  { nama: 'oranye', label: 'Oranye', gelap: 'rgba(249,115,22,.32)', terang: '#ffedd5' },
  { nama: 'kuning', label: 'Kuning', gelap: 'rgba(234,179,8,.38)', terang: '#fef08a' },
  { nama: 'hijau', label: 'Hijau', gelap: 'rgba(34,197,94,.30)', terang: '#dcfce7' },
  { nama: 'biru', label: 'Biru', gelap: 'rgba(59,130,246,.32)', terang: '#dbeafe' },
  { nama: 'ungu', label: 'Ungu', gelap: 'rgba(168,85,247,.32)', terang: '#f3e8ff' },
  { nama: 'pink', label: 'Merah muda', gelap: 'rgba(236,72,153,.32)', terang: '#fce7f3' },
  { nama: 'merah', label: 'Merah', gelap: 'rgba(239,68,68,.32)', terang: '#fee2e2' },
];

export const adaWarna = (jenis: 'w' | 'l', nama: string): boolean =>
  (jenis === 'w' ? WARNA_TEKS : WARNA_LATAR).some((w) => w.nama === nama);

/** Gaya CSS satu potongan berwarna (halaman bagikan & gambar unduhan). */
export function gayaWarna(jenis: 'w' | 'l', nama: string, gelap: boolean): { color?: string; background?: string } {
  if (jenis === 'w') {
    const w = WARNA_TEKS.find((x) => x.nama === nama);
    return w ? { color: gelap ? w.gelap : w.terang } : {};
  }
  const w = WARNA_LATAR.find((x) => x.nama === nama);
  if (!w) return {};
  const teks = gelap ? w.teksGelap : w.teksTerang;
  return { background: gelap ? w.gelap : w.terang, ...(teks ? { color: teks } : {}) };
}

// ---------------------------------------------------------------------------
// Blok kode: pewarna sintaks ringan (tanpa pustaka) — kata kunci, teks, angka, komentar.
// ---------------------------------------------------------------------------

export const BAHASA_KODE: { id: string; label: string }[] = [
  { id: 'teks', label: 'Teks biasa' }, { id: 'js', label: 'JavaScript' }, { id: 'ts', label: 'TypeScript' },
  { id: 'py', label: 'Python' }, { id: 'sql', label: 'SQL' }, { id: 'json', label: 'JSON' },
  { id: 'html', label: 'HTML' }, { id: 'css', label: 'CSS' }, { id: 'bash', label: 'Shell' },
];

const KATA_KUNCI = new Set((
  'const let var function return if else for while do switch case break continue new class extends import from export default '
  + 'async await try catch finally throw typeof instanceof in of true false null undefined this interface type enum '
  + 'def lambda pass None True False and or not is elif with as yield print '
  + 'select from where insert into update delete create table values set join left right inner on group by order having limit '
  + 'and or not null primary key references alter add index distinct count sum avg max min case when then end '
  + 'echo if then fi do done export'
).split(' '));

export type PotonganKode = { t: 'kata' | 'teks' | 'angka' | 'komentar' | 'tali'; v: string };

/** Pecah kode jadi potongan berwarna. Sengaja sederhana: cukup untuk dibaca, bukan pengurai bahasa. */
export function sorotKode(isi: string, bahasa: string): PotonganKode[] {
  if (bahasa === 'teks') return [{ t: 'teks', v: isi }];
  const komentar = bahasa === 'py' || bahasa === 'bash' ? '#[^\\n]*' : bahasa === 'sql' ? '--[^\\n]*' : bahasa === 'html' ? '<!--[\\s\\S]*?-->' : '\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/';
  const pola = new RegExp(`(${komentar})|("(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*'|\`(?:\\\\.|[^\`\\\\])*\`)|(\\b\\d+(?:\\.\\d+)?\\b)|([A-Za-z_][\\w$]*)`, 'g');
  const hasil: PotonganKode[] = [];
  let akhir = 0;
  const teks = (v: string) => { if (!v) return; const l = hasil[hasil.length - 1]; if (l?.t === 'teks') l.v += v; else hasil.push({ t: 'teks', v }); };
  for (const m of isi.matchAll(pola)) {
    teks(isi.slice(akhir, m.index));
    akhir = (m.index ?? 0) + m[0].length;
    if (m[1]) hasil.push({ t: 'komentar', v: m[1] });
    else if (m[2]) hasil.push({ t: 'tali', v: m[2] });
    else if (m[3]) hasil.push({ t: 'angka', v: m[3] });
    else if (m[4] && KATA_KUNCI.has(bahasa === 'sql' ? m[4].toLowerCase() : m[4])) hasil.push({ t: 'kata', v: m[4] });
    else teks(m[0]);
  }
  teks(isi.slice(akhir));
  return hasil;
}

/** Warna potongan kode (gelap seperti aplikasi / terang untuk kertas). */
export const WARNA_KODE: Record<PotonganKode['t'], { gelap: string; terang: string }> = {
  kata: { gelap: '#c084fc', terang: '#7e22ce' },
  tali: { gelap: '#bef264', terang: '#3f6212' },
  angka: { gelap: '#fdba74', terang: '#c2410c' },
  komentar: { gelap: '#71717a', terang: '#6b7280' },
  teks: { gelap: '#e4e4e7', terang: '#1f2937' },
};
