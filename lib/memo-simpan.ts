/**
 * Simpan memo yang tahan sinyal hilang dan tahan suntingan bersamaan.
 *
 * Perubahan memo dikirim lewat PATCH. Bila gagal karena jaringan (status 0),
 * isinya disimpan di perangkat dan dikirim ulang sendiri saat sinyal kembali,
 * saat aplikasi dibuka lagi, atau tiap jeda singkat. Galat lain (ditolak
 * server) tidak diantrekan, supaya tidak dicoba tanpa akhir.
 *
 * Bentrok: perubahan isi membawa versi dasarnya (`dasar_diubah`). Bila memo
 * sudah diubah orang lain sejak itu, server menjawab 409 beserta isi terbaru;
 * isi kita digabung per baris dengan isi mereka (lib/gabung-isi.ts) lalu
 * dikirim ulang — tidak ada suntingan yang saling menimpa diam-diam.
 */

import { api, GalatApi } from './api';
import { gabungTigaArah } from './gabung-isi';
import type { Memo } from '../types';

const KUNCI = 'pokemonkey_memo_tertunda';

export type PatchMemo = Partial<Pick<Memo,
  'judul' | 'isi' | 'ringkasan' | 'kategori' | 'tipe' | 'status' | 'tanggal' | 'warna' | 'disematkan' | 'pica_id' | 'props' | 'akses'>>;

/** Isi memo yang terakhir diketahui ada di server — titik berangkat suntingan kita. */
export interface DasarIsi { isi: string; diubah_pada: string | null }

export interface HasilSimpan {
  status: 'tersimpan' | 'tertunda';
  /** Versi server sesudah simpan (dasar suntingan berikutnya). */
  diubah_pada?: string | null;
  /** Ada perubahan orang lain yang digabung: isi akhirnya dan jumlah baris yang bentrok. */
  gabung?: { isi: string; bentrok: number };
}

interface Tertunda { patch: PatchMemo; pada: number; dasar?: DasarIsi }

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

function simpanTertunda(id: string, patch: PatchMemo, dasar?: DasarIsi): void {
  const d = baca();
  // Dasar yang pertama dipertahankan: itulah versi server sebelum semua suntingan luring ini.
  d[id] = { patch: { ...(d[id]?.patch ?? {}), ...patch }, pada: Date.now(), dasar: d[id]?.dasar ?? dasar };
  tulis(d);
}
function hapusTertunda(id: string): void {
  const d = baca();
  delete d[id];
  tulis(d);
}

/** Satu PATCH; bila bentrok (409) dan ada dasar, isi digabung lalu dikirim ulang sekali. */
async function kirimPatch(id: string, patch: PatchMemo, dasar?: DasarIsi): Promise<Omit<HasilSimpan, 'status'>> {
  const body: Record<string, unknown> = { ...patch };
  if (dasar && typeof patch.isi === 'string') body.dasar_diubah = dasar.diubah_pada;
  try {
    const r = await api<{ diubah_pada?: string }>(`/api/memo/${id}`, { method: 'PATCH', body });
    return { diubah_pada: r?.diubah_pada ?? null };
  } catch (e) {
    const data = e instanceof GalatApi ? e.data as { memo?: { isi?: string; diubah_pada?: string } } | undefined : undefined;
    if (!(e instanceof GalatApi) || e.status !== 409 || !dasar || typeof patch.isi !== 'string' || typeof data?.memo?.isi !== 'string') throw e;
    const gabung = gabungTigaArah(dasar.isi, patch.isi, data.memo.isi);
    const r = await api<{ diubah_pada?: string }>(`/api/memo/${id}`, {
      method: 'PATCH', body: { ...patch, isi: gabung.isi, dasar_diubah: data.memo.diubah_pada ?? null },
    });
    return { diubah_pada: r?.diubah_pada ?? null, gabung };
  }
}

/**
 * Kirim satu perubahan. 'tersimpan' = server menerima; 'tertunda' = tidak ada
 * sinyal, tersimpan di perangkat dan akan dikirim otomatis. `dasar` (opsional)
 * menyalakan penjaga bentrok untuk perubahan isi.
 */
export async function simpanMemo(id: string, patch: PatchMemo, dasar?: DasarIsi): Promise<HasilSimpan> {
  const antre = baca()[id];
  const gabung = { ...(antre?.patch ?? {}), ...patch };
  try {
    const hasil = await kirimPatch(id, gabung, antre?.dasar ?? dasar);
    hapusTertunda(id);
    return { status: 'tersimpan', ...hasil };
  } catch (e) {
    if (galatJaringan(e)) { simpanTertunda(id, patch, dasar); return { status: 'tertunda' }; }
    throw e;
  }
}

/** Seperti simpanMemo tanpa penjaga bentrok (mis. mencentang satu tugas). */
export async function patchMemo(id: string, patch: PatchMemo): Promise<'tersimpan' | 'tertunda'> {
  return (await simpanMemo(id, patch)).status;
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
        const hasil = await kirimPatch(id, item.patch, item.dasar);
        hapusTertunda(id);
        terkirim += 1;
        onTerkirim?.(id, hasil.gabung ? { ...item.patch, isi: hasil.gabung.isi } : item.patch);
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
