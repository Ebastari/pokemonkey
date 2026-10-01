/**
 * Tugas (ceklis) lintas memo: dikumpulkan dari semua memo yang terlihat,
 * dikelompokkan menurut tenggat untuk tampilan Tugas dan Kalender memo.
 */

import { ambilTugas } from '../server/src/memo-blok';
import type { Memo } from '../types';

export interface TugasLintas {
  memoId: string;
  judulMemo: string;
  lingkup: 'pribadi' | 'tim';
  penulisId: string | null;
  /** Nomor baris ceklis di teks memo. */
  indeks: number;
  selesai: boolean;
  judul: string;
  tanggal: string | null;
  jam: string | null;
  /** Penanggung jawab: orang yang disebut (memo tim) atau penulis memo. */
  penanggung: string | null;
}

export function kumpulkanTugas(memos: readonly Memo[], idTim: ReadonlySet<string>): TugasLintas[] {
  const hasil: TugasLintas[] = [];
  for (const m of memos) {
    for (const t of ambilTugas(m.isi)) {
      const disebut = m.lingkup === 'tim' && t.pic && idTim.has(t.pic) ? t.pic : null;
      hasil.push({
        memoId: m.id,
        judulMemo: m.judul,
        lingkup: m.lingkup,
        penulisId: m.user_id ?? null,
        indeks: t.indeks,
        selesai: t.selesai,
        judul: t.judul || 'Tugas memo',
        tanggal: t.tanggal,
        jam: t.jam,
        penanggung: disebut ?? m.user_id ?? null,
      });
    }
  }
  return hasil;
}

export type KelompokTugas = 'terlambat' | 'hariIni' | 'mendatang' | 'tanpaTenggat' | 'selesai';

export const URUT_KELOMPOK: { id: KelompokTugas; label: string }[] = [
  { id: 'terlambat', label: 'Terlambat' },
  { id: 'hariIni', label: 'Hari ini' },
  { id: 'mendatang', label: 'Mendatang' },
  { id: 'tanpaTenggat', label: 'Tanpa tenggat' },
  { id: 'selesai', label: 'Selesai' },
];

export function kelompokDari(t: Pick<TugasLintas, 'selesai' | 'tanggal'>, hariIni: string): KelompokTugas {
  if (t.selesai) return 'selesai';
  if (!t.tanggal) return 'tanpaTenggat';
  if (t.tanggal < hariIni) return 'terlambat';
  return t.tanggal === hariIni ? 'hariIni' : 'mendatang';
}

/** Tenggat paling awal dulu; yang tanpa tenggat di akhir; sisanya menurut judul. */
export function urutTugas(a: TugasLintas, b: TugasLintas): number {
  const ka = `${a.tanggal ?? '9999-99-99'} ${a.jam ?? '99:99'}`;
  const kb = `${b.tanggal ?? '9999-99-99'} ${b.jam ?? '99:99'}`;
  return ka.localeCompare(kb) || a.judul.localeCompare(b.judul);
}

/** Tenggat tugas belum selesai yang paling dekat dalam satu isi memo (untuk urutan "Tenggat"). */
export function tenggatTerdekat(isi: string): string | null {
  let paling: string | null = null;
  for (const t of ambilTugas(isi)) {
    if (!t.selesai && t.tanggal && (!paling || t.tanggal < paling)) paling = t.tanggal;
  }
  return paling;
}
