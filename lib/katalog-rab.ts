/**
 * Katalog uraian RAB RNR (Money Monkey) dari server — lihat server/src/katalog-rab.ts.
 * Form belanja memakai daftar ini: pemohon mencentang uraian rutin, mengisi jumlah
 * per minggu, lalu uraiannya masuk ke rekap RAB dengan kode WBS-nya.
 */

import { api } from './api';

export interface BarangKatalog {
  id: string;
  /** Lembar rincian Excel (atk, bbm, pantry, …); 'rnr' = tanpa kategori. */
  kategori?: string;
  kelompok: string;
  /** Kode WBS bawaan uraian ini. */
  wbs: string;
  nama: string;
  satuan: string;
  harga: number;
  urutan: number;
}

export const muatKatalog = async (): Promise<BarangKatalog[]> =>
  (await api<{ katalog: BarangKatalog[] }>('/api/katalog-rab')).katalog;

export const simpanBarangKatalog = (b: Partial<BarangKatalog> & { nama: string }) =>
  api<{ id: string }>('/api/katalog-rab', { body: b });

export const hapusBarangKatalog = (id: string) =>
  api<{ ok: boolean }>(`/api/katalog-rab/${encodeURIComponent(id)}`, { method: 'DELETE' });
