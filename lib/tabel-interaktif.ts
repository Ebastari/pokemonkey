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

export interface RingkasanTabel {
  total: number;
  selesai: number;
  sisa: number;
  persen: number;
  idxStatus: number;
  idxKumulatif: number;
}

/** Periksa apakah teks sel menunjukkan kondisi selesai / tercapai */
export function cekNilaiSelesai(teks: string): boolean {
  const s = (teks || '').trim().toLowerCase();
  return (
    s.includes('selesai') ||
    s.includes('✓') ||
    s.includes('✔') ||
    s.includes('[x]') ||
    s.includes('☑') ||
    s === '1' ||
    s.includes('done') ||
    s.includes('tuntas') ||
    s.includes('closed')
  );
}

/** Periksa apakah teks sel menunjukkan kondisi belum / pending */
export function cekNilaiBelum(teks: string): boolean {
  const s = (teks || '').trim().toLowerCase();
  return (
    s.includes('belum') ||
    s.includes('[ ]') ||
    s.includes('☐') ||
    s === '0' ||
    s.includes('pending') ||
    s.includes('open') ||
    s.includes('to do') ||
    s.includes('todo')
  );
}

/** Deteksi apakah kolom pada baris data berisi status/ceklis */
export function deteksiKolomStatus(baris: string[][]): number {
  if (baris.length <= 1) return -1;
  const kepala = baris[0];

  // 1. Cek dari nama header kolom
  const idxHeader = kepala.findIndex((h) =>
    /status|ceklis|check|selesai|kondisi|state|progres\s*hari/i.test(h)
  );
  if (idxHeader !== -1) return idxHeader;

  // 2. Cek dari isi sel jika nama header umum
  for (let j = 0; j < kepala.length; j++) {
    let adaSelesai = false;
    let adaBelum = false;
    for (let i = 1; i < baris.length; i++) {
      const val = baris[i][j] || '';
      if (cekNilaiSelesai(val)) adaSelesai = true;
      if (cekNilaiBelum(val)) adaBelum = true;
    }
    if (adaSelesai && adaBelum) return j;
  }

  return -1;
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
  const total = baris.length - 1;
  let selesai = 0;

  for (let i = 1; i < baris.length; i++) {
    const val = baris[i][idxStatus] || '';
    if (cekNilaiSelesai(val)) {
      selesai++;
    }
  }

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

  // 1. Jika ada kolom kumulatif (seperti YOLO Tracker) -> langsung buat grafik Garis tren kumulatif
  if (ringkasan && ringkasan.idxKumulatif !== -1) {
    const namaKum = baris[0]?.[ringkasan.idxKumulatif] || 'Kumulatif';
    return {
      aktif: true,
      tipe: 'garis',
      mode: 'nilai',
      sumbuX: 0,
      seriY: [ringkasan.idxKumulatif],
      judul: `Tren Progres Kumulatif (${namaKum})`,
    };
  }

  // 2. Jika ada kolom status/ceklis -> langsung buat grafik Donut atau Batang rekap status
  if (ringkasan && ringkasan.idxStatus !== -1) {
    const namaStatus = baris[0]?.[ringkasan.idxStatus] || 'Status';
    return {
      aktif: true,
      tipe: 'pie',
      mode: 'hitung',
      sumbuX: ringkasan.idxStatus,
      kolomPecah: -1,
      judul: `Rekap ${namaStatus} (${ringkasan.total} Item)`,
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
