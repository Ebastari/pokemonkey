/**
 * Utilitas Tabel Interaktif & Pelacak Progres Otomatis di Memo.
 *
 * Bekerja secara umum untuk tabel apa saja yang memiliki kolom status/ceklis:
 * 1. Mendeteksi kolom status ('✓ Selesai', 'Belum', '[x]', '[ ]', '1', '0', dll).
 * 2. Menghitung ringkasan KPI (Total, Selesai, Sisa, Persentase Progres).
 * 3. Mengubah status baris dengan satu klik (toggle) dan otomatis menghitung
 *    ulang kolom kumulatif jika tersedia.
 * 4. Terhubung langsung secara real-time dengan komponen GrafikTabelMemo.
 */

import { barisData, kolomStatusTabel, statusBaku } from '../server/src/grafik-tabel';

export interface RingkasanTabel {
  total: number;
  selesai: number;
  sisa: number;
  persen: number;
  idxStatus: number;
  idxKumulatif: number;
}

/**
 * Selesai / belum memakai aturan yang sama dengan grafik (server/src/grafik-tabel.ts):
 * penyangkalan dicek dulu, jadi "Belum selesai" atau "Tidak selesai" = belum.
 */
export function cekNilaiSelesai(teks: string): boolean {
  return statusBaku(teks)?.kunci === 'selesai';
}

/** Teks status yang belum selesai (Open, Belum, [ ], Dikerjakan, …). */
export function cekNilaiBelum(teks: string): boolean {
  const st = statusBaku(teks);
  return Boolean(st) && st!.kunci !== 'selesai' && st!.kunci !== 'batal';
}

/** Kolom status/ceklis (judul atau isinya); -1 bila tidak ada. Baris pertama = judul. */
export function deteksiKolomStatus(baris: string[][]): number {
  return kolomStatusTabel(baris, true);
}

/** Deteksi apakah ada kolom hitungan kumulatif / running total */
export function deteksiKolomKumulatif(baris: string[][]): number {
  if (baris.length <= 1) return -1;
  const kepala = baris[0];
  return kepala.findIndex((h) => /kumulatif|cumulative|total\s*selesai|running\s*total/i.test(h));
}

/** Hitung ringkasan progres dan KPI dari tabel */
export function hitungRingkasanTabel(baris: string[][]): RingkasanTabel | null {
  if (baris.length <= 1) return null;

  const idxStatus = deteksiKolomStatus(baris);
  if (idxStatus === -1) return null;

  const idxKumulatif = deteksiKolomKumulatif(baris);
  // Baris kosong (mis. baru ditambah lewat "+ Baris") tidak ikut dihitung.
  const isi = barisData(baris.slice(1));
  const total = isi.length;
  const selesai = isi.filter((r) => cekNilaiSelesai(r[idxStatus] || '')).length;

  const sisa = Math.max(0, total - selesai);
  const persen = total > 0 ? Math.round((selesai / total) * 100) : 0;

  return { total, selesai, sisa, persen, idxStatus, idxKumulatif };
}

/**
 * Toggle status satu baris pada tabel dan otomatis hitung ulang kolom kumulatif jika ada.
 * Bekerja pada format: '✓ Selesai' <-> 'Belum', '[x]' <-> '[ ]', '☑' <-> '☐', dll.
 */
export function toggleStatusBarisTabel(baris: string[][], rowIdx: number): string[][] {
  if (rowIdx <= 0 || rowIdx >= baris.length) return baris;

  const ringkasan = hitungRingkasanTabel(baris);
  if (!ringkasan || ringkasan.idxStatus === -1) return baris;

  const { idxStatus, idxKumulatif } = ringkasan;
  const barisBaru = baris.map((r) => [...r]);
  const selTeks = (barisBaru[rowIdx][idxStatus] || '').trim();

  const saatIniSelesai = cekNilaiSelesai(selTeks);

  // Balikkan status ke kondisi sebaliknya
  if (saatIniSelesai) {
    if (selTeks.includes('[x]')) barisBaru[rowIdx][idxStatus] = '[ ] Belum';
    else if (selTeks.includes('☑')) barisBaru[rowIdx][idxStatus] = '☐ Belum';
    else if (selTeks === '1') barisBaru[rowIdx][idxStatus] = '0';
    else barisBaru[rowIdx][idxStatus] = 'Belum';
  } else {
    if (selTeks.includes('[ ]')) barisBaru[rowIdx][idxStatus] = '[x] Selesai';
    else if (selTeks.includes('☐')) barisBaru[rowIdx][idxStatus] = '☑ Selesai';
    else if (selTeks === '0') barisBaru[rowIdx][idxStatus] = '1';
    else barisBaru[rowIdx][idxStatus] = '✓ Selesai';
  }

  // Jika tabel memiliki kolom kumulatif, otomatis hitung ulang secara beruntun dari baris 1
  if (idxKumulatif !== -1) {
    let kum = 0;
    for (let i = 1; i < barisBaru.length; i++) {
      const st = barisBaru[i][idxStatus] || '';
      if (cekNilaiSelesai(st)) kum++;
      barisBaru[i][idxKumulatif] = String(kum);
    }
  }

  return barisBaru;
}

import type { OpsiGrafikTabel } from '../server/src/memo-blok';

/** Buat konfigurasi opsi grafik otomatis yang langsung terhubung ke kolom relevan tabel */
export function buatOpsiGrafikOtomatis(baris: string[][]): OpsiGrafikTabel {
  const ringkasan = hitungRingkasanTabel(baris);

  // 1. Ceklis harian (ada kolom kumulatif atau kolom hari/tanggal, mis. tracker H-01..H-30):
  //    kurva progres — selesai vs target, hari terlewat, runtunan (lebih jelas dari garis kumulatif saja).
  const kolomHari = (baris[0] ?? []).some((h) => /^(hari|tanggal|tgl|date|day)\b|hari\s*ke/i.test(h ?? ''));
  if (ringkasan && ringkasan.idxStatus !== -1 && (ringkasan.idxKumulatif !== -1 || kolomHari)) {
    return { aktif: true, tipe: 'progres', mode: 'nilai', sumbuX: 0, judul: 'Progres harian' };
  }

  // 2. Jika ada kolom status/ceklis -> langsung buat grafik Donut atau Batang rekap status
  if (ringkasan && ringkasan.idxStatus !== -1) {
    const namaStatus = baris[0]?.[ringkasan.idxStatus] || 'Status';
    return {
      aktif: true,
      tipe: 'batang',
      mode: 'hitung',
      sumbuX: ringkasan.idxStatus,
      kolomPecah: -1,
      judul: `Rekap ${namaStatus}`,
    };
  }

  // 3. Tabel numerik umum: pilih kolom angka pertama
  return {
    aktif: true,
    tipe: 'batang',
    mode: 'nilai',
    sumbuX: 0,
  };
}

/**
 * Lebar minimum tiap kolom (px) menurut isinya, agar teks dibungkus ke bawah dan
 * tidak terpotong: kolom uraian (Masalah, Akar Masalah, Tindakan, Keterangan, …)
 * paling lebar, kolom pendek (No, Status, tanggal) sempit. `lebar` = tombol
 * "Lebarkan Kolom" (×1,4). Dipakai penyunting dan mode baca.
 */
export function lebarKolomTabel(baris: string[][], lebar = false): number[] {
  if (!baris.length) return [];
  return baris[0].map((judul, j) => {
    const terpanjang = Math.max(0, ...baris.map((r) => (r[j] ?? '').length));
    const uraian = /masalah|akar|tindakan|uraian|keterangan|deskripsi|catatan|topik|materi|kegiatan|kebiasaan|rincian|hasil/i.test(judul ?? '');
    const dasar = uraian || terpanjang > 40 ? 240 : terpanjang > 18 ? 160 : 96;
    return Math.round(dasar * (lebar ? 1.4 : 1));
  });
}

/**
 * Grafik menyimpan nomor kolom. Saat kolom dihapus, disisip, atau tabel diimpor ulang,
 * nomor itu dipetakan ulang menurut NAMA judul kolom, agar grafik tetap menunjuk kolom
 * yang sama (bukan diam-diam kolom lain). Kolom yang hilang → kembali otomatis.
 */
export function sesuaikanGrafik(lama: string[][], baru: string[][], kepala: boolean, g: OpsiGrafikTabel): OpsiGrafikTabel {
  const judulLama = lama[0] ?? [];
  const judulBaru = baru[0] ?? [];
  if (judulLama.length === judulBaru.length && judulLama.every((c, j) => c === judulBaru[j])) return g;
  // Tanpa baris judul: hanya nomor yang masih ada yang dipakai.
  const peta = (j: number | undefined): number | undefined => {
    if (j === undefined || j < 0) return j;
    if (!kepala) return j < judulBaru.length ? j : undefined;
    const nama = (judulLama[j] ?? '').trim().toLowerCase();
    if (!nama) return j < judulBaru.length ? j : undefined;
    const k = judulBaru.findIndex((c) => c.trim().toLowerCase() === nama);
    return k === -1 ? undefined : k;
  };
  const seriY = (g.seriY ?? []).map(peta).filter((j): j is number => j !== undefined && j >= 0);
  return {
    ...g,
    sumbuX: peta(g.sumbuX),
    seriY: seriY.length ? seriY : undefined,
    kolomPecah: g.kolomPecah === -1 ? -1 : peta(g.kolomPecah),
  };
}

/** Ringkasan tanpa centang di baris tertentu (habit: hari yang belum tiba tidak dihitung, sama dengan grafik). */
export function ringkasanTanpa(r: RingkasanTabel, baris: string[][], kecuali: Set<number>): RingkasanTabel {
  if (!kecuali.size) return r;
  const selesai = baris.filter((b, i) => i > 0 && !kecuali.has(i) && b.some((c) => (c ?? '').trim()) && cekNilaiSelesai(b[r.idxStatus] || '')).length;
  return { ...r, selesai, sisa: Math.max(0, r.total - selesai), persen: r.total > 0 ? Math.round((selesai / r.total) * 100) : 0 };
}
