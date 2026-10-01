/**
 * Gambar dan berkas di dalam memo: kecilkan foto, unggah ke R2 lewat /api/lampiran
 * (entitas 'memo'), dan unduh lagi. Kunci hasil unggah ditulis ke teks memo:
 *   ![nama](kunci)  untuk gambar,  [nama](kunci)  untuk berkas.
 */

import { api, ambilBerkas } from './api';
import { simpanBerkas } from './unduh';

export const MAKS_BYTE_MEMO = 8 * 1024 * 1024;

/**
 * Foto diperkecil ke sisi terpanjang 1280 px dan JPEG 82% (hemat kuota lapangan,
 * sama dengan foto FEED). GIF dan SVG dibiarkan; PNG dengan latar transparan
 * dialasi putih.
 */
export async function kecilkanGambar(file: File, maksSisi = 1280, kualitas = 0.82): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const skala = Math.min(1, maksSisi / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * skala));
  const h = Math.max(1, Math.round(bitmap.height * skala));
  const kanvas = document.createElement('canvas');
  kanvas.width = w;
  kanvas.height = h;
  const g = kanvas.getContext('2d');
  if (!g) { bitmap.close?.(); return file; }
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, w, h);
  g.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>((r) => kanvas.toBlob(r, 'image/jpeg', kualitas));
  if (!blob) return file;
  // JPEG kecil yang sudah efisien tidak perlu diganti hasil olahan yang malah lebih besar.
  if (skala === 1 && file.type === 'image/jpeg' && blob.size >= file.size) return file;
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'foto'}.jpg`, { type: 'image/jpeg' });
}

/** Nama yang aman ditulis di dalam tanda [ ] ( ) pada teks memo. */
export const namaAmanMemo = (nama: string) => nama.replace(/[[\]()\n]+/g, ' ').replace(/\s+/g, ' ').trim() || 'berkas';

export interface HasilUnggahMemo { kunci: string; nama: string }

export async function unggahKeMemo(memoId: string, file: File): Promise<HasilUnggahMemo> {
  if (file.size > MAKS_BYTE_MEMO) throw new Error('Ukuran berkas maksimal 8 MB.');
  const form = new FormData();
  form.append('berkas', file);
  form.append('entitas', 'memo');
  form.append('entitas_id', memoId);
  const d = await api<{ kunci: string }>('/api/lampiran', { form });
  return { kunci: d.kunci, nama: namaAmanMemo(file.name) };
}

/** Baris teks memo untuk hasil unggah: gambar bila berkas bertipe gambar. */
export const barisUntukUnggah = (h: HasilUnggahMemo, gambar: boolean) => (gambar ? `![${h.nama}](${h.kunci})` : `[${h.nama}](${h.kunci})`);

export async function unduhBerkasMemo(kunci: string, nama: string): Promise<'dibagikan' | 'diunduh'> {
  return simpanBerkas(await ambilBerkas(kunci), nama);
}
