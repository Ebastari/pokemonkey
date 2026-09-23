/**
 * Realisasi revegetasi PT Energi Batubara Lestari, 2017–2026.
 *
 * Sumber: berkas "Realisasi Permintaan Amdal.xlsx", sheet **Summary**
 * (SUMMARY REALISASI REVEGETASI) — tiga tabel per tahun: status kawasan
 * (APL / Hutan), deskripsi kegiatan (IPD / OPD / Timbunan Soil / Fasilitas
 * Penunjang), dan sebaran per blok. Satuan hektare.
 *
 * Salinan yang sama ada di server/migrations/0009_revegetasi.sql. Berkas ini
 * dipakai sebagai cadangan saat offline dan di mode demo, sama seperti
 * lib/libur.ts. Perbarui keduanya setiap tutup tahun.
 */

export interface BarisRevegetasi {
  tahun: number;
  /** Areal Penggunaan Lain. */
  apl: number;
  /** Kawasan hutan (PPKH). */
  hutan: number;
  ipd: number;
  opd: number;
  timbunan_soil: number;
  fasilitas: number;
  /** { "Blok 1": 4.93, … } — Blok 4 tidak ada di data. */
  blok: Record<string, number>;
}

const B = (
  tahun: number, apl: number, hutan: number,
  ipd: number, opd: number, timbunan_soil: number, fasilitas: number,
  b1: number, b2: number, b3: number, b5: number, b6: number,
): BarisRevegetasi => ({
  tahun, apl, hutan, ipd, opd, timbunan_soil, fasilitas,
  blok: { 'Blok 1': b1, 'Blok 2': b2, 'Blok 3': b3, 'Blok 5': b5, 'Blok 6': b6 },
});

export const REVEGETASI_BAWAAN: BarisRevegetasi[] = [
  //  tahun   APL     Hutan    IPD     OPD     Soil   Fasilitas  B1      B2      B3      B5     B6
  B(2017,  4.082,  0.847,  0,      4.930,  0,     0,        4.930,  0,      0,      0,     0),
  B(2018,  0,     38.419,  2.303, 36.115,  0,     0,        2.303,  0,      0,      0,     36.115),
  B(2019,  7.171, 13.883, 12.983,  8.070,  0,     0,       17.971,  2.144,  0.939,  0,     0),
  B(2020, 53.283, 34.547, 33.989, 53.841,  0,     0,       69.290, 10.976,  1.271,  1.278, 5.014),
  B(2021,  0.712,  0,      0,      0.712,  0,     0,        0,      0,      0.712,  0,     0),
  B(2022,  3.432,  0,      0,      3.432,  0,     0,        0,      0,      3.432,  0,     0),
  B(2023,  2.959, 16.035, 14.511,  4.482,  0,     0,       17.635,  0.103,  1.256,  0,     0),
  B(2024, 60.124,  2.082,  2.082, 56.216,  0,     3.908,    0.424,  7.820, 53.962,  0,     0),
  B(2025, 72.740,  0,      0,     68.763,  3.873, 0.104,    0,      0,     72.740,  0,     0),
  B(2026, 37.629,  0,      0,     37.052,  0,     0.577,    0,      0,     37.629,  0,     0),
];

/**
 * Jumlah luas dalam mili-hektare lalu dibagi kembali.
 *
 * Penjumlahan pecahan biasa memberi hasil yang berbeda tergantung urutannya
 * (347,944 vs 347,945), sehingga kotak di layar KEBUN dan panel rinciannya bisa
 * menampilkan angka yang tidak sama. Lewat bilangan bulat, hasilnya tetap.
 */
export const jumlah = (nilai: number[]): number => nilai.reduce((n, x) => n + Math.round(x * 1000), 0) / 1000;

export const totalTahun = (b: BarisRevegetasi): number => jumlah([b.apl, b.hutan]);

export interface RingkasRevegetasi {
  total: number;
  apl: number;
  hutan: number;
  /** Baris tahun terbaru yang ada datanya. */
  terakhir: BarisRevegetasi | null;
  /** Total per blok, urut dari yang terluas. */
  perBlok: { nama: string; luas: number }[];
  maks: number;
}

export function ringkasRevegetasi(rows: BarisRevegetasi[]): RingkasRevegetasi {
  const blok = new Map<string, number[]>();
  let maks = 0;

  for (const b of rows) {
    maks = Math.max(maks, totalTahun(b));
    for (const [nama, luas] of Object.entries(b.blok ?? {})) blok.set(nama, [...(blok.get(nama) ?? []), luas]);
  }

  const apl = jumlah(rows.map((b) => b.apl));
  const hutan = jumlah(rows.map((b) => b.hutan));

  return {
    total: jumlah([apl, hutan]),
    apl,
    hutan,
    maks,
    terakhir: rows.length ? rows.reduce((a, b) => (b.tahun > a.tahun ? b : a)) : null,
    perBlok: [...blok].map(([nama, nilai]) => ({ nama, luas: jumlah(nilai) })).filter((x) => x.luas > 0).sort((a, b) => b.luas - a.luas),
  };
}

/** Angka hektare gaya Indonesia: 347,94 */
export const ha = (n: number): string => n.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
