/**
 * Utilitas Data & Sinkronisasi Tabel PICA di Memo.
 * Mendukung mode Live Sync (selalu update) dan Snapshot Statis (ditetapkan).
 */

import { api } from './api';
import type { PicaItem } from './tipe-api';
import type { InfoPicaLive, OpsiGrafikTabel } from '../server/src/memo-blok';
import * as W from './waktu';

/** Format nomor PICA konsisten (PICA-001 atau PICA-xxxx) */
export const nomorPica = (p: PicaItem): string =>
  p.no_urut ? `PICA-${String(p.no_urut).padStart(3, '0')}` : `PICA-${p.id.slice(0, 4)}`;

/** Kategorisasi status PICA ke 3 kelompok utama: open, continue, selesai */
export function cekStatusKategori(status: string): 'open' | 'continue' | 'selesai' {
  const s = (status || '').toLowerCase().trim();
  if (s === 'closed' || s === 'selesai') return 'selesai';
  if (s === 'progress' || s === 'on progress' || s === 'continue' || s === 'verifikasi') return 'continue';
  return 'open';
}

/** Susun matriks baris tabel memo dari daftar PICA (tidak memotong teks keterangan) */
export function susunBarisTabelPica(items: PicaItem[]): string[][] {
  const kepala = ['No PICA', 'Masalah', 'PIC', 'Due Date', 'Status'];
  const baris = items.slice(0, 100).map((p) => [
    nomorPica(p),
    (p.judul || '').replace(/[\r\n\t]+/g, ' ').trim(),
    p.pic_nama || '—',
    p.due_date ? W.formatPendek(p.due_date) : '—',
    p.status || 'Open',
  ]);
  return [kepala, ...baris];
}

/** Susun matriks baris tabel rincian lengkap untuk 1 PICA */
export function susunBarisPicaDetail(p: PicaItem): string[][] {
  return [
    ['No PICA', 'Masalah', 'Akar Masalah', 'Tindakan Korektif', 'PIC', 'Due Date', 'Status'],
    [
      nomorPica(p),
      (p.judul || '').replace(/[\r\n\t]+/g, ' ').trim(),
      (p.akar || '—').replace(/[\r\n\t]+/g, ' ').trim(),
      (p.tindakan || '—').replace(/[\r\n\t]+/g, ' ').trim(),
      p.pic_nama || '—',
      p.due_date ? W.formatPendek(p.due_date) : '—',
      p.status || 'Open',
    ],
  ];
}

/** Filter daftar PICA berdasarkan status atau id terpilih */
export function saringDaftarPica(
  daftar: PicaItem[],
  opsi: {
    filterStatus?: 'semua' | 'open' | 'continue' | 'selesai';
    picaIds?: string[];
    kueri?: string;
  }
): PicaItem[] {
  const { filterStatus = 'semua', picaIds, kueri = '' } = opsi;
  const q = kueri.trim().toLowerCase();
  const idSet = picaIds && picaIds.length > 0 ? new Set(picaIds) : null;

  return daftar.filter((p) => {
    // 1. Jika mode pilihan ID tertentu
    if (idSet && !idSet.has(p.id)) {
      return false;
    }

    // 2. Filter status jika mode filter
    if (!idSet && filterStatus !== 'semua') {
      const kat = cekStatusKategori(p.status);
      if (kat !== filterStatus) return false;
    }

    // 3. Filter teks pencarian jika ada
    if (q) {
      const no = nomorPica(p).toLowerCase();
      const judul = (p.judul || '').toLowerCase();
      const pic = (p.pic_nama || '').toLowerCase();
      const bidang = (p.bidang || '').toLowerCase();
      if (!no.includes(q) && !judul.includes(q) && !pic.includes(q) && !bidang.includes(q)) {
        return false;
      }
    }

    return true;
  });
}

// Cache ringan dalam memori untuk mencegah spam HTTP GET /api/pica
let cachePica: { waktu: number; data: PicaItem[] } | null = null;
const CACHE_TTL_MS = 4000; // 4 detik

export async function ambilDaftarPica(paksaSegarkan = false): Promise<PicaItem[]> {
  const sekarang = Date.now();
  if (!paksaSegarkan && cachePica && sekarang - cachePica.waktu < CACHE_TTL_MS) {
    return cachePica.data;
  }
  try {
    const res = await api<{ pica: PicaItem[] }>('/api/pica');
    const items = res.pica ?? [];
    cachePica = { waktu: sekarang, data: items };
    return items;
  } catch {
    return cachePica ? cachePica.data : [];
  }
}

/** Sinkronkan tabel dari server berdasarkan konfigurasi InfoPicaLive */
export async function sinkronkanTabelPica(
  pica: InfoPicaLive,
  paksaSegarkan = false
): Promise<{ baris: string[][]; total: number } | null> {
  const daftar = await ambilDaftarPica(paksaSegarkan);
  if (!daftar || daftar.length === 0) return null;

  const tersaring = saringDaftarPica(daftar, {
    filterStatus: pica.filterStatus,
    picaIds: pica.picaIds,
  });

  const baris = susunBarisTabelPica(tersaring);
  return { baris, total: tersaring.length };
}

/** Waktu format jam & menit Indonesia untuk cap update */
export function capWaktuSekarang(): string {
  const d = new Date();
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** Format tanggal & jam lengkap untuk cap "ditetapkan" */
export function capDitetapkanSekarang(): string {
  const d = new Date();
  return `${W.formatPendek(d.toISOString())} ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
}

/** Buat blok raw `!tabel{...}` dengan konfigurasi PICA dan grafik donat otomatis */
export function rakitBlokTabelPica(
  items: PicaItem[],
  opsi: {
    live: boolean;
    mode: 'filter' | 'pilihan';
    filterStatus?: 'semua' | 'open' | 'continue' | 'selesai';
    picaIds?: string[];
    denganGrafik?: boolean;
    ditetapkan?: boolean;
  }
): string {
  const baris = susunBarisTabelPica(items);
  const pica: InfoPicaLive = {
    aktif: opsi.live,
    mode: opsi.mode,
    filterStatus: opsi.filterStatus,
    picaIds: opsi.picaIds,
    terakhirUpdate: capWaktuSekarang(),
    ...(opsi.ditetapkan ? { ditetapkanPada: capDitetapkanSekarang() } : {}),
  };

  const grafik: OpsiGrafikTabel | undefined =
    opsi.denganGrafik !== false
      ? {
          aktif: true,
          tipe: 'pie',
          mode: 'hitung',
          sumbuX: 4, // Kolom Status
          kolomPecah: -1,
          judul: `Rekap Status PICA (${items.length} Data)`,
        }
      : undefined;

  return `!tabel${JSON.stringify({
    kepala: true,
    baris,
    ...(grafik ? { grafik } : {}),
    pica,
  })}`;
}
