/**
 * Habit tracker 1 bulan di memo (menu "/" → Habit).
 *
 * Satu baris = satu hari: Hari · Tanggal · Fase · Kebiasaan · Status · Kumulatif
 * (+ Catatan bila ada). Disimpan sebagai tabel memo biasa dengan grafik 'progres'
 * (server/src/grafik-tabel.ts), jadi ikut tampil di mode baca, halaman bagikan,
 * dan gambar unduhan; ceklis di tabel langsung menggerakkan grafik.
 *
 * Isi bisa dibuat langsung, dari contoh CSV, dari prompt AI (ChatGPT/Gemini) yang
 * jawabannya ditempel/diunggah, atau dari Excel/CSV sendiri (kolom dicocokkan menurut
 * judul; kumulatif selalu dihitung ulang dari ceklis).
 */

import { rakitTabel, MAKS_BARIS_TABEL } from '../server/src/memo-blok';
import { bacaTanggal, hariIniWita, statusBaku, tambahHari } from '../server/src/grafik-tabel';

export const KEPALA_HABIT = ['Hari', 'Tanggal', 'Fase', 'Kebiasaan', 'Status', 'Kumulatif'];
export const LAMA_HABIT = [7, 14, 21, 30, 31] as const;

const dua = (n: number) => String(n).padStart(2, '0');

/** Tiga tahap pembentukan kebiasaan, dibagi rata sepanjang masa. */
export function faseHabit(i: number, n: number): string {
  const per = Math.ceil(n / 3);
  return ['Fase 1 · Memulai', 'Fase 2 · Menguatkan', 'Fase 3 · Mengunci'][Math.min(2, Math.floor(i / per))];
}

/** Tabel habit kosong: satu kebiasaan yang sama setiap hari, semua "Belum". */
export function buatBarisHabit(kebiasaan: string, mulai: string, hari: number): string[][] {
  const n = Math.max(1, Math.min(MAKS_BARIS_TABEL - 1, hari));
  const isi = kebiasaan.trim() || 'Kebiasaan harian';
  return [KEPALA_HABIT, ...Array.from({ length: n }, (_, i) => [`H-${dua(i + 1)}`, tambahHari(mulai, i), faseHabit(i, n), isi, 'Belum', '0'])];
}

const csvSel = (s: string) => (/[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
const keCsv = (baris: string[][]) => baris.map((r) => r.map(csvSel).join(',')).join('\n');

/** Contoh CSV 30 hari (bangun pagi + olahraga, naik bertahap) — boleh diubah di Excel lalu diunggah. */
export function contohCsvHabit(mulai: string): string {
  const tugas = (i: number) => (
    (i + 1) % 7 === 0 ? 'Evaluasi mingguan: catat yang berhasil dan yang terlewat'
      : i < 10 ? 'Bangun 05.30 lalu jalan kaki 10 menit'
        : i < 20 ? 'Bangun 05.15 lalu jalan cepat 15 menit'
          : 'Bangun 05.00 lalu olahraga 20 menit'
  );
  const catatan = (i: number) => (i === 0 ? 'Siapkan sepatu di dekat pintu malam sebelumnya' : (i + 1) % 7 === 0 ? 'Hari ringan: cukup peregangan' : '');
  const status = (i: number) => (i < 5 ? (i === 2 ? 'Belum' : '✓ Selesai') : 'Belum');
  const baris = [['Hari', 'Tanggal', 'Fase', 'Kebiasaan', 'Status', 'Catatan'],
    ...Array.from({ length: 30 }, (_, i) => [`H-${dua(i + 1)}`, tambahHari(mulai, i), faseHabit(i, 30), tugas(i), status(i), catatan(i)])];
  return keCsv(baris);
}

/** Prompt siap tempel ke ChatGPT/Gemini: jawabannya CSV yang langsung bisa diunggah/ditempel. */
export function promptHabit(kebiasaan: string, mulai: string, hari: number): string {
  const tujuan = kebiasaan.trim() || '(tulis kebiasaan yang ingin dibentuk atau diubah)';
  return [
    `Kamu pelatih kebiasaan (habit coach). Buatkan rencana ${hari} hari untuk membentuk atau mengubah kebiasaan berikut: "${tujuan}".`,
    `Mulai tanggal ${mulai}.`,
    '',
    'Aturan jawaban:',
    '1. Keluarkan HANYA teks CSV, tanpa penjelasan dan tanpa tanda ```.',
    '2. Pemisah koma. Baris pertama persis: Hari,Tanggal,Fase,Kebiasaan,Status,Catatan',
    `3. Tepat ${hari} baris data, satu baris per hari. Hari: H-01 sampai H-${dua(hari)}. Tanggal: YYYY-MM-DD berurutan mulai ${mulai}.`,
    '4. Fase: bagi tiga tahap berurutan: "Fase 1 · Memulai", "Fase 2 · Menguatkan", "Fase 3 · Mengunci".',
    '5. Kebiasaan: SATU tindakan harian yang kecil, konkret, dan terukur (waktu/jumlah/menit), naik bertahap dari mudah ke lebih berat. Maksimal 80 karakter, tanpa koma.',
    '6. Setiap hari ke-7, 14, 21, dan 28: "Evaluasi mingguan: ..." (tetap satu baris hari itu).',
    '7. Status: isi "Belum" untuk semua baris.',
    '8. Catatan: tips singkat pemicu/hadiah/cara mengatasi hambatan (maksimal 60 karakter, tanpa koma) atau kosong.',
  ].join('\n');
}

/** Cocokkan judul kolom berkas ke kolom habit. */
const POLA: Record<string, RegExp> = {
  hari: /^(hari|day|no|h)\b|hari\s*ke/i,
  tanggal: /tanggal|\btgl\b|date/i,
  fase: /fase|minggu|tahap|week|phase/i,
  kebiasaan: /kebiasaan|habit|kegiatan|aktivitas|tindakan|target|topik|materi|tugas|rencana/i,
  status: /status|ceklis|checklist|check|selesai|done/i,
  catatan: /catatan|note|keterangan|\bket\b|tips/i,
  kumulatif: /kumulatif|cumulative|total/i,
};

/**
 * Ubah tabel dari CSV/Excel (atau jawaban AI) menjadi tabel habit. Kolom dicocokkan
 * menurut judul; yang tidak ada dilengkapi (tanggal dari tanggal mulai, fase per
 * sepertiga masa). Kumulatif selalu dihitung ulang dari ceklis.
 */
export function barisHabitDariBerkas(sumber: string[][], kebiasaan: string, mulai: string): { baris: string[][]; peringatan: string[] } {
  const peringatan: string[] = [];
  const rapi = sumber.filter((r) => r.some((c) => (c ?? '').trim()));
  if (!rapi.length) return { baris: [], peringatan: ['Berkas kosong.'] };
  const judul = rapi[0].map((c) => (c ?? '').trim());
  const cari = (k: string) => judul.findIndex((c) => POLA[k].test(c) && !(k === 'status' && POLA.kumulatif.test(c)));
  const idx = Object.fromEntries(Object.keys(POLA).map((k) => [k, cari(k)])) as Record<string, number>;
  const adaJudul = Object.values(idx).some((j) => j !== -1);
  // Tanpa baris judul: anggap urutan Hari, Tanggal, Fase, Kebiasaan, Status, Catatan.
  const data = (adaJudul ? rapi.slice(1) : rapi).slice(0, MAKS_BARIS_TABEL - 1);
  if (!adaJudul) Object.assign(idx, { hari: 0, tanggal: 1, fase: 2, kebiasaan: 3, status: 4, catatan: 5, kumulatif: -1 });
  if (idx.status === -1) peringatan.push('Kolom Status/Ceklis tidak ditemukan — semua hari diisi "Belum".');
  if (rapi.length - (adaJudul ? 1 : 0) > MAKS_BARIS_TABEL - 1) peringatan.push(`Hanya ${MAKS_BARIS_TABEL - 1} hari pertama yang dipakai.`);
  const n = data.length;
  const ambil = (r: string[], k: string) => (idx[k] !== -1 ? (r[idx[k]] ?? '').trim() : '');
  const adaCatatan = idx.catatan !== -1;
  let jalan = 0;
  let bedaPertama = -1;
  const baris = data.map((r, i) => {
    const tgl = bacaTanggal(ambil(r, 'tanggal')) ?? tambahHari(mulai, i);
    const selesai = statusBaku(ambil(r, 'status'))?.kunci === 'selesai';
    jalan += selesai ? 1 : 0;
    const diBerkas = ambil(r, 'kumulatif');
    if (bedaPertama === -1 && diBerkas && Number(diBerkas.replace(',', '.')) !== jalan) bedaPertama = i;
    const hari = ambil(r, 'hari');
    return [
      hari && !/^\d+$/.test(hari) ? hari : `H-${dua(i + 1)}`,
      tgl,
      ambil(r, 'fase') || faseHabit(i, n),
      ambil(r, 'kebiasaan') || kebiasaan.trim() || 'Kebiasaan harian',
      selesai ? '✓ Selesai' : 'Belum',
      String(jalan),
      ...(adaCatatan ? [ambil(r, 'catatan')] : []),
    ];
  });
  if (bedaPertama !== -1) peringatan.push(`Angka kumulatif di berkas tidak cocok dengan ceklis mulai ${baris[bedaPertama][0]} — dihitung ulang dari ceklis.`);
  return { baris: [[...KEPALA_HABIT, ...(adaCatatan ? ['Catatan'] : [])], ...baris], peringatan };
}

/** Blok memo `!tabel{…}` habit dengan grafik progres. */
export function rakitHabit(baris: string[][], kebiasaan: string, mulai: string): string {
  const nama = kebiasaan.trim();
  return rakitTabel(baris, true, { aktif: true, tipe: 'progres', mode: 'nilai', sumbuX: 0, judul: nama ? `Habit: ${nama}` : 'Habit 1 bulan', mulai, habit: true });
}

export const tanggalHariIni = hariIniWita;
