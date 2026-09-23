/**
 * Waktu — satu-satunya tempat konversi zona waktu.
 *
 * Cron Cloudflare berjalan dalam UTC, sementara tim bekerja dalam WITA (UTC+8).
 * Semua waktu disimpan di database sebagai UTC; semua yang dilihat dan diketik
 * pengguna adalah WITA. Selisihnya hanya dihitung di file ini.
 */

export const TZ_OFFSET_MENIT = 480; // WITA = UTC+8
const MS_HARI = 86_400_000;

/** Waktu sekarang dalam UTC, siap disimpan. */
export function sekarangUtcIso(): string {
  return new Date().toISOString();
}

/** Geser instant UTC ke "jam dinding" WITA, supaya getHours() dst. bisa dipakai. */
function keDindingWita(d: Date): Date {
  return new Date(d.getTime() + TZ_OFFSET_MENIT * 60_000);
}

/** Tanggal WITA hari ini, format YYYY-MM-DD. */
export function tanggalWita(d: Date = new Date()): string {
  return keDindingWita(d).toISOString().slice(0, 10);
}

/** Jam WITA, format HH:MM. */
export function jamWita(d: Date = new Date()): string {
  return keDindingWita(d).toISOString().slice(11, 16);
}

/**
 * Ubah jam dinding WITA menjadi instant UTC.
 * utcDariWita('2026-09-16', '07:00') -> 2026-09-15T23:00:00.000Z
 */
export function utcDariWita(tanggal: string, jam = '00:00'): string {
  const [t, b, g] = tanggal.split('-').map(Number);
  const [j, m] = jam.split(':').map(Number);
  const dinding = Date.UTC(t, b - 1, g, j, m, 0, 0);
  return new Date(dinding - TZ_OFFSET_MENIT * 60_000).toISOString();
}

/** Selisih hari kalender: selisihHari('2026-09-19','2026-09-15') -> 4 */
export function selisihHari(tanggal: string, dari: string): number {
  const a = Date.parse(tanggal + 'T00:00:00Z');
  const b = Date.parse(dari + 'T00:00:00Z');
  return Math.round((a - b) / MS_HARI);
}

/** Geser tanggal beberapa hari: geserHari('2026-09-15', -3) -> '2026-09-12' */
export function geserHari(tanggal: string, hari: number): string {
  return new Date(Date.parse(tanggal + 'T00:00:00Z') + hari * MS_HARI)
    .toISOString()
    .slice(0, 10);
}

const BULAN_ID = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

/** '2026-09-30' -> '30 Sep 2026' */
export function tanggalIndonesia(tanggal: string): string {
  const [t, b, g] = tanggal.split('-').map(Number);
  return `${g} ${BULAN_ID[b - 1]} ${t}`;
}

/** Kode periode mingguan ISO dari sebuah tanggal WITA: '2026-09-15' -> '26W38' */
export function kodePeriode(tanggal: string): string {
  const d = new Date(tanggal + 'T00:00:00Z');
  const hari = (d.getUTCDay() + 6) % 7; // Senin = 0
  d.setUTCDate(d.getUTCDate() - hari + 3); // Kamis di minggu yang sama
  const tahun = d.getUTCFullYear();
  const kamisPertama = new Date(Date.UTC(tahun, 0, 4));
  const geser = (kamisPertama.getUTCDay() + 6) % 7;
  kamisPertama.setUTCDate(kamisPertama.getUTCDate() - geser + 3);
  const minggu = 1 + Math.round((d.getTime() - kamisPertama.getTime()) / (7 * MS_HARI));
  return `${String(tahun).slice(2)}W${String(minggu).padStart(2, '0')}`;
}
