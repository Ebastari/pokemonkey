/**
 * Skin Prestasi — skin langka yang tidak bisa dibeli; terbuka sendiri saat syarat
 * kerjanya tercapai (dihitung dari data yang sudah ada). Murni: dipakai server,
 * mode demo, dan aplikasi (SHOP menampilkan syarat & kemajuan).
 */

export type KodePrestasi = 'first_responder' | 'pemburu_pica' | 'penyelamat_tim' | 'fotografer';

export interface AturanPrestasi {
  kode: KodePrestasi;
  /** Id skin yang dibuka (constants.ts → SKINS). */
  skin: string;
  nama: string;
  syarat: string;
  target: number;
  satuan: string;
}

export const PRESTASI: AturanPrestasi[] = [
  { kode: 'first_responder', skin: 'first_responder', nama: 'First Responder', syarat: 'Menjadi pemeriksa pertama sebuah titik api (ground check di FIRE).', target: 1, satuan: 'titik api' },
  { kode: 'pemburu_pica', skin: 'pemburu_pica', nama: 'Pemburu PICA', syarat: 'Menutup 10 PICA sebagai PIC.', target: 10, satuan: 'PICA ditutup' },
  { kode: 'penyelamat_tim', skin: 'penyelamat_tim', nama: 'Penyelamat Tim', syarat: 'Menulis update atau bukti pada PICA telat milik orang lain, lalu PICA itu ditutup.', target: 1, satuan: 'PICA diselamatkan' },
  { kode: 'fotografer', skin: 'fotografer', nama: 'Fotografer Lapangan', syarat: '30 laporan lapangan berfoto di hari yang sama.', target: 30, satuan: 'laporan berfoto' },
];

export const SKIN_PRESTASI = new Set(PRESTASI.map((p) => p.skin));
export const prestasiDariSkin = (skin: string) => PRESTASI.find((p) => p.skin === skin) ?? null;
