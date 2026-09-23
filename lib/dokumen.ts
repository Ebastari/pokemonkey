/**
 * Dokumen administrasi di sisi aplikasi: nomor surat, Internal Memo dinas, MoM.
 *
 * Dulu hanya tersimpan di localStorage ponsel masing-masing. Sekarang data ada di
 * server (D1) supaya satu tim melihat daftar yang sama. Isi formulirnya tetap
 * bentuk yang dipakai layar; server menyimpannya utuh sebagai JSON.
 *
 * Data lama yang masih ada di ponsel dipindahkan sekali saat daftar server masih
 * kosong, lalu kunci localStorage-nya dihapus agar tidak terkirim dua kali.
 */

import { api } from './api';
import type { ItemSurat } from './tipe-surat';
import { DATA_SURAT_AWAL } from './data-surat-awal';
import type { DataMemoDinas } from './ekspor-memo-dinas';
import type { DataMOM } from './ekspor-mom';

export const KUNCI_MEMO_DINAS = 'pokemonkey_memo_dinas_list';
export const KUNCI_MOM = 'pokemonkey_mom_list';
export const KUNCI_NOMOR_SURAT = 'pokemonkey_manajemen_surat_list';

/** Jejak dari server yang ikut di setiap dokumen. */
export interface JejakDokumen {
  dibuatPada?: string;
  diubahPada?: string | null;
  dibuatOleh?: string | null;
  dibuatOlehNama?: string | null;
}

const bacaLokal = <T>(kunci: string): T[] => {
  try {
    const raw = localStorage.getItem(kunci);
    const isi = raw ? JSON.parse(raw) : null;
    return Array.isArray(isi) ? (isi as T[]) : [];
  } catch { return []; }
};
const lupakanLokal = (kunci: string) => { try { localStorage.removeItem(kunci); } catch { /* abaikan */ } };

/**
 * Ambil daftar dari server. Bila server masih kosong tetapi ponsel ini masih
 * menyimpan data lama, data itu dipindahkan dulu sekali, lalu dipakai.
 * `bawaan` hanya dipakai bila server belum pernah diisi sama sekali.
 */
async function muatDenganPindahan<T extends { id?: string }>(
  jalur: string, kunciJawaban: string, kunciLokal: string, bawaan: T[] = [],
): Promise<T[]> {
  const d = await api<Record<string, T[] | boolean | undefined>>(jalur);
  const dariServer = (d[kunciJawaban] as T[] | undefined) ?? [];
  if (dariServer.length) { lupakanLokal(kunciLokal); return dariServer; }

  const lokal = bacaLokal<T>(kunciLokal).filter((x) => x && x.id);
  // Daftar bawaan tidak diisikan ulang kalau server memang sengaja dikosongkan.
  const pindahan = lokal.length ? lokal : (d.awalTerisi === true ? [] : bawaan);
  if (!pindahan.length) return [];

  for (let i = 0; i < pindahan.length; i += 200) {
    await api(`${jalur}/impor`, { body: { daftar: pindahan.slice(i, i + 200) } });
  }
  lupakanLokal(kunciLokal);
  const ulang = await api<Record<string, T[] | undefined>>(jalur);
  return (ulang[kunciJawaban] as T[] | undefined) ?? pindahan;
}

// ------------------------------------------------------------- nomor surat

export const simpanSuratKeServer = (item: ItemSurat) => api<{ id: string }>('/api/surat', { body: item });
export const hapusSuratDiServer = (id: string) => api<{ ok: boolean }>(`/api/surat/${encodeURIComponent(id)}`, { method: 'DELETE' });
/** Register surat bawaan aplikasi ikut naik ke server saat pertama kali dipakai. */
export const muatSurat = () => muatDenganPindahan<ItemSurat & JejakDokumen>('/api/surat', 'surat', KUNCI_NOMOR_SURAT, DATA_SURAT_AWAL);

// -------------------------------------------------------- Internal Memo dinas

export const simpanMemoDinasKeServer = (item: DataMemoDinas) => api<{ id: string }>('/api/memo-dinas', { body: item });
export const hapusMemoDinasDiServer = (id: string) => api<{ ok: boolean }>(`/api/memo-dinas/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const muatMemoDinas = () => muatDenganPindahan<DataMemoDinas & JejakDokumen>('/api/memo-dinas', 'memoDinas', KUNCI_MEMO_DINAS);

// ------------------------------------------------------------------- MoM

export const simpanMomKeServer = (item: DataMOM) => api<{ id: string }>('/api/mom', { body: item });
export const hapusMomDiServer = (id: string) => api<{ ok: boolean }>(`/api/mom/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const muatMom = () => muatDenganPindahan<DataMOM & JejakDokumen>('/api/mom', 'mom', KUNCI_MOM);

// ------------------------------------------------------------- foto profil

/** Kirim foto (data URL hasil pengecilan di layar); jawabannya kunci berkas di server. */
export const simpanFotoProfil = (dataUrl: string) => api<{ foto: string }>('/api/profil/foto', { body: { foto: dataUrl } });
export const hapusFotoProfil = () => api<{ foto: null }>('/api/profil/foto', { method: 'DELETE' });
