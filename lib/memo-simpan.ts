/**
 * Simpan memo yang tahan sinyal hilang.
 *
 * Perubahan memo dikirim lewat PATCH. Bila gagal karena jaringan (status 0),
 * isinya disimpan di perangkat dan dikirim ulang sendiri saat sinyal kembali,
 * saat aplikasi dibuka lagi, atau tiap jeda singkat. Galat lain (ditolak
 * server) tidak diantrekan, supaya tidak dicoba tanpa akhir.
 */

import { api, GalatApi } from './api';
import type { Memo } from '../types';

const KUNCI = 'pokemonkey_memo_tertunda';

export type PatchMemo = Partial<Pick<Memo,
  'judul' | 'isi' | 'ringkasan' | 'kategori' | 'tipe' | 'status' | 'tanggal' | 'warna' | 'disematkan' | 'pica_id' | 'props'>>;

interface Tertunda { patch: PatchMemo; pada: number }

function baca(): Record<string, Tertunda> {
  try { return JSON.parse(localStorage.getItem(KUNCI) || '{}'); } catch { return {}; }
}
function tulis(d: Record<string, Tertunda>): void {
  try {
    if (Object.keys(d).length) localStorage.setItem(KUNCI, JSON.stringify(d));
    else localStorage.removeItem(KUNCI);
  } catch { /* penyimpanan penuh atau diblokir: perubahan tetap ada di layar */ }
}

export const galatJaringan = (e: unknown): boolean => e instanceof GalatApi && e.status === 0;

export const ambilTertunda = (id: string): PatchMemo | null => baca()[id]?.patch ?? null;
export const jumlahTertunda = (): number => Object.keys(baca()).length;

function simpanTertunda(id: string, patch: PatchMemo): void {
  const d = baca();
  d[id] = { patch: { ...(d[id]?.patch ?? {}), ...patch }, pada: Date.now() };
  tulis(d);
}
function hapusTertunda(id: string): void {
  const d = baca();
  delete d[id];
  tulis(d);
}

/**
 * Kirim satu perubahan. 'tersimpan' = server menerima; 'tertunda' = tidak ada
 * sinyal, tersimpan di perangkat dan akan dikirim otomatis.
 */
export async function patchMemo(id: string, patch: PatchMemo): Promise<'tersimpan' | 'tertunda'> {
  const gabung = { ...(ambilTertunda(id) ?? {}), ...patch };
  try {
    await api(`/api/memo/${id}`, { method: 'PATCH', body: gabung });
    hapusTertunda(id);
    return 'tersimpan';
  } catch (e) {
    if (galatJaringan(e)) { simpanTertunda(id, patch); return 'tertunda'; }
    throw e;
  }
}

let sedangKirim = false;

/** Kirim ulang semua yang tertunda. Mengembalikan jumlah memo yang berhasil terkirim. */
export async function kirimTertunda(onTerkirim?: (id: string, patch: PatchMemo) => void): Promise<number> {
  if (sedangKirim) return 0;
  sedangKirim = true;
  let terkirim = 0;
  try {
    for (const [id, item] of Object.entries(baca())) {
      try {
        await api(`/api/memo/${id}`, { method: 'PATCH', body: item.patch });
        hapusTertunda(id);
        terkirim += 1;
        onTerkirim?.(id, item.patch);
      } catch (e) {
        if (galatJaringan(e)) break;      // masih tanpa sinyal: coba lagi nanti
        hapusTertunda(id);                // ditolak server (mis. memo sudah dihapus): buang
      }
    }
  } finally {
    sedangKirim = false;
  }
  return terkirim;
}

/** Pasang pengirim otomatis; mengembalikan fungsi pelepas. */
export function pasangPengirimTertunda(onTerkirim?: (id: string, patch: PatchMemo) => void): () => void {
  const coba = () => { if (jumlahTertunda() > 0) void kirimTertunda(onTerkirim); };
  const saatTampil = () => { if (document.visibilityState === 'visible') coba(); };
  window.addEventListener('online', coba);
  document.addEventListener('visibilitychange', saatTampil);
  const pewaktu = setInterval(coba, 20_000);
  coba();
  return () => {
    window.removeEventListener('online', coba);
    document.removeEventListener('visibilitychange', saatTampil);
    clearInterval(pewaktu);
  };
}
