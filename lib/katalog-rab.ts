/**
 * Katalog barang RAB (Money Monkey) dari server — lihat server/src/katalog-rab.ts.
 * Form belanja memakai daftar ini: pemohon mencentang barang, mengisi jumlah,
 * lalu barangnya dimasukkan ke lembar RAB sesuai kategori & minggu.
 */

import { api } from './api';

export interface BarangKatalog {
  id: string;
  /** Id lembar RAB: atk, bbm, catering, perdin, listrik, air, telp, pantry, khl. */
  kategori: string;
  kelompok: string;
  nama: string;
  satuan: string;
  harga: number;
  urutan: number;
}

/** Satu barang yang dipilih di form belanja, siap dimasukkan ke RAB. */
export interface PilihanBelanja {
  kategori: string;
  mingguKe: number;
  namaBarang: string;
  satuan: string;
  hargaSatuan: number;
  qty: number;
}

export const LEMBAR_RAB: { id: string; nama: string }[] = [
  { id: 'atk', nama: 'ATK' }, { id: 'bbm', nama: 'BBM' }, { id: 'catering', nama: 'Catering' },
  { id: 'perdin', nama: 'Perdin & Cuti' }, { id: 'listrik', nama: 'Listrik PLN' }, { id: 'air', nama: 'Air PDAM' },
  { id: 'telp', nama: 'Telp & Internet' }, { id: 'pantry', nama: 'Pantry' }, { id: 'khl', nama: 'KHL' },
];

export const muatKatalog = async (): Promise<BarangKatalog[]> =>
  (await api<{ katalog: BarangKatalog[] }>('/api/katalog-rab')).katalog;

export const simpanBarangKatalog = (b: Partial<BarangKatalog> & { nama: string; kategori: string }) =>
  api<{ id: string }>('/api/katalog-rab', { body: b });

export const hapusBarangKatalog = (id: string) =>
  api<{ ok: boolean }>(`/api/katalog-rab/${encodeURIComponent(id)}`, { method: 'DELETE' });
