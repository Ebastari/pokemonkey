/**
 * Waktu di sisi aplikasi. Selalu WITA (UTC+8), apa pun zona ponselnya —
 * supaya jadwal yang dilihat di lapangan sama dengan yang dihitung server.
 */

export const OFFSET_WITA_MENIT = 480;
const MS_HARI = 86_400_000;

export const NAMA_HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
export const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
export const NAMA_BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function dindingWita(d: Date = new Date()): Date {
  return new Date(d.getTime() + OFFSET_WITA_MENIT * 60_000);
}

export const hariIniWita = (): string => dindingWita().toISOString().slice(0, 10);

export function jamWita(d: Date = new Date()): string {
  const w = dindingWita(d);
  return `${String(w.getUTCHours()).padStart(2, '0')}:${String(w.getUTCMinutes()).padStart(2, '0')}`;
}

export function menitSekarangWita(): number {
  const w = dindingWita();
  return w.getUTCHours() * 60 + w.getUTCMinutes();
}

/** "Sel, 22 Sep 2026 · 14.05 WITA" — cap waktu pada gambar/berkas yang diunduh. */
export function capWaktuWita(): string {
  const m = menitSekarangWita();
  return `${formatPanjang(hariIniWita())} · ${String(Math.floor(m / 60)).padStart(2, '0')}.${String(m % 60).padStart(2, '0')} WITA`;
}

export const keTanggal = (s: string): Date => new Date(s + 'T00:00:00Z');
export const keIso = (d: Date): string => d.toISOString().slice(0, 10);

export const geserHari = (s: string, n: number): string =>
  keIso(new Date(keTanggal(s).getTime() + n * MS_HARI));

export const selisihHari = (a: string, b: string): number =>
  Math.round((keTanggal(a).getTime() - keTanggal(b).getTime()) / MS_HARI);

/** 0 = Minggu … 6 = Sabtu */
export const hariKe = (s: string): number => keTanggal(s).getUTCDay();

/** Senin sebagai awal minggu kerja. */
export const awalMinggu = (s: string): string => geserHari(s, -((hariKe(s) + 6) % 7));

export const mingguDari = (s: string): string[] =>
  Array.from({ length: 7 }, (_, i) => geserHari(awalMinggu(s), i));

export function formatPendek(s: string): string {
  const d = keTanggal(s);
  return `${d.getUTCDate()} ${NAMA_BULAN_PENDEK[d.getUTCMonth()]}`;
}

export function formatPanjang(s: string): string {
  const d = keTanggal(s);
  return `${NAMA_HARI[d.getUTCDay()]}, ${d.getUTCDate()} ${NAMA_BULAN_PENDEK[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatJudulMinggu(hari: string[]): string {
  const a = keTanggal(hari[0]);
  const b = keTanggal(hari[hari.length - 1]);
  if (a.getUTCMonth() === b.getUTCMonth()) {
    return `${a.getUTCDate()}–${b.getUTCDate()} ${NAMA_BULAN[a.getUTCMonth()]} ${a.getUTCFullYear()}`;
  }
  return `${a.getUTCDate()} ${NAMA_BULAN_PENDEK[a.getUTCMonth()]} – ${b.getUTCDate()} ${NAMA_BULAN_PENDEK[b.getUTCMonth()]} ${b.getUTCFullYear()}`;
}

export function menitDariJam(jam: string | null | undefined): number | null {
  if (!jam) return null;
  const [j, m] = jam.split(':').map(Number);
  if (Number.isNaN(j)) return null;
  return j * 60 + (m || 0);
}

export function jamDariMenit(menit: number): string {
  const j = Math.floor(menit / 60) % 24;
  const m = Math.round(menit % 60);
  return `${String(j).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Sel-sel bulan dengan Minggu di kolom pertama; null = sel kosong. */
export function gridBulan(tahun: number, bulan: number): (string | null)[] {
  const pertama = new Date(Date.UTC(tahun, bulan, 1));
  const jumlah = new Date(Date.UTC(tahun, bulan + 1, 0)).getUTCDate();
  const sel: (string | null)[] = Array.from({ length: pertama.getUTCDay() }, () => null);
  for (let d = 1; d <= jumlah; d++) sel.push(keIso(new Date(Date.UTC(tahun, bulan, d))));
  while (sel.length % 7 !== 0) sel.push(null);
  return sel;
}

/** '2026-09-15T02:00:00Z' -> '15 Sep 10:00' (WITA) */
export function formatWaktuIso(iso: string): string {
  const d = dindingWita(new Date(iso));
  return `${d.getUTCDate()} ${NAMA_BULAN_PENDEK[d.getUTCMonth()]} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

export function teksSisa(sisa: number | null): string {
  if (sisa === null) return 'tanpa tenggat';
  if (sisa < 0) return `telat ${Math.abs(sisa)} hari`;
  if (sisa === 0) return 'hari ini';
  if (sisa === 1) return 'besok';
  return `${sisa} hari lagi`;
}
