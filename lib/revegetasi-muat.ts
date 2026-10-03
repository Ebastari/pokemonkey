/**
 * Data realisasi revegetasi untuk blok grafik memo & gambar unduhan: dari
 * /api/revegetasi sekali per sesi; saat server tak terjangkau memakai salinan
 * lokal lib/revegetasi.ts (sama dengan Monkey Point).
 */

import { api } from './api';
import { REVEGETASI_BAWAAN, jumlah, type BarisRevegetasi } from './revegetasi';

export interface DataRevegetasi { baris: BarisRevegetasi[]; cadangan: boolean }

let simpanan: DataRevegetasi | null = null;
let janji: Promise<DataRevegetasi> | null = null;

export const revegetasiTersimpan = (): DataRevegetasi | null => simpanan;

export function muatRevegetasi(): Promise<DataRevegetasi> {
  if (simpanan) return Promise.resolve(simpanan);
  janji ??= api<{ revegetasi: BarisRevegetasi[] }>('/api/revegetasi')
    .then((d) => (d.revegetasi?.length ? { baris: d.revegetasi, cadangan: false } : { baris: REVEGETASI_BAWAAN, cadangan: true }))
    .catch(() => ({ baris: REVEGETASI_BAWAAN, cadangan: true }))
    .then((h) => { simpanan = h; return h; });
  return janji;
}

/** Baris dalam rentang tahun blok, urut naik. */
export function barisGrafik(semua: BarisRevegetasi[], g: { dari?: number; sampai?: number }): BarisRevegetasi[] {
  return [...semua].filter((b) => (!g.dari || b.tahun >= g.dari) && (!g.sampai || b.tahun <= g.sampai)).sort((a, b) => a.tahun - b.tahun);
}

export const kegiatanRevegetasi = (baris: BarisRevegetasi[]): [string, number][] => [
  ['IPD', jumlah(baris.map((b) => b.ipd))],
  ['OPD', jumlah(baris.map((b) => b.opd))],
  ['Timbunan Soil', jumlah(baris.map((b) => b.timbunan_soil))],
  ['Fasilitas Penunjang', jumlah(baris.map((b) => b.fasilitas))],
];

export const SUMBER_REVEGETASI = (cadangan: boolean) => (cadangan
  ? 'Server tidak terjangkau: memakai salinan lokal data realisasi'
  : 'Sumber: Realisasi Permintaan Amdal (Summary) · hektare');
